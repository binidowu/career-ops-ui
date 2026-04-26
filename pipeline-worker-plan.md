# Pipeline Worker — Implementation Plan

Last updated: 2026-04-26 (Phase 3 local decision + durable stale-lock recovery)

## Context

The pipeline processing fails from the UI but works from the terminal. Root cause: the terminal
uses Claude Code (with native browser, web fetch, and web search tools). The UI spawns the Codex
CLI in `--ephemeral --full-auto` mode, which runs in a sandbox without reliable Playwright access.

The pipeline mode (`modes/pipeline.md`) uses a 3-tier JD extraction strategy:

1. Playwright (preferred — required for SPAs like Greenhouse, Lever, Ashby)
2. WebFetch (fallback for static pages)
3. WebSearch (last resort)

Codex in the current sandbox cannot satisfy step 1. It attempts the job, fails silently on JD
extraction, runs a confused evaluation, and produces nothing — while still advancing the queue.
The process runs for 8+ minutes because Codex is genuinely trying, not because it is stuck.

## Target

Replace `codex exec` with a direct Anthropic SDK agentic loop that gives Claude the same tools
the terminal workflow uses. The UI becomes a thin status surface; the worker handles everything.

## Phases

---

### Phase 1 — Claude API Worker

**Status:** [x] Complete

**Goal:** Replace `codex exec` with an Anthropic SDK agentic loop. Makes pipeline work for ~80%
of URLs immediately.

**Why 80% and not 100%:** LinkedIn and login-gated portals require a real browser. WebFetch
cannot reach them. That gap is addressed in Phase 3.

#### What changes

**`package.json`**
- Add `@anthropic-ai/sdk`

**`.env.local`**
- Add `ANTHROPIC_API_KEY`
- Add `PIPELINE_PROVIDER=claude` (accepts `claude` or `codex`; defaults to `claude`)

**New file: `scripts/workers/run-pipeline-job-claude.mjs`**

An agentic tool-use loop. Sends the pipeline prompt to Claude with five tools:

| Tool | Purpose |
|---|---|
| `bash` | Run shell commands sandboxed to `careerOpsPath` — calls all existing scripts (`generate-pdf.mjs`, `merge-tracker.mjs`, `cv-sync-check.mjs`, etc.) |
| `read_file` | Read any file within the workspace |
| `write_file` | Write reports, update `pipeline.md`, write tracker additions |
| `web_fetch` | Fetch JD content from URLs — covers static pages and most ATS platforms |
| `web_search` | Fall back to search when direct fetch fails or content is thin |

Loop contract: send prompt → receive tool calls → execute tools → send results → repeat until
`end_turn`. The prompt references the same `CLAUDE.md` and `modes/pipeline.md` instructions the
terminal uses — same behavioral contract, same output format.

Progress is written to the job file at key stages (booting, running, finishing).

**`src/lib/api/career-ops.ts`** (around line 1320)

Add provider routing in `startPendingPipelineProcess`:
- Read `PIPELINE_PROVIDER` env var
- `claude` → spawn `scripts/workers/run-pipeline-job-claude.mjs`
- `codex` → spawn existing runner (renamed `scripts/workers/run-pipeline-job-codex.mjs`)

**`scripts/pipeline-job-runner.mjs`**
- Rename to `scripts/workers/run-pipeline-job-codex.mjs` (kept as legacy fallback)

#### Token cost note

A full pipeline evaluation (fetch JD + evaluate A-F + write report + PDF + tracker) will run
approximately 10k–30k tokens per role depending on JD length. Surface token usage in job output.

#### Files touched

- `package.json`
- `.env.local`
- `scripts/workers/run-pipeline-job-claude.mjs` ← new
- `scripts/workers/run-pipeline-job-codex.mjs` ← renamed from `scripts/pipeline-job-runner.mjs`
- `src/lib/api/career-ops.ts`

#### Checklist

- [x] Install `@anthropic-ai/sdk`
- [x] Add env vars to `.env.local` (`ANTHROPIC_API_KEY`, `PIPELINE_PROVIDER=claude`)
- [x] Create `scripts/workers/run-pipeline-job-claude.mjs` with agentic loop + five tools
- [x] Add bash tool with sandbox enforcement (commands restricted to `careerOpsPath`)
- [x] Add job file progress updates (boot, running, finishing)
- [x] Add token usage logging to job output
- [x] Update `startPendingPipelineProcess` in `career-ops.ts` to read `PIPELINE_PROVIDER`
- [x] Rename existing runner to `scripts/workers/run-pipeline-job-codex.mjs`
- [x] Set real `ANTHROPIC_API_KEY` in `.env.local`
- [x] Test: process 1 pending Greenhouse/Lever URL end to end — PolyAI Agent Designer, 3.1/5, PDF generated, tracker merged
- [x] Test: job status updates correctly in UI (queued → running → completed)
- [x] Test: report `.md` and PDF written to workspace
- [x] Test: tracker updated correctly — `verify-pipeline.mjs` 0 errors, 0 warnings
- [x] Test: `pipeline.md` item moved from Pendientes to Procesadas

**Post-launch fixes applied:**
- Switched model: Opus 4.7 → Sonnet 4.6 (3× cheaper, adequate quality for structured pipeline work)
- Dropped `effort: "high"` → `"medium"` (fewer redundant tool calls)
- Added tool result truncation (8 KB cap) — prevents one large file read from compounding across all subsequent requests
- Added conversation trimming (max 30 messages) — keeps context flat instead of growing 2K tokens per iteration
- Original cost: ~$4–6 per evaluation on Opus 4.7. Estimated after fixes: ~$0.30–0.60 on Sonnet 4.6
- Added `container` ID tracking for `web_search_20260209` / `web_fetch_20260209` dynamic filtering (fixes 400 error on multi-call loops)
- Added Direct Evaluate feature: process any URL immediately without touching the queue

---

### Phase 2 — Capability Routing

**Status:** [x] Complete (implemented differently from plan)

**Approach used:** Behavioral detection via worker system prompt rather than a static domain
classifier. The worker instructions tell Claude to inspect every `web_fetch` response for gating
signals (login walls, CAPTCHA, <150 words of JD content, JS-only pages, HTTP errors) and mark
the item `[!]` without attempting an evaluation. Works for any site regardless of domain.

This replaced the planned `classify-url.ts` approach, which would have needed constant maintenance
as new gating patterns appeared.

**Also done:**
- Manually marked the two stuck LinkedIn items in `data/pipeline.md` as `[!]`, unblocking the
  queue — PolyAI is now first.
- Confirmed behavioral detection works: Greenhouse URLs processed cleanly, gated URLs skip.

#### Checklist

- [x] Add behavioral gating detection to worker system prompt
- [x] Write `[!]` marker + reason for gated items
- [x] Manually clear stuck LinkedIn items from queue top
- [ ] Test: mixed batch — gated URL skips, next item processes cleanly (not yet run)

---

### Phase 3 — Browser Capability

**Status:** [x] Option C selected for local worker
**Depends on:** Phase 2 complete

**Goal:** Decide how to handle the remaining ~20% of URLs that require a real browser
(LinkedIn, login walls, dynamic SPAs).

Decision: do not add local browser capability now. The worker already detects gated/browser-heavy
URLs behaviorally and marks them `[!]` with a clear skip reason. Browser automation should be
revisited with Phase 5 deployment architecture, because local Playwright may be throwaway work
if the eventual worker runs in a different environment.

#### Option A — Playwright tool in the Claude worker

Add a sixth tool to the Claude worker that spawns a headless Chromium instance and returns
rendered page content. Playwright is already a dependency in the career-ops repo.

- Pros: solves LinkedIn locally, no new external dependency, same tool-use contract
- Cons: adds meaningful complexity, Playwright on a server is heavy, doesn't translate cleanly to cloud

#### Option B — Anthropic computer use API

Use Claude's computer use beta to drive a real browser via screenshot interaction.

- Pros: most capable, works in cloud environments, no local Playwright needed
- Cons: significantly more expensive per job, higher latency, more complex to implement

#### Option C — Document the gap, skip for now

LinkedIn items stay as `[!]` with a "paste JD text directly" instruction. The terminal handles
browser-heavy items. The UI handles everything else.

- Pros: no implementation cost, correct behaviour (honest about the limitation)
- Cons: LinkedIn items cannot be processed from the UI at all

**Selected for now.** Both A and B should be revisited once deployment architecture is clear
(a cloud worker changes the calculus entirely).

#### Checklist

- [x] Make decision: A, B, or C
- [x] If C: document browser-heavy URL limitation in this plan
- [x] If C: rely on worker prompt gating message rather than a domain classifier
- [ ] If A: implement Playwright tool, add capability flag to worker
- [ ] If B: implement computer use loop, document token cost implications

---

### Phase 4 — Durable Job State

**Status:** [x] Complete

**Goal:** Move job state off `/tmp`. Jobs currently disappear on restart and cannot survive
deployments.

#### What changed

`PIPELINE_JOBS_DIR` in `career-ops.ts` now resolves to `{CAREER_OPS_PATH}/.career-ops-ui/jobs/`
when `CAREER_OPS_PATH` is set, falling back to `/tmp` during build or if the env var is missing.
Existing job files migrated from `/tmp` to the new location manually.

Durability hardening added after migration:

- Active job staleness is now heartbeat-based instead of elapsed-time-based.
- `queued` and `running` jobs with no recent heartbeat/update are recoverable.
- Starting a new processor auto-clears a stale active lock before creating the fresh job.
- The scans UI exposes stale runs with recovery copy and enables retry paths when the lock is stale.

#### Checklist

- [x] Update `PIPELINE_JOBS_DIR` constant in `career-ops.ts` (env-var driven, /tmp fallback)
- [x] `ensurePipelineJobsDir()` already uses `mkdir -p` — no changes needed
- [x] Add `.career-ops-ui/` to career-ops `.gitignore`
- [x] Migrate existing job files from `/tmp` to new location
- [x] Add stale-lock recovery for restart/dead-worker cases
- [x] Verify build/type safety after stale-lock recovery

---

### Phase 5 — Deployment-Ready Worker

**Status:** [ ] Design pending  
**Depends on:** Phases 1–4 complete

**Goal:** Move from "local CLI subprocess" to a worker model that can run in a deployed
environment with real users.

This phase requires decisions that affect the whole stack. Design separately once Phases 1–4 are
stable.

#### Open questions before designing

- What hosts the Next.js app? (Vercel, Railway, VPS, self-hosted)
- What runs long-running workers? (Serverless cannot hold a 10-minute job)
- What is the queue mechanism? (Upstash, Inngest, database polling, file-based)
- How does the worker authenticate with the Anthropic API in a multi-user context?
- Who pays for API tokens per user?
- Does the career-ops workspace live on the server or is it user-supplied?

#### Likely architecture shape

```
UI (Next.js)
  └── POST /api/pipeline/process → enqueue job
  └── GET /api/pipeline/process?jobId=X → poll status

Queue (Upstash Redis or similar)
  └── job record with type, provider, capabilities, status

Worker (separate long-running process or dedicated server)
  └── pulls from queue
  └── runs Claude API agentic loop
  └── writes results back to job record + workspace files
  └── signals completion

UI
  └── reads job status
  └── refreshes workspace data
```

#### Checklist

- [ ] Answer the open questions above
- [ ] Choose hosting and queue mechanism
- [ ] Design worker deployment (container, VM, or managed)
- [ ] Plan API key management per user or per deployment
- [ ] Plan workspace storage for deployed context
- [ ] Write Phase 5 implementation details once design is settled

---

## Progress Summary

| Phase | Status | Blocks |
|---|---|---|
| 1 — Claude API Worker | [x] Complete + cost mitigations applied | — |
| 2 — Capability Routing | [x] Complete (behavioral, not domain-based) | — |
| 3 — Browser Capability | [x] Option C selected for local worker | Revisit in Phase 5 |
| 4 — Durable Job State | [x] Complete | — |
| 5 — Deployment Worker | [ ] Design pending | Phases 1–4 |

## Key Files Reference

| File | Role |
|---|---|
| `scripts/workers/run-pipeline-job-claude.mjs` | New Claude API worker (Phase 1) |
| `scripts/workers/run-pipeline-job-codex.mjs` | Renamed legacy Codex worker |
| `src/lib/api/career-ops.ts:1320` | Provider routing in `startPendingPipelineProcess` |
| `scripts/workers/run-pipeline-job-claude.mjs` | Behavioral gated URL detection and `[!]` skip instructions |
| `src/lib/types.ts` | Job state type extensions (Phase 2) |
| `src/components/scans/ScansWorkspace.tsx` | UI — surfaces skip/error info |
| `.env.local` | `ANTHROPIC_API_KEY`, `PIPELINE_PROVIDER` |
| `career-ops/modes/pipeline.md` | Pipeline workflow instructions (unchanged) |
| `career-ops/modes/auto-pipeline.md` | Single-role evaluation instructions (unchanged) |
