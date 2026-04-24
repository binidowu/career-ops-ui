#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const HEARTBEAT_INTERVAL_MS = 5000;
const CODEX_TIMEOUT_MS = 1000 * 60 * 30;

function readFlag(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

async function writeJson(path, value) {
  await mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readOptionalText(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function countPendingItems(pipelinePath) {
  const raw = await readOptionalText(pipelinePath);
  return [...raw.matchAll(/^\s*- \[ \]/gm)].length;
}

async function updateJob(jobPath, transform) {
  const job = await readJson(jobPath);
  const next = transform(job);
  next.updatedAt = new Date().toISOString();
  await writeJson(jobPath, next);
}

async function runCodexExec(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1000).unref();
    }, CODEX_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const message = signal
        ? `Command terminated with signal ${signal}`
        : `Command failed with exit code ${code ?? "unknown"}`;
      const error = new Error(`${message}${stderr ? `\n${stderr}` : ""}`);
      error.stdout = stdout;
      error.stderr = stderr;
      error.code = code;
      reject(error);
    });
  });
}

async function main() {
  const jobPath = readFlag("--job-path");
  const codexCliPath = readFlag("--codex-cli");
  const careerOpsPath = readFlag("--career-ops-path");
  const summaryPath = readFlag("--summary-path");
  const pipelinePath = readFlag("--pipeline-path");
  const attemptedCount = Number(readFlag("--attempted") || "0");

  if (!jobPath || !codexCliPath || !careerOpsPath || !summaryPath || !pipelinePath) {
    throw new Error("Missing required job runner arguments.");
  }

  await updateJob(jobPath, (job) => ({
    ...job,
    heartbeatAt: new Date().toISOString(),
    progressLabel: "Worker booted",
    progressPercent: 12,
    stage: "Launching Codex pipeline worker",
    startedAt: new Date().toISOString(),
    status: "running",
  }));

  const prompt = [
    `Working inside the career-ops repository, process only the first ${attemptedCount} pending entries from data/pipeline.md using the Career-Ops pipeline workflow.`,
    "Follow the checked-in instructions from AGENTS.md, docs/CODEX.md, CLAUDE.md, and modes/pipeline.md.",
    `Do not process more than ${attemptedCount} pending items even if more remain in the inbox.`,
    "Use /opt/homebrew/bin/node when you need to invoke repository Node scripts.",
    "If tracker TSV additions are created during the run, merge them and verify integrity before finishing.",
    "At the end, output only a concise operator summary describing what was processed, what reports or PDFs were created, and any blockers encountered.",
  ].join("\n");

  const heartbeat = setInterval(() => {
    void (async () => {
      try {
        const current = await readJson(jobPath);
        // If the job was externally terminated (cleared from the UI), stop and exit.
        if (current.status === "failed" || current.status === "completed") {
          clearInterval(heartbeat);
          process.exit(0);
          return;
        }
      } catch {
        // Can't read job file — stop rather than keep writing blind.
        clearInterval(heartbeat);
        return;
      }
      void updateJob(jobPath, (job) => ({
        ...job,
        heartbeatAt: new Date().toISOString(),
        progressLabel: "Codex is processing the current batch",
        progressPercent: 58,
        stage: "Running backend pipeline workflow",
        status: "running",
      }));
    })();
  }, HEARTBEAT_INTERVAL_MS);

  try {
    await runCodexExec(
      codexCliPath,
      [
        "exec",
        "-C",
        careerOpsPath,
        "--full-auto",
        "--ephemeral",
        "--output-last-message",
        summaryPath,
        prompt,
      ],
      {
        cwd: careerOpsPath,
        env: process.env,
      },
    );

    await updateJob(jobPath, (job) => ({
      ...job,
      heartbeatAt: new Date().toISOString(),
      progressLabel: "Refreshing inbox state",
      progressPercent: 88,
      stage: "Reading updated pipeline files",
      status: "running",
    }));

    const summary = (await readOptionalText(summaryPath)).trim();
    const pendingAfter = await countPendingItems(pipelinePath);

    await updateJob(jobPath, (job) => ({
      ...job,
      finishedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      output: summary || null,
      pendingAfter,
      progressLabel: "Completed",
      progressPercent: 100,
      resolvedCount: Math.max(0, job.pendingBefore - pendingAfter),
      stage: "Batch finished",
      status: "completed",
      summary:
        summary ||
        `${Math.max(0, job.pendingBefore - pendingAfter)} pending item${Math.max(
          0,
          job.pendingBefore - pendingAfter,
        ) === 1 ? "" : "s"} moved out of the inbox.`,
    }));
  } catch (error) {
    const summary = (await readOptionalText(summaryPath)).trim();
    const message =
      summary ||
      (error instanceof Error ? error.message : "Unable to run the pending pipeline processor.");

    await updateJob(jobPath, (job) => ({
      ...job,
      finishedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      output: message,
      progressLabel: "Failed",
      progressPercent: 100,
      stage: "Processor stopped with an error",
      status: "failed",
      summary: message,
    }));
  } finally {
    clearInterval(heartbeat);
  }
}

await main();
