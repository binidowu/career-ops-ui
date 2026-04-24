import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
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
  MaintenanceCommandId,
  MaintenanceMode,
  MaintenanceResult,
  Opportunity,
  OpportunityStatus,
  PipelineInboxItem,
  PipelineProcessResult,
  ResumeSource,
  ScanRunResult,
  StateDefinition,
  InterviewPrepWorkspace,
  InterviewPrepDocument,
  SystemCheckId,
  SystemCheckResult,
  UserProfile,
} from "@/lib/types";
import type { ParsedCvDocument } from "@/lib/data/parse-cv";

interface CacheEntry<T> {
  data: T;
  signature: string;
}

const cache = new Map<string, CacheEntry<unknown>>();
const execFileAsync = promisify(execFile);
const LOCAL_TOOL_PATHS = ["/opt/homebrew/bin", "/usr/local/bin"];
const CODEX_CLI_CANDIDATES = [
  process.env.CODEX_CLI_PATH,
  "/opt/homebrew/bin/codex",
  "/usr/local/bin/codex",
].filter(Boolean) as string[];

const SYSTEM_CHECKS: Record<
  SystemCheckId,
  {
    description: string;
    title: string;
  }
> = {
  doctor: {
    title: "Workspace doctor",
    description: "Validate local prerequisites such as profile, resumes, fonts, and required directories.",
  },
  verify: {
    title: "Pipeline verify",
    description: "Check tracker integrity, report links, score formats, duplicates, and pending tracker additions.",
  },
  "sync-check": {
    title: "Resume sync check",
    description: "Verify that profile, resume sources, and prompt inputs are consistent before generation.",
  },
  liveness: {
    title: "Job link liveness",
    description: "Test whether tracked opportunity URLs still resolve to live job postings.",
  },
};

interface BackendResumeDraftPayload {
  resumeSource: {
    id: string;
    label: string;
    path: string;
    targetRoles?: string[];
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

function buildLocalExecEnv() {
  const existingPath = process.env.PATH?.split(":").filter(Boolean) ?? [];

  return {
    ...process.env,
    PATH: [...new Set([...LOCAL_TOOL_PATHS, ...existingPath])].join(":"),
  };
}

function normalizeExecError(error: unknown, fallbackMessage: string) {
  if (typeof error !== "object" || error === null) {
    throw new Error(fallbackMessage);
  }

  const execError = error as {
    code?: number | string;
    message?: string;
    stderr?: string;
    stdout?: string;
  };

  const output = normalizeCommandOutput(execError.stdout ?? "", execError.stderr ?? "");
  const message = output || execError.message || fallbackMessage;

  return {
    exitCode: typeof execError.code === "number" ? execError.code : 1,
    message,
    output,
  };
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveCodexCliPath() {
  for (const candidate of CODEX_CLI_CANDIDATES) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  const home = process.env.HOME?.trim();
  if (home) {
    const extensionsDir = `${home}/.antigravity/extensions`;
    const extensionIds = await readdir(extensionsDir).catch(() => [] as string[]);

    for (const extensionId of extensionIds) {
      const candidate = `${extensionsDir}/${extensionId}/bin/macos-aarch64/codex`;

      if (await fileExists(candidate)) {
        return candidate;
      }
    }
  }

  throw new Error(
    "The local Codex CLI could not be found. Install or expose the Codex binary so browser-triggered pipeline processing can run.",
  );
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

function slugifyPrepTarget(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createInterviewPrepMatchScore(reportPath: string, company: string, role: string) {
  const reportSlug = slugifyPrepTarget(basename(reportPath, ".md"));
  const companyTokens = slugifyPrepTarget(company).split("-").filter((token) => token.length >= 3);
  const roleTokens = slugifyPrepTarget(role).split("-").filter((token) => token.length >= 3);

  let score = 0;

  for (const token of companyTokens) {
    if (reportSlug.includes(token)) score += 3;
  }

  for (const token of roleTokens) {
    if (reportSlug.includes(token)) score += 2;
  }

  return score;
}

function stripAnsi(value: string) {
  return value.replace(/\x1B\[[0-9;]*m/g, "");
}

function normalizeCommandOutput(stdout = "", stderr = "") {
  return stripAnsi(`${stdout}${stderr ? `\n${stderr}` : ""}`).trim();
}

function createSystemCheckResult(
  checkId: SystemCheckId,
  input: Partial<SystemCheckResult>,
): SystemCheckResult {
  return {
    checkId,
    title: SYSTEM_CHECKS[checkId].title,
    description: SYSTEM_CHECKS[checkId].description,
    status: input.status ?? "pass",
    summary: input.summary ?? "",
    details: input.details ?? [],
    counts: input.counts ?? {},
    exitCode: input.exitCode ?? 0,
    output: input.output ?? "",
  };
}

function parseDoctorResult(output: string, exitCode: number): SystemCheckResult {
  const passes = (output.match(/^✓\s/mg) ?? []).length;
  const failures = (output.match(/^✗\s/mg) ?? []).length;
  const details = output
    .split("\n")
    .filter((line) => /^(✓|✗)\s/.test(line.trim()))
    .map((line) => line.trim());

  return createSystemCheckResult("doctor", {
    status: failures > 0 || exitCode !== 0 ? "fail" : "pass",
    summary:
      failures > 0
        ? `${failures} prerequisite${failures === 1 ? "" : "s"} still need attention.`
        : `All ${passes} workspace prerequisite checks passed.`,
    details,
    counts: { failures, passes },
    exitCode,
    output,
  });
}

function parseVerifyResult(output: string, exitCode: number): SystemCheckResult {
  const errors = Number(output.match(/Pipeline Health:\s+(\d+)\s+errors/)?.[1] ?? "") || 0;
  const warnings =
    Number(output.match(/Pipeline Health:\s+\d+\s+errors,\s+(\d+)\s+warnings/)?.[1] ?? "") || 0;
  const details = output
    .split("\n")
    .filter((line) => /^(✅|⚠️|❌)\s/.test(line.trim()))
    .map((line) => line.trim());

  return createSystemCheckResult("verify", {
    status: errors > 0 || exitCode !== 0 ? "fail" : warnings > 0 ? "warn" : "pass",
    summary:
      errors > 0
        ? `${errors} pipeline integrity error${errors === 1 ? "" : "s"} detected.`
        : warnings > 0
          ? `${warnings} warning${warnings === 1 ? "" : "s"} found, but the tracker is still usable.`
          : "Pipeline integrity is clean.",
    details,
    counts: { errors, warnings },
    exitCode,
    output,
  });
}

function parseSyncCheckResult(output: string, exitCode: number): SystemCheckResult {
  const errors = Number(output.match(/ERRORS\s+\((\d+)\)/)?.[1] ?? "") || 0;
  const warnings = Number(output.match(/WARNINGS\s+\((\d+)\)/)?.[1] ?? "") || 0;
  const details = output
    .split("\n")
    .filter((line) => /^(ERROR:|WARN:|All checks passed\.)/.test(line.trim()))
    .map((line) => line.trim());

  return createSystemCheckResult("sync-check", {
    status: errors > 0 || exitCode !== 0 ? "fail" : warnings > 0 ? "warn" : "pass",
    summary:
      errors > 0
        ? `${errors} resume or profile sync error${errors === 1 ? "" : "s"} detected.`
        : warnings > 0
          ? `${warnings} warning${warnings === 1 ? "" : "s"} found in resume/profile consistency.`
          : "Resume sources and profile inputs are in sync.",
    details,
    counts: { errors, warnings },
    exitCode,
    output,
  });
}

function parseLivenessResult(output: string, exitCode: number, urlsChecked: number): SystemCheckResult {
  const active = Number(output.match(/Results:\s+(\d+)\s+active/)?.[1] ?? "") || 0;
  const expired = Number(output.match(/Results:\s+\d+\s+active\s+(\d+)\s+expired/)?.[1] ?? "") || 0;
  const uncertain = Number(output.match(/Results:\s+\d+\s+active\s+\d+\s+expired\s+(\d+)\s+uncertain/)?.[1] ?? "") || 0;
  const details = output
    .split("\n")
    .filter((line) => /^(✅|❌|⚠️)\s/.test(line.trim()))
    .map((line) => line.trim());

  return createSystemCheckResult("liveness", {
    status: expired > 0 ? "fail" : uncertain > 0 ? "warn" : exitCode !== 0 ? "fail" : "pass",
    summary:
      expired > 0
        ? `${expired} tracked job link${expired === 1 ? "" : "s"} appear to be expired.`
        : uncertain > 0
          ? `${uncertain} tracked link${uncertain === 1 ? "" : "s"} could not be classified confidently.`
          : `All ${active} tracked job link${active === 1 ? "" : "s"} appear active.`,
    details,
    counts: { active, expired, uncertain, urlsChecked },
    exitCode,
    output,
  });
}

function parseSystemCheckResult(
  checkId: SystemCheckId,
  output: string,
  exitCode: number,
  options?: { urlsChecked?: number },
): SystemCheckResult {
  switch (checkId) {
    case "doctor":
      return parseDoctorResult(output, exitCode);
    case "verify":
      return parseVerifyResult(output, exitCode);
    case "sync-check":
      return parseSyncCheckResult(output, exitCode);
    case "liveness":
      return parseLivenessResult(output, exitCode, options?.urlsChecked ?? 0);
    default:
      return createSystemCheckResult(checkId, {
        status: exitCode === 0 ? "pass" : "fail",
        summary: exitCode === 0 ? "Check completed." : "Check failed.",
        exitCode,
        output,
      });
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
      targetRoles: payload.resumeSource.targetRoles ?? [],
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
      env: buildLocalExecEnv(),
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

export async function runSystemCheck(input: {
  checkId: SystemCheckId;
}): Promise<SystemCheckResult> {
  noStore();

  const command = input.checkId;

  if (!(command in SYSTEM_CHECKS)) {
    throw new Error("Unknown system check.");
  }

  let args: string[];
  let urlsChecked = 0;

  switch (command) {
    case "doctor":
      args = [resolveCareerOpsFile("doctor.mjs")];
      break;
    case "verify":
      args = [resolveCareerOpsFile("verify-pipeline.mjs")];
      break;
    case "sync-check":
      args = [resolveCareerOpsFile("cv-sync-check.mjs")];
      break;
    case "liveness": {
      const opportunities = await getOpportunities();
      const urls = [...new Set(
        opportunities
          .map((opportunity) => opportunity.jobUrl?.trim())
          .filter((value): value is string => Boolean(value)),
      )];
      urlsChecked = urls.length;

      if (!urls.length) {
        return createSystemCheckResult("liveness", {
          status: "warn",
          summary: "No tracked job URLs are available yet for a liveness check.",
          details: [
            "Add opportunities with report URLs first so the liveness checker has something to test.",
          ],
          counts: { urlsChecked: 0 },
          output: "No URLs available from tracked opportunities.",
          exitCode: 0,
        });
      }

      args = [resolveCareerOpsFile("check-liveness.mjs"), ...urls];
      break;
    }
    default:
      throw new Error("Unknown system check.");
  }

  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  try {
    const result = await execFileAsync("node", args, {
      cwd: getCareerOpsPath(),
      env: buildLocalExecEnv(),
      maxBuffer: 1024 * 1024 * 10,
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    if (typeof error === "object" && error !== null) {
      const executionError = error as {
        code?: number | string;
        stderr?: string;
        stdout?: string;
      };
      stdout = executionError.stdout ?? "";
      stderr = executionError.stderr ?? "";
      exitCode = typeof executionError.code === "number" ? executionError.code : 1;
    } else {
      throw new Error("Unable to execute the backend system check.");
    }
  }

  const output = normalizeCommandOutput(stdout, stderr);
  return parseSystemCheckResult(command, output, exitCode, { urlsChecked });
}

export async function getInterviewPrepWorkspace(input: {
  company: string;
  role: string;
}): Promise<InterviewPrepWorkspace> {
  noStore();

  const dirSignature = await getCareerOpsSignature("interview-prep");
  const storyBankPath = "interview-prep/story-bank.md";

  return readCached<InterviewPrepWorkspace>(`interview-prep:${input.company}:${input.role}`, dirSignature, async () => {
    const storyBankContent = (await readCareerOpsTextFile("interview-prep", "story-bank.md")) ?? "";
    const directoryPath = resolveCareerOpsFile("interview-prep");
    const files = await readdir(directoryPath).catch(() => [] as string[]);

    const reportCandidates = await Promise.all(
      files
        .filter((file) => file.endsWith(".md") && file !== "story-bank.md")
        .map(async (file) => {
          const content = await readCareerOpsTextFile("interview-prep", file);
          if (!content) return null;

          const relativePath = `interview-prep/${file}`;
          const titleMatch = /^#\s+(.+)$/m.exec(content);

          return {
            path: relativePath,
            title: titleMatch?.[1]?.trim() ?? basename(file, ".md"),
            content,
            matched: false,
          } satisfies InterviewPrepDocument;
        }),
    );

    const reports: InterviewPrepDocument[] = reportCandidates.filter(
      (report): report is NonNullable<typeof report> => report !== null,
    );

    const matchedReport =
      [...reports]
        .map((report) => ({
          report,
          score: createInterviewPrepMatchScore(report.path, input.company, input.role),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)[0]?.report ?? null;

    const nextReports: InterviewPrepDocument[] = reports.map((report) => ({
      ...report,
      matched: matchedReport?.path === report.path,
    }));

    return {
      storyBankContent,
      storyBankPath,
      reports: nextReports,
      matchedReport: nextReports.find((report) => report.matched) ?? null,
    };
  });
}

export async function saveInterviewPrepStoryBank(content: string) {
  noStore();

  const nextContent = content.trim();
  if (!nextContent) {
    throw new Error("Story bank content cannot be empty.");
  }

  const directory = resolveCareerOpsFile("interview-prep");
  await mkdir(directory, { recursive: true });
  await writeFile(resolveCareerOpsFile("interview-prep", "story-bank.md"), `${nextContent}\n`, "utf8");
  clearCache(["interview-prep:"]);

  return {
    path: "interview-prep/story-bank.md",
    content: `${nextContent}\n`,
  };
}

export async function generateInterviewPrepIntel(input: {
  opportunityId: string;
}) {
  noStore();

  const { opportunity } = await getOpportunity(input.opportunityId);

  if (!opportunity?.reportPath) {
    throw new Error("The selected opportunity does not have a report-backed evaluation yet.");
  }

  const args = [
    resolveCareerOpsFile("interview-intel-draft.mjs"),
    "--report",
    opportunity.reportPath,
    "--json",
  ];

  try {
    const { stdout } = await execFileAsync("node", args, {
      cwd: getCareerOpsPath(),
      env: buildLocalExecEnv(),
      maxBuffer: 1024 * 1024 * 10,
    });

    const payload = JSON.parse(stdout) as {
      company: string;
      inferredQuestions: number;
      outputPath: string;
      reportPath: string;
      role: string;
      storyMatches: number;
    };

    clearCache(["interview-prep:"]);
    return payload;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate the interview intel draft.";
    throw new Error(message);
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
      env: buildLocalExecEnv(),
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

async function readOptionalTextFile(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

export async function processPendingPipelineBatch(input?: {
  limit?: number;
}): Promise<PipelineProcessResult> {
  noStore();

  const inboxBefore = await getPipelineInbox();
  const pendingBefore = inboxBefore.pending.length;
  const requestedLimit = Number.isFinite(input?.limit)
    ? Math.trunc(input?.limit ?? 3)
    : 3;
  const limit = Math.min(10, Math.max(1, requestedLimit));
  const attemptedCount = Math.min(limit, pendingBefore);

  if (!attemptedCount) {
    return {
      attemptedCount: 0,
      pendingBefore: 0,
      pendingAfter: 0,
      resolvedCount: 0,
      summary: "There are no pending pipeline items to process right now.",
      output: "No pending items in data/pipeline.md.",
    };
  }

  const runId = `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const summaryPath = `/tmp/${runId}.txt`;
  const codexCliPath = await resolveCodexCliPath();
  const prompt = [
    `Working inside the career-ops repository, process only the first ${attemptedCount} pending entries from data/pipeline.md using the Career-Ops pipeline workflow.`,
    "Follow the checked-in instructions from AGENTS.md, docs/CODEX.md, CLAUDE.md, and modes/pipeline.md.",
    `Do not process more than ${attemptedCount} pending items even if more remain in the inbox.`,
    "Use /opt/homebrew/bin/node when you need to invoke repository Node scripts.",
    "If tracker TSV additions are created during the run, merge them and verify integrity before finishing.",
    "At the end, output only a concise operator summary describing what was processed, what reports or PDFs were created, and any blockers encountered.",
  ].join("\n");

  try {
    await execFileAsync(
      codexCliPath,
      [
        "exec",
        "-C",
        getCareerOpsPath(),
        "--full-auto",
        "--ephemeral",
        "--output-last-message",
        summaryPath,
        prompt,
      ],
      {
        cwd: getCareerOpsPath(),
        env: buildLocalExecEnv(),
        maxBuffer: 1024 * 1024 * 20,
        timeout: 1000 * 60 * 30,
      },
    );
  } catch (error) {
    const summary = (await readOptionalTextFile(summaryPath)).trim();
    const normalized = normalizeExecError(
      error,
      "Unable to run the pending pipeline processor.",
    );

    throw new Error(summary || normalized.message);
  }

  const summary = (await readOptionalTextFile(summaryPath)).trim();
  clearCache();

  const inboxAfter = await getPipelineInbox();
  const pendingAfter = inboxAfter.pending.length;
  const resolvedCount = Math.max(0, pendingBefore - pendingAfter);
  const fallbackSummary =
    resolvedCount > 0
      ? `${resolvedCount} pending pipeline item${resolvedCount === 1 ? "" : "s"} moved out of the inbox.`
      : "Pipeline processor finished, but no pending items moved out of the inbox.";

  return {
    attemptedCount,
    pendingBefore,
    pendingAfter,
    resolvedCount,
    summary: summary || fallbackSummary,
    output: summary || fallbackSummary,
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

/* ============================================================
   Apply & Outreach Data
   Stored in data/apply-notes.json in the career-ops directory.
   Each entry is keyed by opportunity id.
   ============================================================ */

export interface ApplyNoteEntry {
  coverLetterNotes: string;
  outreachDraft: string;
  appliedDate: string | null;
}

function applyNotesPath() {
  return resolveCareerOpsFile("data", "apply-notes.json");
}

async function readApplyNotesFile(): Promise<Record<string, ApplyNoteEntry>> {
  try {
    const raw = await readFile(applyNotesPath(), "utf8");
    return JSON.parse(raw) as Record<string, ApplyNoteEntry>;
  } catch {
    return {};
  }
}

export async function getApplyData(opportunityId: string): Promise<ApplyNoteEntry> {
  noStore();
  const all = await readApplyNotesFile();
  return all[opportunityId] ?? { coverLetterNotes: "", outreachDraft: "", appliedDate: null };
}

export async function saveApplyData(
  opportunityId: string,
  patch: Partial<ApplyNoteEntry>,
): Promise<ApplyNoteEntry> {
  noStore();
  const all = await readApplyNotesFile();
  const existing = all[opportunityId] ?? {
    coverLetterNotes: "",
    outreachDraft: "",
    appliedDate: null,
  };
  const next: ApplyNoteEntry = { ...existing, ...patch };
  all[opportunityId] = next;

  await mkdir(resolveCareerOpsFile("data"), { recursive: true });
  await writeFile(applyNotesPath(), JSON.stringify(all, null, 2), "utf8");

  return next;
}

const MAINTENANCE_COMMANDS: Record<
  MaintenanceCommandId,
  { title: string; description: string }
> = {
  normalize: {
    title: "Normalize statuses",
    description: "Map non-canonical status values to canonical ones and strip formatting artefacts.",
  },
  dedup: {
    title: "Deduplicate tracker",
    description: "Remove duplicate entries, keeping the highest-scored row and merging notes.",
  },
  merge: {
    title: "Merge batch additions",
    description: "Merge pending TSV additions from the batch folder into applications.md.",
  },
  "update-check": {
    title: "Check for system updates",
    description: "Compare local system version against the remote release.",
  },
  "update-apply": {
    title: "Apply system update",
    description: "Pull the latest system layer files. User data is never touched.",
  },
  rollback: {
    title: "Rollback last update",
    description: "Revert the most recent system update to the previous version.",
  },
};

function parseMaintOutput(
  commandId: MaintenanceCommandId,
  output: string,
  exitCode: number,
): Pick<MaintenanceResult, "status" | "summary" | "changesFound"> {
  const isError = exitCode !== 0;

  if (isError) {
    return { status: "error", summary: "Command exited with an error.", changesFound: 0 };
  }

  if (commandId === "update-check") {
    try {
      const parsed = JSON.parse(output.trim()) as {
        status?: string;
        local?: string;
        remote?: string;
      };
      if (parsed.status === "up-to-date") {
        return {
          status: "ok",
          summary: `System is up to date (v${parsed.local ?? "?"}).`,
          changesFound: 0,
        };
      }
      return {
        status: "warn",
        summary: `Update available: v${parsed.local ?? "?"} → v${parsed.remote ?? "?"}.`,
        changesFound: 1,
      };
    } catch {
      return { status: "ok", summary: output.trim().slice(0, 120), changesFound: 0 };
    }
  }

  if (commandId === "update-apply" || commandId === "rollback") {
    const ok = output.includes("✅") || output.toLowerCase().includes("success");
    return {
      status: ok ? "ok" : "warn",
      summary: output.trim().split("\n").find((l) => l.trim()) ?? "Done.",
      changesFound: 0,
    };
  }

  const countMatch = /(\d+)\s+(statuses normalized|duplicates removed|entries added)/i.exec(output);
  const count = countMatch ? parseInt(countMatch[1], 10) : 0;
  const isDryRun = output.includes("dry-run");

  const noChanges =
    output.includes("No changes") ||
    output.includes("No pending") ||
    (count === 0 && !output.toLowerCase().includes("error"));

  if (noChanges) {
    return {
      status: "ok",
      summary: isDryRun
        ? "Preview complete — no changes would be made."
        : "No changes were needed.",
      changesFound: 0,
    };
  }

  return {
    status: "warn",
    summary: isDryRun
      ? `Preview: ${count} change${count !== 1 ? "s" : ""} would be applied.`
      : `Applied ${count} change${count !== 1 ? "s" : ""}.`,
    changesFound: count,
  };
}

export async function runMaintenanceCommand(input: {
  commandId: MaintenanceCommandId;
  mode: MaintenanceMode;
}): Promise<MaintenanceResult> {
  noStore();

  const { commandId, mode } = input;
  const dryRun = mode === "preview";

  let args: string[];

  switch (commandId) {
    case "normalize":
      args = [resolveCareerOpsFile("normalize-statuses.mjs"), ...(dryRun ? ["--dry-run"] : [])];
      break;
    case "dedup":
      args = [resolveCareerOpsFile("dedup-tracker.mjs"), ...(dryRun ? ["--dry-run"] : [])];
      break;
    case "merge":
      args = [resolveCareerOpsFile("merge-tracker.mjs"), ...(dryRun ? ["--dry-run"] : [])];
      break;
    case "update-check":
      args = [resolveCareerOpsFile("update-system.mjs"), "check"];
      break;
    case "update-apply":
      args = [resolveCareerOpsFile("update-system.mjs"), "apply"];
      break;
    case "rollback":
      args = [resolveCareerOpsFile("update-system.mjs"), "rollback"];
      break;
    default:
      throw new Error("Unknown maintenance command.");
  }

  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  try {
    const result = await execFileAsync("node", args, {
      cwd: getCareerOpsPath(),
      env: buildLocalExecEnv(),
      maxBuffer: 1024 * 1024 * 10,
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    if (typeof error === "object" && error !== null) {
      const execError = error as { code?: number | string; stderr?: string; stdout?: string };
      stdout = execError.stdout ?? "";
      stderr = execError.stderr ?? "";
      exitCode = typeof execError.code === "number" ? execError.code : 1;
    } else {
      throw new Error("Unable to execute the maintenance command.");
    }
  }

  const output = normalizeCommandOutput(stdout, stderr);
  const parsed = parseMaintOutput(commandId, output, exitCode);

  return {
    commandId,
    mode,
    output,
    ...parsed,
  };
}
