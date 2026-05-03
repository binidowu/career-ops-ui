import { execFile, spawn } from "node:child_process";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve as resolvePath } from "node:path";
import { promisify } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
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
import {
  buildOpportunityIntel,
  getIntelSidecarPath,
  parseOpportunityIntelSidecar,
} from "@/lib/intel/view-model";
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
  PipelineProcessJob,
  PipelineProcessStartResponse,
  ResumeSource,
  ScanRunResult,
  StateDefinition,
  InterviewPrepWorkspace,
  InterviewPrepDocument,
  OpportunityIntel,
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
// Jobs are stored in the career-ops workspace directory so they survive server
// restarts. /tmp is wiped on reboot and can't survive deployments.
// Falls back to /tmp if CAREER_OPS_PATH is not yet set (e.g. during build).
const PIPELINE_JOBS_DIR = process.env.CAREER_OPS_PATH
  ? join(process.env.CAREER_OPS_PATH, ".career-ops-ui", "jobs")
  : "/tmp/career-ops-ui-pipeline-jobs";
const PIPELINE_JOBS_LATEST_PATH = join(PIPELINE_JOBS_DIR, "latest.json");
const PIPELINE_JOB_STALE_MS = 1000 * 60 * 8;

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

function createPipelineJob(
  input: Pick<PipelineProcessJob, "attemptedCount" | "pendingBefore" | "requestedLimit">,
): PipelineProcessJob {
  const now = new Date().toISOString();

  return {
    id: `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "queued",
    stage: "Waiting to launch background processor",
    progressLabel: "Queued",
    progressPercent: 4,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    heartbeatAt: null,
    finishedAt: null,
    pendingAfter: null,
    resolvedCount: null,
    summary: null,
    output: null,
    workerPid: null,
    ...input,
  };
}

async function ensurePipelineJobsDir() {
  await mkdir(PIPELINE_JOBS_DIR, { recursive: true });
}

function getPipelineJobPath(id: string) {
  return join(PIPELINE_JOBS_DIR, `${id}.json`);
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(path: string, value: unknown) {
  await ensurePipelineJobsDir();
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writePipelineJob(job: PipelineProcessJob) {
  await writeJsonFile(getPipelineJobPath(job.id), job);
  await writeJsonFile(PIPELINE_JOBS_LATEST_PATH, { id: job.id });
}

export async function getPipelineProcessJob(id: string) {
  noStore();
  return readJsonFile<PipelineProcessJob>(getPipelineJobPath(id));
}

export async function getLatestPipelineProcessJob() {
  noStore();

  const latest = await readJsonFile<{ id?: string }>(PIPELINE_JOBS_LATEST_PATH);
  const latestId = latest?.id?.trim();

  if (!latestId) {
    return null;
  }

  return getPipelineProcessJob(latestId);
}

async function clearLatestPipelineProcessJobReference(id: string) {
  const latest = await readJsonFile<{ id?: string }>(PIPELINE_JOBS_LATEST_PATH);

  if (latest?.id?.trim() === id) {
    await writeJsonFile(PIPELINE_JOBS_LATEST_PATH, {});
  }
}

function getPipelineJobLastSignalMs(job: PipelineProcessJob) {
  const signal = job.heartbeatAt ?? job.updatedAt ?? job.startedAt ?? job.createdAt;
  const value = new Date(signal).getTime();
  return Number.isFinite(value) ? value : 0;
}

function isPipelineProcessJobStale(job: PipelineProcessJob, now = Date.now()) {
  if (!["queued", "running"].includes(job.status)) {
    return false;
  }

  if (job.finishedAt) {
    return true;
  }

  return now - getPipelineJobLastSignalMs(job) > PIPELINE_JOB_STALE_MS;
}

export async function abandonPipelineProcessJob(input?: {
  id?: string;
  reason?: string;
}) {
  noStore();

  const job = input?.id
    ? await getPipelineProcessJob(input.id)
    : await getLatestPipelineProcessJob();

  if (!job) {
    return null;
  }

  if (job.status === "queued" || job.status === "running") {
    if (typeof job.workerPid === "number") {
      try {
        process.kill(job.workerPid, "SIGTERM");
      } catch {
        // Worker may already be gone — still write the failed status so the heartbeat
        // detects the termination and stops itself.
      }
      // Give SIGTERM a moment, then follow up with SIGKILL if the process is still alive.
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      try {
        process.kill(job.workerPid, "SIGKILL");
      } catch {
        // Expected if SIGTERM already cleaned it up.
      }
    }

    const finishedAt = new Date().toISOString();
    const abandonedJob: PipelineProcessJob = {
      ...job,
      finishedAt,
      heartbeatAt: finishedAt,
      progressLabel: "Stopped",
      progressPercent: 100,
      stage: "Processor cleared from the UI",
      status: "failed",
      summary:
        input?.reason?.trim() ||
        "This pipeline processor was cleared manually so a fresh run can start.",
      output:
        job.output ??
        "No final summary was produced before the processor was cleared.",
      updatedAt: finishedAt,
      workerPid: null,
    };

    await writePipelineJob(abandonedJob);
    await clearLatestPipelineProcessJobReference(job.id);
    return abandonedJob;
  }

  return job;
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
          const sidecarText = await readCareerOpsTextFile(
            ...getIntelSidecarPath(opportunity.reportPath).split("/"),
          );
          const intel = buildOpportunityIntel({
            opportunity,
            evaluation,
            sidecar: parseOpportunityIntelSidecar(sidecarText),
          });

          opportunity.archetype = intel.roleSnapshot.archetype;
          opportunity.summary = intel.recommendation.summary;
          opportunity.remote = intel.roleSnapshot.workMode ?? intel.roleSnapshot.location;
          opportunity.compensation = intel.roleSnapshot.compensation;
          opportunity.jobUrl = evaluation.url;
        }),
      );

      return opportunities.sort((left, right) => left.num - right.num);
    },
  );
}

export async function getOpportunity(id: string): Promise<{
  evaluation: Evaluation | null;
  intel: OpportunityIntel | null;
  opportunity: Opportunity | null;
}> {
  noStore();
  const opportunities = await getOpportunities();
  const opportunity = opportunities.find((entry) => entry.id === id) ?? null;

  if (!opportunity?.reportPath) {
    return {
      opportunity,
      evaluation: null,
      intel: opportunity
        ? buildOpportunityIntel({ opportunity, evaluation: null })
        : null,
    };
  }

  const sidecarPath = getIntelSidecarPath(opportunity.reportPath);
  const signature = await getCareerOpsSignature(...opportunity.reportPath.split("/"));
  const sidecarSignature = await getCareerOpsSignature(...sidecarPath.split("/"));

  const evaluation = await readCached(`report:${opportunity.reportPath}`, signature, async () => {
    const raw = await readCareerOpsTextFile(...opportunity.reportPath!.split("/"));
    return raw ? parseReportMarkdown(raw, opportunity.reportPath) : null;
  });
  const sidecar = await readCached(`intel:${sidecarPath}`, sidecarSignature, async () => {
    const raw = await readCareerOpsTextFile(...sidecarPath.split("/"));
    return parseOpportunityIntelSidecar(raw);
  });
  const intel = buildOpportunityIntel({
    opportunity,
    evaluation: evaluation as Evaluation | null,
    sidecar: sidecar as OpportunityIntel | null,
  });

  return {
    opportunity,
    evaluation: evaluation as Evaluation | null,
    intel,
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

export async function startPendingPipelineProcess(input?: {
  directUrl?: string;
  limit?: number;
}): Promise<PipelineProcessStartResponse> {
  noStore();

  const activeJob = await getLatestPipelineProcessJob();
  if (activeJob && ["queued", "running"].includes(activeJob.status)) {
    if (isPipelineProcessJobStale(activeJob)) {
      await abandonPipelineProcessJob({
        id: activeJob.id,
        reason:
          "The previous pipeline processor stopped sending heartbeats and was cleared automatically before starting a fresh run.",
      });
    } else {
      return {
        job: activeJob,
        started: false,
      };
    }
  }

  const refreshedActiveJob = await getLatestPipelineProcessJob();
  if (refreshedActiveJob && ["queued", "running"].includes(refreshedActiveJob.status)) {
    return {
      job: refreshedActiveJob,
      started: false,
    };
  }

  const inboxBefore = await getPipelineInbox();
  const pendingBefore = inboxBefore.pending.length;
  const directUrl = input?.directUrl?.trim() || undefined;
  const requestedLimit = Number.isFinite(input?.limit)
    ? Math.trunc(input?.limit ?? 3)
    : 3;
  const limit = Math.min(10, Math.max(1, requestedLimit));
  // Direct evaluations always target exactly 1 URL and don't consume the queue.
  const attemptedCount = directUrl ? 1 : Math.min(limit, pendingBefore);
  const job = createPipelineJob({
    attemptedCount,
    pendingBefore,
    requestedLimit: directUrl ? 1 : limit,
  });

  if (!attemptedCount) {
    const completedJob: PipelineProcessJob = {
      ...job,
      finishedAt: new Date().toISOString(),
      output: "No pending items in data/pipeline.md.",
      pendingAfter: 0,
      progressLabel: "Nothing queued",
      progressPercent: 100,
      resolvedCount: 0,
      stage: "No pending pipeline items",
      status: "completed",
      summary: "There are no pending pipeline items to process right now.",
      updatedAt: new Date().toISOString(),
      workerPid: null,
    };

    await writePipelineJob(completedJob);

    return {
      job: completedJob,
      started: false,
    };
  }

  await writePipelineJob(job);

  const summaryPath = join(PIPELINE_JOBS_DIR, `${job.id}.summary.txt`);
  const pipelinePath =
    (await resolvePipelinePath()) ?? resolveCareerOpsFile("data", "pipeline.md");

  // Resolve the worker script and its arguments based on the configured provider.
  // PIPELINE_PROVIDER=claude (default) uses the Anthropic SDK worker.
  // PIPELINE_PROVIDER=codex falls back to the legacy Codex CLI runner.
  const provider = process.env.PIPELINE_PROVIDER ?? "claude";
  let workerPath: string;
  let workerArgs: string[];

  if (provider === "codex") {
    const codexCliPath = await resolveCodexCliPath();
    workerPath = resolvePath(process.cwd(), "scripts", "workers", "run-pipeline-job-codex.mjs");
    workerArgs = [
      workerPath,
      "--job-path", getPipelineJobPath(job.id),
      "--codex-cli", codexCliPath,
      "--career-ops-path", getCareerOpsPath(),
      "--summary-path", summaryPath,
      "--pipeline-path", pipelinePath,
      "--attempted", String(attemptedCount),
    ];
  } else {
    // Default: claude — uses the Anthropic SDK agentic loop
    workerPath = resolvePath(process.cwd(), "scripts", "workers", "run-pipeline-job-claude.mjs");
    workerArgs = [
      workerPath,
      "--job-path", getPipelineJobPath(job.id),
      "--career-ops-path", getCareerOpsPath(),
      "--summary-path", summaryPath,
      "--pipeline-path", pipelinePath,
      "--attempted", String(attemptedCount),
      ...(directUrl ? ["--direct-url", directUrl] : []),
    ];
  }

  const child = spawn(
    process.execPath,
    workerArgs,
    {
      cwd: process.cwd(),
      detached: true,
      env: buildLocalExecEnv(),
      stdio: "ignore",
    },
  );

  child.unref();

  await writePipelineJob({
    ...job,
    progressLabel: "Worker launched",
    progressPercent: 8,
    stage: "Background processor is starting",
    updatedAt: new Date().toISOString(),
    workerPid: child.pid ?? null,
  });

  return {
    job: {
      ...job,
      progressLabel: "Worker launched",
      progressPercent: 8,
      stage: "Background processor is starting",
      updatedAt: new Date().toISOString(),
      workerPid: child.pid ?? null,
    },
    started: true,
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

export type ApplyDraftKind = "cover-letter" | "outreach";

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

function truncateForPrompt(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[Truncated ${value.length - maxChars} characters.]`;
}

function compactProfileForPrompt(profile: UserProfile | null) {
  if (!profile) {
    return null;
  }

  return {
    candidate: {
      fullName: profile.candidate.fullName,
      location: profile.candidate.location,
      linkedin: profile.candidate.linkedin,
      portfolioUrl: profile.candidate.portfolioUrl,
      github: profile.candidate.github,
    },
    targetRoles: profile.targetRoles,
    narrative: profile.narrative,
    compensation: profile.compensation,
    location: profile.location,
  };
}

function buildApplyDraftPrompt(input: {
  kind: ApplyDraftKind;
  opportunity: Opportunity;
  profile: UserProfile | null;
  reportText: string;
}) {
  const isCoverLetter = input.kind === "cover-letter";
  const profileJson = JSON.stringify(compactProfileForPrompt(input.profile), null, 2);

  return [
    `Draft type: ${isCoverLetter ? "cover letter / application notes" : "short outreach message"}`,
    "",
    "Opportunity:",
    JSON.stringify(
      {
        company: input.opportunity.company,
        role: input.opportunity.role,
        status: input.opportunity.status,
        score: input.opportunity.score,
        archetype: input.opportunity.archetype,
        remote: input.opportunity.remote,
        compensation: input.opportunity.compensation,
        jobUrl: input.opportunity.jobUrl,
      },
      null,
      2,
    ),
    "",
    "Candidate profile:",
    profileJson,
    "",
    "Evaluation report:",
    truncateForPrompt(input.reportText, 45_000),
    "",
    "Instructions:",
    isCoverLetter
      ? [
          "- Write a polished but editable cover letter draft for this specific role.",
          "- Use concrete fit evidence from the report and profile; do not invent employers, metrics, names, or credentials.",
          "- Lead with the strongest CV matches, weave in important ATS keywords naturally, and preempt gaps without sounding defensive.",
          "- Keep it concise: 4 to 6 short paragraphs, plain text only, no markdown headings, no placeholders except [Hiring Manager] if no name is known.",
          "- Make the voice confident, warm, and specific rather than generic.",
        ].join("\n")
      : [
          "- Write a concise LinkedIn or email outreach draft to someone at the company.",
          "- Mention the role, one specific reason the candidate is a strong fit, and a clear low-friction ask.",
          "- Use concrete evaluation context and keywords naturally; do not invent mutual contacts or private company details.",
          "- Keep it under 130 words, plain text only, no markdown headings.",
          "- Include a subject line only if the format reads like email; otherwise write the message body directly.",
        ].join("\n"),
  ].join("\n");
}

export async function generateApplyDraft(input: {
  kind: ApplyDraftKind;
  opportunityId: string;
}): Promise<{ text: string }> {
  noStore();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.");
  }

  const [{ opportunity }, profile] = await Promise.all([
    getOpportunity(input.opportunityId),
    getProfile(),
  ]);

  if (!opportunity?.reportPath) {
    throw new Error("The selected opportunity does not have a report-backed evaluation yet.");
  }

  const reportText = await readCareerOpsTextFile(...opportunity.reportPath.split("/"));
  if (!reportText) {
    throw new Error("The evaluation report could not be read.");
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_APPLY_MODEL ?? "claude-sonnet-4-6",
    max_tokens: input.kind === "cover-letter" ? 1400 : 700,
    temperature: 0.35,
    system:
      "You are a senior job-search writing assistant. Produce specific, truthful, ready-to-edit application copy using only the provided report and profile context.",
    messages: [
      {
        role: "user",
        content: buildApplyDraftPrompt({
          kind: input.kind,
          opportunity,
          profile,
          reportText,
        }),
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Claude did not return draft text.");
  }

  return { text };
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
