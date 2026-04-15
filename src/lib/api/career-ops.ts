import { mkdir, readFile, writeFile } from "node:fs/promises";
import { unstable_noStore as noStore } from "next/cache";

import {
  careerOpsFileExists,
  findFirstCareerOpsFile,
  getCareerOpsPath,
  getCareerOpsSignature,
  readCareerOpsTextFile,
  resolveCareerOpsFile,
} from "@/lib/data";
import { parseApplicationsMarkdown } from "@/lib/data/parse-applications";
import { parseProfileYaml } from "@/lib/data/parse-profile";
import { parseReportMarkdown } from "@/lib/data/parse-report";
import { serializeProfileYaml } from "@/lib/data/serialize-profile";
import {
  createEmptyStatusCounts,
  normalizeOpportunityStatus,
  parseStatesYaml,
} from "@/lib/data/parse-states";
import { updateTrackerMarkdown } from "@/lib/data/update-applications";
import type {
  DashboardStats,
  Evaluation,
  Opportunity,
  OpportunityStatus,
  StateDefinition,
  UserProfile,
} from "@/lib/types";

interface CacheEntry<T> {
  data: T;
  signature: string;
}

const cache = new Map<string, CacheEntry<unknown>>();

function clearCache(prefixes: string[] = []) {
  if (!prefixes.length) {
    cache.clear();
    return;
  }

  for (const key of [...cache.keys()]) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      cache.delete(key);
    }
  }
}

async function readCached<T>(
  key: string,
  signature: string,
  loader: () => Promise<T>,
): Promise<T> {
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing?.signature === signature) {
    return existing.data;
  }

  const data = await loader();
  cache.set(key, { data, signature });
  return data;
}

function compareByRecentDate(left: Opportunity, right: Opportunity) {
  return right.date.localeCompare(left.date);
}

function compareByScore(left: Opportunity, right: Opportunity) {
  return (right.score ?? -1) - (left.score ?? -1);
}

function isActiveStatus(status: OpportunityStatus) {
  return !["Rejected", "Discarded", "SKIP", "Unknown"].includes(status);
}

async function resolveApplicationsPath() {
  return findFirstCareerOpsFile([["applications.md"], ["data", "applications.md"]]);
}

export async function getStates(): Promise<StateDefinition[]> {
  noStore();
  const signature = await getCareerOpsSignature("templates", "states.yml");

  return readCached("states", signature, async () => {
    const raw = await readCareerOpsTextFile("templates", "states.yml");
    return raw ? parseStatesYaml(raw) : [];
  });
}

export async function getProfile(): Promise<UserProfile | null> {
  noStore();
  const signature = await getCareerOpsSignature("config", "profile.yml");

  return readCached("profile", signature, async () => {
    const raw = await readCareerOpsTextFile("config", "profile.yml");
    return raw ? parseProfileYaml(raw) : null;
  });
}

export async function getProfileTemplate(): Promise<UserProfile> {
  noStore();
  const signature = await getCareerOpsSignature("config", "profile.example.yml");

  return readCached("profile-template", signature, async () => {
    const raw = await readCareerOpsTextFile("config", "profile.example.yml");

    if (raw) {
      return parseProfileYaml(raw);
    }

    return {
      candidate: {
        fullName: "",
        email: "",
        location: "",
      },
      targetRoles: {
        primary: [],
        archetypes: [],
      },
      narrative: {
        headline: "",
        exitStory: "",
        superpowers: [],
        proofPoints: [],
      },
      compensation: {
        targetRange: "",
        currency: "",
        minimum: "",
      },
      location: {
        country: "",
        city: "",
        timezone: "",
      },
    } satisfies UserProfile;
  });
}

export async function getOpportunities(): Promise<Opportunity[]> {
  noStore();
  const applicationsPath = await resolveApplicationsPath();
  const [states, statesSignature, applicationsSignature, reportsSignature] =
    await Promise.all([
    getStates(),
    getCareerOpsSignature("templates", "states.yml"),
    applicationsPath
      ? getCareerOpsSignature(applicationsPath.replace(`${getCareerOpsPath()}/`, ""))
      : Promise.resolve("applications:missing"),
    getCareerOpsSignature("reports"),
    ]);

  return readCached(
    "opportunities",
    `${statesSignature}|${applicationsSignature}|${reportsSignature}`,
    async () => {
      if (!applicationsPath) {
        return [];
      }

      const raw = await readFile(applicationsPath, "utf8");
      const opportunities = parseApplicationsMarkdown(raw, states);

      await Promise.all(
        opportunities.map(async (opportunity) => {
          if (!opportunity.reportPath) {
            return;
          }

          const reportText = await readCareerOpsTextFile(...opportunity.reportPath.split("/"));

          if (!reportText) {
            return;
          }

          const evaluation = parseReportMarkdown(reportText, opportunity.reportPath);
          opportunity.archetype = evaluation.archetype || null;
          opportunity.summary = evaluation.summary || null;
          opportunity.remote = evaluation.roleSummary.Remote ?? null;
          opportunity.compensation =
            evaluation.compensationItems[0]?.value ??
            evaluation.roleSummary.Comp ??
            null;
          opportunity.jobUrl = evaluation.url;
        }),
      );

      return opportunities.sort((left, right) => left.num - right.num);
    },
  );
}

export async function getOpportunity(id: string): Promise<{
  evaluation: Evaluation | null;
  opportunity: Opportunity | null;
}> {
  noStore();
  const opportunities = await getOpportunities();
  const opportunity = opportunities.find((entry) => entry.id === id) ?? null;

  if (!opportunity?.reportPath) {
    return {
      opportunity,
      evaluation: null,
    };
  }

  const signature = await getCareerOpsSignature(...opportunity.reportPath.split("/"));

  const evaluation = await readCached(`report:${opportunity.reportPath}`, signature, async () => {
    const raw = await readCareerOpsTextFile(...opportunity.reportPath!.split("/"));
    return raw ? parseReportMarkdown(raw, opportunity.reportPath) : null;
  });

  return {
    opportunity,
    evaluation: evaluation as Evaluation | null,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  noStore();
  const [opportunities, profile] = await Promise.all([
    getOpportunities(),
    getProfile(),
  ]);

  const statusCounts = createEmptyStatusCounts();
  let totalScore = 0;
  let scored = 0;

  for (const opportunity of opportunities) {
    statusCounts[opportunity.status] += 1;

    if (typeof opportunity.score === "number") {
      totalScore += opportunity.score;
      scored += 1;
    }
  }

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const weekAgoKey = weekAgo.toISOString().slice(0, 10);

  return {
    totalEvaluated: opportunities.length,
    newThisWeek: opportunities.filter((opportunity) => opportunity.date >= weekAgoKey).length,
    averageScore: scored ? totalScore / scored : null,
    statusCounts,
    topScoring: [...opportunities]
      .filter((opportunity) => typeof opportunity.score === "number")
      .sort(compareByScore)
      .slice(0, 5),
    followUpsDue: [...opportunities]
      .filter((opportunity) => isActiveStatus(opportunity.status))
      .sort((left, right) => {
        if (left.status === right.status) {
          return compareByRecentDate(left, right);
        }

        return compareByRecentDate(left, right);
      })
      .slice(0, 5),
    reportCount: opportunities.filter((opportunity) => opportunity.reportPath).length,
    profileReady: Boolean(profile),
  };
}

export async function getWorkspaceSignals() {
  noStore();
  const [applicationsPath, hasProfile, hasReportsDirectory] = await Promise.all([
    resolveApplicationsPath(),
    careerOpsFileExists("config", "profile.yml"),
    careerOpsFileExists("reports"),
  ]);

  return {
    trackerReady: Boolean(applicationsPath),
    profileReady: hasProfile,
    reportsReady: hasReportsDirectory,
    careerOpsPath: getCareerOpsPath(),
    trackerPath:
      applicationsPath?.replace(`${getCareerOpsPath()}/`, "") ?? "data/applications.md",
    profilePath: "config/profile.yml",
  };
}

export async function getCommandPaletteOpportunities(limit = 6) {
  noStore();
  const opportunities = await getOpportunities();

  return [...opportunities]
    .filter((opportunity) => opportunity.company && opportunity.role)
    .sort((left, right) => {
      const scoreDifference = compareByScore(left, right);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return compareByRecentDate(left, right);
    })
    .slice(0, limit);
}

export async function updateOpportunity(
  id: string,
  changes: {
    notes?: string;
    status?: string;
  },
) {
  noStore();

  const applicationsPath = await resolveApplicationsPath();
  if (!applicationsPath) {
    throw new Error("No applications.md tracker file was found in the career-ops workspace.");
  }

  const [states, opportunities, raw] = await Promise.all([
    getStates(),
    getOpportunities(),
    readFile(applicationsPath, "utf8"),
  ]);

  const target = opportunities.find((entry) => entry.id === id);

  if (!target) {
    throw new Error("Opportunity not found.");
  }

  const nextStatus =
    typeof changes.status === "string"
      ? normalizeOpportunityStatus(changes.status, states)
      : target.status;

  if (nextStatus === "Unknown") {
    throw new Error("Status is not recognized by templates/states.yml.");
  }

  const result = updateTrackerMarkdown(raw, target, {
    notes: changes.notes,
    status: typeof changes.status === "string" ? nextStatus : undefined,
  });

  if (!result.updated) {
    throw new Error("Tracker row could not be updated.");
  }

  await writeFile(applicationsPath, result.markdown, "utf8");
  clearCache(["opportunities", "report:", "stats", "states"]);

  const refreshed = await getOpportunity(id);

  return {
    opportunity: refreshed.opportunity,
    evaluation: refreshed.evaluation,
  };
}

export async function saveProfile(profile: UserProfile) {
  noStore();

  const profilePath = resolveCareerOpsFile("config", "profile.yml");
  await mkdir(resolveCareerOpsFile("config"), { recursive: true });
  await writeFile(profilePath, serializeProfileYaml(profile), "utf8");

  clearCache(["profile", "profile-template", "opportunities"]);

  return getProfile();
}
