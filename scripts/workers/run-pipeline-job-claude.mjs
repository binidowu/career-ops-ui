#!/usr/bin/env node
/**
 * Claude API pipeline worker.
 *
 * Replaces `codex exec` with a direct Anthropic SDK agentic loop that gives
 * Claude the same tools the terminal workflow uses:
 *   - bash      (client-side, sandboxed to careerOpsPath)
 *   - read_file (client-side)
 *   - write_file (client-side)
 *   - web_search (server-side — Anthropic handles execution)
 *   - web_fetch  (server-side — Anthropic handles execution)
 */

import Anthropic from "@anthropic-ai/sdk";
import { exec } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const HEARTBEAT_INTERVAL_MS = 5000;
const MAX_ITERATIONS = 60; // safety limit — one evaluation ≈ 10–15 iterations

// ── Arg parsing ──────────────────────────────────────────────────────────────

function readFlag(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
}

// ── Job file helpers ─────────────────────────────────────────────────────────

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
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

// ── Tool execution ────────────────────────────────────────────────────────────

// Cap individual tool results so one large file read can't bloat every
// subsequent request. ~8 KB is enough for any JD or report section.
const MAX_TOOL_RESULT_CHARS = 8_000;

function truncateResult(text) {
  if (text.length <= MAX_TOOL_RESULT_CHARS) return text;
  return (
    text.slice(0, MAX_TOOL_RESULT_CHARS) +
    `\n\n[...truncated — ${text.length - MAX_TOOL_RESULT_CHARS} chars omitted. Use bash to read specific sections if needed.]`
  );
}

function resolvePath(careerOpsPath, filePath) {
  if (isAbsolute(filePath)) return filePath;
  return join(careerOpsPath, filePath);
}

async function executeTool(name, input, careerOpsPath) {
  switch (name) {
    case "bash": {
      try {
        const { stdout, stderr } = await execAsync(input.command, {
          cwd: careerOpsPath,
          timeout: 120_000,
          maxBuffer: 1024 * 1024 * 10,
          env: {
            ...process.env,
            PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ""}`,
          },
        });
        const out = (stdout ?? "").trim();
        const err = (stderr ?? "").trim();
        const raw = (out && err) ? `${out}\nSTDERR: ${err}` : (out || err || "(command completed with no output)");
        return truncateResult(raw);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const out = (error.stdout ?? "").trim();
        const err = (error.stderr ?? "").trim();
        const raw = [
          `ERROR: ${msg}`,
          out ? `STDOUT: ${out}` : "",
          err ? `STDERR: ${err}` : "",
        ].filter(Boolean).join("\n");
        return truncateResult(raw);
      }
    }

    case "read_file": {
      try {
        const filePath = resolvePath(careerOpsPath, input.path);
        const content = await readFile(filePath, "utf8");
        return truncateResult(content || "(empty file)");
      } catch (error) {
        return `ERROR reading ${input.path}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    case "write_file": {
      try {
        const filePath = resolvePath(careerOpsPath, input.path);
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, input.content, "utf8");
        return `Written: ${filePath}`;
      } catch (error) {
        return `ERROR writing ${input.path}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    default:
      return `Unknown client-side tool: ${name}`;
  }
}

// ── Context trimming ──────────────────────────────────────────────────────────
// Each tool call appends ~2 messages (assistant + user/tool_result) to the
// history. Without trimming, the context compounds on every API call and costs
// explode. This removes the oldest turns while always preserving messages[0]
// (the initial instruction) so Claude knows what it's doing.
//
// Messages layout: [user_instruction, assistant, user/results, assistant, ...]
// A "turn" = one [assistant, user] pair. We splice from position 1 in pairs.
const MAX_HISTORY_MESSAGES = 30; // 1 instruction + 14 turns * 2 = 29 + 1

function trimMessages(messages) {
  while (messages.length > MAX_HISTORY_MESSAGES) {
    // Remove the oldest assistant+user pair (always at positions 1 and 2)
    messages.splice(1, 2);
  }
  return messages;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const jobPath = readFlag("--job-path");
  const careerOpsPath = readFlag("--career-ops-path");
  const summaryPath = readFlag("--summary-path");
  const pipelinePath = readFlag("--pipeline-path");
  const attemptedCount = Number(readFlag("--attempted") || "0");
  // Direct evaluate mode: process a specific URL without touching pipeline.md
  const directUrl = readFlag("--direct-url");

  if (!jobPath || !careerOpsPath || !summaryPath || !pipelinePath) {
    throw new Error("Missing required arguments: --job-path --career-ops-path --summary-path --pipeline-path --attempted");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server. " +
      "Set PIPELINE_PROVIDER=codex to fall back to the Codex runner while you configure the key.",
    );
  }

  // Mark running
  await updateJob(jobPath, (job) => ({
    ...job,
    heartbeatAt: new Date().toISOString(),
    progressLabel: "Claude worker booted",
    progressPercent: 10,
    stage: "Loading workspace instructions",
    startedAt: new Date().toISOString(),
    status: "running",
  }));

  // ── Load workspace instructions into the system prompt ────────────────────
  // Including them upfront means Claude doesn't waste a tool call reading them,
  // and they're cached across all API calls within this job (5-min TTL).
  const [claudeMd, pipelineMd, sharedMd, profileMd] = await Promise.all([
    readOptionalText(join(careerOpsPath, "CLAUDE.md")),
    readOptionalText(join(careerOpsPath, "modes", "pipeline.md")),
    readOptionalText(join(careerOpsPath, "modes", "_shared.md")),
    readOptionalText(join(careerOpsPath, "modes", "_profile.md")),
  ]);

  const systemPrompt = [
    `You are the Career-Ops pipeline processor. You are running inside the career-ops workspace at: ${careerOpsPath}`,
    "",
    "Your task is to process pending job URL entries from data/pipeline.md following the instructions below.",
    "",
    "═══ WORKSPACE INSTRUCTIONS (CLAUDE.md) ═══",
    claudeMd || "(CLAUDE.md not found — proceed using the pipeline instructions below)",
    "",
    "═══ PIPELINE MODE (modes/pipeline.md) ═══",
    pipelineMd || "(modes/pipeline.md not found)",
    "",
    "═══ SHARED CONTEXT (modes/_shared.md) ═══",
    sharedMd || "(not found)",
    "",
    "═══ PROFILE (modes/_profile.md) ═══",
    profileMd || "(not found)",
    "",
    "═══ TOOL CONSTRAINTS ═══",
    "- bash: always runs with careerOpsPath as the working directory",
    "- Use /opt/homebrew/bin/node for Node.js scripts",
    "- Never submit applications on behalf of the user",
    "- web_fetch and web_search are available for fetching job descriptions",
    "",
    "═══ GATED URL DETECTION (applies to every URL you process) ═══",
    "After calling web_fetch on a URL, inspect the response BEFORE attempting an evaluation.",
    "If the response shows any of the following signals, the URL is gated and cannot be processed:",
    "  - Login / sign-in / join / authentication wall (e.g. 'Sign in to view', 'Join to apply')",
    "  - CAPTCHA or bot-detection page",
    "  - HTTP error in the response body (401, 403, 429, 5xx)",
    "  - Redirect to a homepage or unrelated page instead of a job posting",
    "  - Very little text (fewer than ~150 words) with no recognisable job description content",
    "  - JavaScript-only page (page source is mostly <script> tags with no readable JD text)",
    "When a URL is gated, DO NOT attempt an evaluation and DO NOT use web_search as a workaround.",
    "Instead: mark the item `- [!] URL — Skipped: URL requires authentication or browser rendering.",
    "Process from the terminal with Claude Code where browser tools are available.`",
    "Then move on to the next pending item.",
    "This rule applies to every site regardless of domain — LinkedIn, Indeed, Glassdoor, or any",
    "other site that gates its content behind a login or JavaScript rendering.",
  ].join("\n");

  const userMessage = directUrl
    ? [
        `Evaluate the following job URL using the full Career-Ops pipeline workflow:`,
        "",
        `URL: ${directUrl}`,
        "",
        "Steps:",
        "1. Calculate the next sequential report number (check the reports/ directory)",
        "2. Fetch the job description using web_fetch (fall back to web_search if needed)",
        "3. If the URL is inaccessible, stop and report why — do not proceed",
        "4. Run the full A-F evaluation following the mode instructions in CLAUDE.md",
        "5. Write the evaluation report to reports/",
        "6. Generate a PDF if score >= 3.0 (use `node generate-pdf.mjs`)",
        "7. Update the tracker using the TSV addition flow then `node merge-tracker.mjs`",
        "",
        "IMPORTANT: Do NOT modify data/pipeline.md. This is a direct evaluation, not a queue item.",
        "",
        "When finished, provide a concise summary including the role, company, score, and report path.",
      ].join("\n")
    : [
        `Process the first ${attemptedCount} pending entr${attemptedCount === 1 ? "y" : "ies"} from data/pipeline.md.`,
        "",
        "Follow modes/pipeline.md exactly. For each pending item (marked `- [ ]`):",
        "1. Calculate the next sequential report number (check the reports/ directory)",
        "2. Call web_fetch on the URL and CHECK the response before doing anything else",
        "   - If the response is gated (login wall, CAPTCHA, JS-only, HTTP error, < 150 words of JD content),",
        "     mark it `- [!] URL — Skipped: requires authentication or browser rendering.` and move on",
        "   - Do NOT use web_search as a workaround for a gated URL",
        "3. If the content looks like a real job posting, run the full A-F evaluation",
        "4. Write the evaluation report to reports/",
        "5. Generate a PDF if score >= 3.0 (use `node generate-pdf.mjs`)",
        "6. Update the tracker using the TSV addition flow then `node merge-tracker.mjs`",
        "7. Move the item from Pendientes to Procesadas in data/pipeline.md",
        "",
        "When finished, write a concise summary of what was processed, what was skipped, and any blockers.",
      ].join("\n");

  const tools = [
    {
      name: "bash",
      description: `Execute a shell command. Runs with ${careerOpsPath} as the working directory. Use for Node scripts, file listings, and system operations.`,
      input_schema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Shell command to run",
          },
        },
        required: ["command"],
      },
    },
    {
      name: "read_file",
      description: "Read the content of a file. Paths are relative to the career-ops directory unless absolute.",
      input_schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path (relative to career-ops dir, or absolute)",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description: "Write content to a file. Parent directories are created automatically. Paths are relative to career-ops unless absolute.",
      input_schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path to write",
          },
          content: {
            type: "string",
            description: "Content to write",
          },
        },
        required: ["path", "content"],
      },
    },
    // Server-side tools — Anthropic executes these, no client handler needed
    { type: "web_search_20260209", name: "web_search" },
    { type: "web_fetch_20260209", name: "web_fetch" },
  ];

  const client = new Anthropic({ apiKey });

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  // Checks for external termination before each write so a UI clear operation
  // isn't re-corrupted by a stale heartbeat (see ScansWorkspace processIsStale fix).
  const heartbeat = setInterval(() => {
    void (async () => {
      try {
        const current = await readJson(jobPath);
        if (current.status === "failed" || current.status === "completed") {
          clearInterval(heartbeat);
          process.exit(0);
          return;
        }
      } catch {
        clearInterval(heartbeat);
        return;
      }
      void updateJob(jobPath, (job) => ({
        ...job,
        heartbeatAt: new Date().toISOString(),
        progressLabel: "Claude is processing the pipeline",
        progressPercent: 55,
        stage: "Running pipeline workflow",
        status: "running",
      }));
    })();
  }, HEARTBEAT_INTERVAL_MS);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let summary = "";

  try {
    await updateJob(jobPath, (job) => ({
      ...job,
      progressLabel: "Starting Claude API loop",
      progressPercent: 20,
      stage: "Claude API worker initialised",
      status: "running",
    }));

    const messages = [{ role: "user", content: userMessage }];
    let iterations = 0;
    // The web_search_20260209 and web_fetch_20260209 tools use dynamic filtering,
    // which spins up a code execution container on Anthropic's side. Once a container
    // is created, every subsequent request in this loop must pass its ID or the API
    // returns a 400 ("container_id is required when there are pending tool uses
    // generated by code execution with tools").
    let containerId = null;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        output_config: { effort: "medium" },
        system: [
          {
            type: "text",
            text: systemPrompt,
            // Cache the system prompt across all API calls within this job.
            // First call pays the write cost (~1.25x); subsequent calls within
            // 5 minutes read from cache (~0.1x). Worth it given the prompt size.
            cache_control: { type: "ephemeral" },
          },
        ],
        tools,
        messages,
        ...(containerId ? { container: containerId } : {}),
      });

      // Persist the container ID for dynamic-filtering continuity.
      if (response.container?.id) {
        containerId = response.container.id;
      }

      totalInputTokens +=
        (response.usage.input_tokens ?? 0) +
        (response.usage.cache_read_input_tokens ?? 0);
      totalOutputTokens += response.usage.output_tokens ?? 0;

      // Always append the full content block array so tool_use block IDs are preserved.
      messages.push({ role: "assistant", content: response.content });
      trimMessages(messages);

      if (response.stop_reason === "end_turn") {
        // Extract the final text summary
        for (const block of response.content) {
          if (block.type === "text" && block.text.trim()) {
            summary = block.text.trim();
          }
        }
        break;
      }

      if (response.stop_reason === "pause_turn") {
        // Server-side tools (web_search/web_fetch) hit the 10-iteration limit.
        // Re-send to continue the server-side loop.
        continue;
      }

      if (response.stop_reason === "tool_use") {
        const toolResults = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = await executeTool(block.name, block.input, careerOpsPath);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }
        if (toolResults.length > 0) {
          messages.push({ role: "user", content: toolResults });
        }
      }
    }

    if (iterations >= MAX_ITERATIONS && !summary) {
      summary = `Worker hit the ${MAX_ITERATIONS}-iteration safety limit. The pipeline may be partially complete — check reports/ and data/pipeline.md directly.`;
    }

    const tokenNote = `Tokens used: ${totalInputTokens.toLocaleString()} input, ${totalOutputTokens.toLocaleString()} output.`;
    const finalSummary = summary || "Pipeline processing completed.";
    await writeFile(summaryPath, `${finalSummary}\n\n${tokenNote}`, "utf8");

    const pendingAfter = await countPendingItems(pipelinePath);

    await updateJob(jobPath, (job) => ({
      ...job,
      finishedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      output: `${finalSummary}\n\n${tokenNote}`,
      pendingAfter,
      progressLabel: "Completed",
      progressPercent: 100,
      resolvedCount: Math.max(0, job.pendingBefore - pendingAfter),
      stage: "Batch finished",
      status: "completed",
      summary: finalSummary,
    }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Claude API worker failed.";

    await updateJob(jobPath, (job) => ({
      ...job,
      finishedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      output: message,
      progressLabel: "Failed",
      progressPercent: 100,
      stage: "Worker stopped with an error",
      status: "failed",
      summary: message,
    }));
  } finally {
    clearInterval(heartbeat);
  }
}

await main();
