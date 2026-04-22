import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { promisify } from "node:util";
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
import { parseCvMarkdown } from "@/lib/data/parse-cv";
import {
  appendPendingUrlsToPipeline,
  createEmptyPipelineMarkdown,
  parsePipelineMarkdown,
} from "@/lib/data/parse-pipeline";
import { parseProfileYaml } from "@/lib/data/parse-profile";
import { parseReportMarkdown } from "@/lib/data/parse-report";
import { serializeProfileYaml } from "@/lib/data/serialize-profile";
import {
  createEmptyStatusCounts,
  normalizeOpportunityStatus,
  parseStatesYaml,
} from "@/lib/data/parse-states";
import { updateTrackerMarkdown } from "@/lib/data/update-applications";
import type { ResumeDraft, ResumeDraftVariant } from "@/lib/resume-studio";
import type {
  DashboardStats,
  Evaluation,
  Opportunity,
  OpportunityStatus,
  PipelineInboxItem,
  ResumeSource,
  ScanRunResult,
  StateDefinition,
  UserProfile,
} from "@/lib/types";
import type { ParsedCvDocument } from "@/lib/data/parse-cv";

interface CacheEntry<T> {
  data: T;
  signature: string;
}

const cache = new Map<string, CacheEntry<unknown>>();
const execFileAsync = promisify(execFile);

interface BackendResumeDraftPayload {
  resumeSource: {
    id: string;
    label: string;
    path: string;
  };
  opportunity: {
    archetype: string;
    company: string;
    role: string;
    score: string | null;
    url: string;
  };
  draft: {
    competencies: string[];
    contactLines: string[];
    educationHighlights: string[];
    experienceHighlights: ResumeDraft["experienceHighlights"];
    fileName: string;
    format: "a4" | "letter";
    headline: string;
    name: string;
    nextSteps: string[];
    projectHighlights: ResumeDraft["projectHighlights"];
    skillHighlights: ResumeDraft["skillHighlights"];
    summary: string;
    targetLabel: string;
    tone: number;
    variant: ResumeDraftVariant;
  };
}

export interface GeneratedResumeDraft {
  draft: ResumeDraft;
  resumeSource: ResumeSource;
}

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

function normalizeResumeSource(source: ResumeSource, fallbackIndex = 0): ResumeSource {
  return {
    id: source.id?.trim() || `resume-${fallbackIndex + 1}`,
    label: source.label?.trim() || source.id?.trim() || `Resume ${fallbackIndex + 1}`,
    path: source.path?.trim() || "",
    default: Boolean(source.default),
    targetRoles: source.targetRoles ?? [],
  };
}

function getResumeSources(profile: UserProfile | null): ResumeSource[] {
  return (profile?.resumeSources ?? [])
    .map((source, index) => normalizeResumeSource(source, index))
    .filter((source) => source.path);
}

function buildVariantLabel(variant: ResumeDraftVariant) {
  switch (variant) {
    case "technical":
      return "Technical emphasis";
    case "execution":
      return "Execution emphasis";
    default:
      return "Balanced emphasis";
  }
}

function toUiResumeDraft(
  payload: BackendResumeDraftPayload,
  profile: UserProfile | null,
): GeneratedResumeDraft {
  return {
    resumeSource: {
      id: payload.resumeSource.id,
      label: payload.resumeSource.label,
      path: payload.resumeSource.path,
      targetRoles: [],
    },
    draft: {
      contactLines: payload.draft.contactLines,
      educationHighlights: payload.draft.educationHighlights,
      experienceHighlights: payload.draft.experienceHighlights,
      fileName: payload.draft.fileName,
      fitHighlights: payload.draft.nextSteps,
      focusKeywords: payload.draft.competencies,
      format: payload.draft.format,
      headline: payload.draft.headline,
      name: payload.draft.name,
      notes: payload.draft.nextSteps,
      profileReady: Boolean(profile),
      projectHighlights: payload.draft.projectHighlights,
      skillHighlights: payload.draft.skillHighlights,
      summary: payload.draft.summary,
      targetLabel: payload.draft.targetLabel,
      variantLabel: buildVariantLabel(payload.draft.variant),
    },
  };
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

async function resolvePipelinePath() {
  return findFirstCareerOpsFile([["data", "pipeline.md"], ["pipeline.md"]]);
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
      resumeSources: [],
    } satisfies UserProfile;
  });
}

export async function getCvDocument(): Promise<ParsedCvDocument | null> {
  noStore();
  const signature = await getCareerOpsSignature("cv.md");

  return readCached("cv", signature, async () => {
    const raw = await readCareerOpsTextFile("cv.md");
    return raw ? parseCvMarkdown(raw) : null;
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
  const [applicationsPath, profile, hasProfile, hasReportsDirectory, hasCv] = await Promise.all([
    resolveApplicationsPath(),
    getProfile(),
    careerOpsFileExists("config", "profile.yml"),
    careerOpsFileExists("reports"),
    careerOpsFileExists("cv.md"),
  ]);
  const configuredResumeSources = getResumeSources(profile);
  const resumeSourceChecks = await Promise.all(
    configuredResumeSources.map(async (source) => ({
      ...source,
      available: await careerOpsFileExists(...source.path.split("/")),
    })),
  );
  const availableResumeSources = resumeSourceChecks.filter((source) => source.available);
  const primaryResumeSource = availableResumeSources.find((source) => source.default)
    ?? availableResumeSources[0];
  const resumeReady = hasCv || availableResumeSources.length > 0;

  return {
    trackerReady: Boolean(applicationsPath),
    profileReady: hasProfile,
    reportsReady: hasReportsDirectory,
    cvReady: hasCv,
    resumeReady,
    resumePath: primaryResumeSource?.path ?? "cv.md",
    resumeSourceCount: availableResumeSources.length,
    resumeSourcesConfigured: configuredResumeSources.length,
    careerOpsPath: getCareerOpsPath(),
    trackerPath:
      applicationsPath?.replace(`${getCareerOpsPath()}/`, "") ?? "data/applications.md",
    profilePath: "config/profile.yml",
    cvPath: "cv.md",
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

export async function getPipelineInbox(): Promise<{
  pending: PipelineInboxItem[];
  processed: PipelineInboxItem[];
  path: string;
}> {
  noStore();
  const pipelinePath = (await resolvePipelinePath()) ?? resolveCareerOpsFile("data", "pipeline.md");
  const signature = await getCareerOpsSignature(
    pipelinePath.replace(`${getCareerOpsPath()}/`, ""),
  );

  return readCached("pipeline-inbox", signature, async () => {
    const relativePath = pipelinePath.replace(`${getCareerOpsPath()}/`, "");
    const raw = await readCareerOpsTextFile(...relativePath.split("/"));
    const text = raw ?? createEmptyPipelineMarkdown();
    const parsed = parsePipelineMarkdown(text);

    return {
      ...parsed,
      path: relativePath,
    };
  });
}

export async function enqueuePipelineUrls(input: { entries: string[] }) {
  noStore();
  const cleanedEntries = input.entries
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!cleanedEntries.length) {
    throw new Error("Paste at least one job URL or pipeline entry.");
  }

  const existing = await getPipelineInbox();
  const seen = new Set(
    [...existing.pending, ...existing.processed].map((item) => item.url.trim()),
  );
  const nextEntries = cleanedEntries.filter((entry) => {
    const url = entry.split("|")[0]?.trim() ?? "";
    if (!url || seen.has(url)) {
      return false;
    }
    seen.add(url);
    return true;
  });

  if (!nextEntries.length) {
    return {
      added: 0,
      inbox: existing,
    };
  }

  const pipelinePath = resolveCareerOpsFile(...existing.path.split("/"));
  const currentRaw = await readCareerOpsTextFile(...existing.path.split("/"));
  const nextText = appendPendingUrlsToPipeline(
    currentRaw ?? createEmptyPipelineMarkdown(),
    nextEntries,
  );

  await mkdir(resolveCareerOpsFile("data"), { recursive: true });
  await writeFile(pipelinePath, nextText, "utf8");
  clearCache(["pipeline-inbox"]);

  return {
    added: nextEntries.length,
    inbox: await getPipelineInbox(),
  };
}

export async function runPortalScan(input?: {
  company?: string;
  dryRun?: boolean;
}): Promise<ScanRunResult> {
  noStore();

  const args = [resolveCareerOpsFile("scan.mjs")];
  if (input?.dryRun) {
    args.push("--dry-run");
  }
  if (input?.company?.trim()) {
    args.push("--company", input.company.trim());
  }

  try {
    const { stdout, stderr } = await execFileAsync("node", args, {
      cwd: getCareerOpsPath(),
      maxBuffer: 1024 * 1024 * 10,
    });

    const output = `${stdout}${stderr ? `\n${stderr}` : ""}`.trim();
    clearCache(["pipeline-inbox"]);

    return {
      dryRun: Boolean(input?.dryRun),
      output,
      summary: {
        companiesScanned:
          Number(output.match(/Companies scanned:\s+(\d+)/)?.[1] ?? "") || null,
        totalJobsFound:
          Number(output.match(/Total jobs found:\s+(\d+)/)?.[1] ?? "") || null,
        filteredRemoved:
          Number(output.match(/Filtered by title:\s+(\d+)/)?.[1] ?? "") || null,
        duplicatesSkipped:
          Number(output.match(/Duplicates:\s+(\d+)/)?.[1] ?? "") || null,
        newOffersAdded:
          Number(output.match(/New offers added:\s+(\d+)/)?.[1] ?? "") || null,
        errorsCount:
          Number(output.match(/Errors \((\d+)\):/)?.[1] ?? "") || 0,
      },
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Unable to run the backend portal scanner.",
    );
  }
}

function sanitizeResumeSourceId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "resume";
}

export async function generateResumeDraft(input: {
  format?: "a4" | "letter";
  headlineOverride?: string;
  opportunityId: string;
  resumeSourceId?: string;
  summaryOverride?: string;
  tone?: number;
  variant?: ResumeDraftVariant;
}): Promise<GeneratedResumeDraft> {
  noStore();

  const { opportunity } = await getOpportunity(input.opportunityId);
  const profile = await getProfile();

  if (!opportunity?.reportPath) {
    throw new Error("The selected opportunity does not have a report-backed evaluation yet.");
  }

  const args = [
    resolveCareerOpsFile("resume-draft.mjs"),
    "--report",
    opportunity.reportPath,
    "--json",
    "--format",
    input.format === "a4" ? "a4" : "letter",
    "--variant",
    input.variant === "technical" || input.variant === "execution"
      ? input.variant
      : "balanced",
    "--tone",
    String(
      typeof input.tone === "number" && Number.isFinite(input.tone)
        ? Math.min(100, Math.max(0, input.tone))
        : 50,
    ),
  ];

  if (input.resumeSourceId?.trim()) {
    args.push("--resume-id", input.resumeSourceId.trim());
  }

  if (input.headlineOverride?.trim()) {
    args.push("--headline-override", input.headlineOverride.trim());
  }

  if (input.summaryOverride?.trim()) {
    args.push("--summary-override", input.summaryOverride.trim());
  }

  try {
    const { stdout } = await execFileAsync("node", args, {
      cwd: getCareerOpsPath(),
      maxBuffer: 1024 * 1024 * 10,
    });

    const payload = JSON.parse(stdout) as BackendResumeDraftPayload;
    return toUiResumeDraft(payload, profile);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate the tailored resume draft.";
    throw new Error(message);
  }
}

export async function uploadResumeSourceFile(input: {
  content: string;
  fileName: string;
  label?: string;
  makeDefault?: boolean;
  targetRoles?: string[];
}): Promise<ResumeSource> {
  noStore();

  const extension = extname(input.fileName).toLowerCase();
  if (![".md", ".txt"].includes(extension)) {
    throw new Error("Upload a markdown or plain-text resume for now. PDF/DOCX parsing is not wired yet.");
  }

  const baseId = sanitizeResumeSourceId(input.fileName.replace(/\.[^.]+$/, ""));
  let finalId = baseId;
  let counter = 2;

  while (await careerOpsFileExists("resumes", `${finalId}${extension || ".md"}`)) {
    finalId = `${baseId}-${counter}`;
    counter += 1;
  }

  const finalFileName = `${finalId}${extension || ".md"}`;
  const relativePath = `resumes/${finalFileName}`;

  await mkdir(resolveCareerOpsFile("resumes"), { recursive: true });
  await writeFile(resolveCareerOpsFile(...relativePath.split("/")), input.content, "utf8");

  clearCache(["profile", "profile-template"]);

  return {
    id: finalId,
    label: input.label?.trim() || input.fileName.replace(/\.[^.]+$/, ""),
    path: relativePath,
    default: Boolean(input.makeDefault),
    targetRoles: input.targetRoles ?? [],
  };
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

  clearCache(["profile", "profile-template", "opportunities", "stats"]);

  return getProfile();
}
