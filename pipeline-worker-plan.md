# Pipeline Worker — Implementation Plan

Last updated: 2026-04-26 (Phase 5 design patched — path fix, git sync helper, LinkedIn scope correction)

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

**Status:** [ ] Design complete (patched), implementation pending
**Depends on:** Phases 1–4 complete

**Goal:** Move from "local CLI subprocess" to a deployed worker accessible from anywhere, with
the career-ops workspace synced via git.

**Single-user assumption:** This is a personal tool. No multi-tenancy, no external queue, no
per-user billing. The current `spawn({ detached: true })` worker model translates to a container
without changes.

#### Architecture decisions

| Question | Decision | Reason |
|---|---|---|
| Hosting | Railway | Long-running Node.js process, persistent volumes, git deploys, no cold starts |
| Worker model | Keep current spawn pattern | Works inside a container; no queue service needed |
| Queue | None (file-based, already durable) | Single user, low concurrency, job state already lives in `CAREER_OPS_PATH` |
| Workspace | Private git repo + deploy key | Worker pulls before each job, pushes after; local machine stays in sync via git pull |
| Auth | `AUTH_PASSWORD` + `AUTH_SECRET` env vars | Already implemented — middleware + login page are done |
| API key | Single `ANTHROPIC_API_KEY` env var | Personal tool, one key |
| Browser capability | Playwright (Phase 3 Option A, now unblocked) | Real server with persistent storage; Chromium installs cleanly in a container |
| Scale | Single Railway replica only | File-backed job state + spawned workers are not safe under multiple replicas sharing one volume |

---

#### Phase 5A — Containerize

**`railway.toml`** (new file)

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node scripts/startup.mjs && next start -p $PORT"
healthcheckPath = "/api/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
```

Nixpacks auto-detects Next.js from `package.json`. No Dockerfile needed unless the Playwright
install (Phase 5D) requires a custom base image.

**New: `src/app/api/health/route.ts`**

```ts
export function GET() {
  return Response.json({ ok: true, timestamp: new Date().toISOString() });
}
```

Used by Railway health checks. Public path (no auth required — add `/api/health` to
`PUBLIC_PATHS` in `middleware.ts`).

**New: `scripts/startup.mjs`**

Runs once before `next start`. Responsibilities:
- Validate required env vars (`ANTHROPIC_API_KEY`, `AUTH_PASSWORD`, `AUTH_SECRET`, `CAREER_OPS_PATH`)
- If `CAREER_OPS_GIT_REPO` is set: write deploy key from `CAREER_OPS_GIT_DEPLOY_KEY` (base64)
  to a temp SSH key file, then clone or pull the career-ops repo into `CAREER_OPS_PATH`
- Exit 1 on validation failure so Railway surfaces the misconfiguration immediately

**`middleware.ts`** — add `/api/health` to `PUBLIC_PATHS`

---

#### Phase 5B — Workspace Git Sync

The career-ops workspace is a private git repo. The deployed worker reads and writes it, then
pushes changes back so the local machine can `git pull` to see new reports and tracker updates.

**New env vars:**

| Var | Purpose |
|---|---|
| `CAREER_OPS_GIT_REPO` | SSH URL of private career-ops repo (`git@github.com:user/career-ops.git`) |
| `CAREER_OPS_GIT_DEPLOY_KEY` | Base64-encoded ed25519 private key with write access to the repo |
| `CAREER_OPS_GIT_USER_NAME` | Git commit author name (e.g. `Career Ops Worker`) |
| `CAREER_OPS_GIT_USER_EMAIL` | Git commit author email |

**New: `scripts/workspace-sync.mjs`**

A dedicated sync helper instead of inline shell strings. Called as a subprocess from the worker:
`node scripts/workspace-sync.mjs <careerOpsPath> <action> [commitMessage]`

Actions:
- `pull` — stash any dirty files, `git pull --ff-only`, pop stash; exit 0 on success, non-zero on conflict
- `push <message>` — `git add -A`; if nothing staged, exit 0 cleanly; commit with message; `git push`; exit non-zero on push failure

Output contract: writes a single JSON line to stdout:
```json
{ "action": "pull", "status": "pulled" | "clean" | "conflict" | "skipped", "detail": "..." }
{ "action": "push", "status": "pushed" | "nothing_to_commit" | "push_failed", "detail": "..." }
```

Worker reads this JSON and appends sync status to job output. A `push_failed` status is surfaced
as a warning in the job output (not a job failure — results are on disk, just not yet in git).
A `conflict` on pull surfaces as a warning; the worker continues with local state.

**`scripts/workers/run-pipeline-job-claude.mjs`** — call the sync helper:

*Before the agentic loop (after job is marked `running`):*
```js
const pullResult = await runWorkspaceSync(uiRoot, careerOpsPath, "pull");
if (pullResult.status === "conflict") {
  appendJobOutput(jobPath, `[workspace-sync] pull conflict — continuing with local state: ${pullResult.detail}`);
}
```

*After the agentic loop (after job is marked `completed` or `failed`):*
```js
const pushResult = await runWorkspaceSync(uiRoot, careerOpsPath, "push",
  `pipeline: process ${resolvedCount} item(s) [worker]`);
if (pushResult.status === "push_failed") {
  appendJobOutput(jobPath, `[workspace-sync] WARNING: push failed — results written locally but not synced to git. Detail: ${pushResult.detail}`);
}
```

`uiRoot` is `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')` — the worker
already uses `import.meta.url` and this resolves to the UI repo root regardless of `cwd`.

---

#### Phase 5C — Deploy to Railway

1. Create Railway project connected to the UI repo (GitHub integration)
2. Attach a persistent volume mounted at `/data/career-ops`
3. Set env vars:

| Var | Value |
|---|---|
| `CAREER_OPS_PATH` | `/data/career-ops` |
| `ANTHROPIC_API_KEY` | existing key |
| `AUTH_PASSWORD` | strong passphrase |
| `AUTH_SECRET` | 64-char hex (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `CAREER_OPS_GIT_REPO` | SSH URL of career-ops repo |
| `CAREER_OPS_GIT_DEPLOY_KEY` | base64-encoded deploy key |
| `CAREER_OPS_GIT_USER_NAME` | `Career Ops Worker` |
| `CAREER_OPS_GIT_USER_EMAIL` | adebayormide@gmail.com |
| `NODE_ENV` | `production` |

4. Deploy → `startup.mjs` clones career-ops → Next.js starts → login works
5. Process one pipeline job end-to-end from deployed URL
6. Verify the commit appears in the career-ops git repo
7. `git pull` locally and confirm the report and tracker update are present

---

#### Phase 5D — Playwright Tool (Phase 3 Option A, now unblocked)

The worker now runs on a real server. Chromium installs cleanly. This unblocks JS-rendered public
pages (Lever, Ashby, some Greenhouse embeds). It does **not** solve login-walled or anti-bot pages
— LinkedIn, authenticated portals, and CAPTCHA-gated pages still skip with `[!]`. The gating
detection added in Phase 2 remains the fallback for anything Playwright also cannot access.

**`package.json`** — add dependency:
```json
"playwright": "^1.x"
```
The `playwright` package is required at runtime; `npx playwright install chromium` only installs
the browser binary and requires the package to already be present.

**Build change — `nixpacks.toml`** (new file, overrides Nixpacks defaults):

```toml
[phases.setup]
aptPkgs = [
  "libnss3", "libatk1.0-0", "libatk-bridge2.0-0", "libcups2",
  "libdrm2", "libxkbcommon0", "libxcomposite1", "libxdamage1",
  "libxfixes3", "libxrandr2", "libgbm1", "libasound2"
]

[phases.install]
cmds = ["npm ci", "npx playwright install chromium"]
```

Verify this list against Railway's base image before deploying — apt package names vary by
distro version. `playwright install --dry-run` reports missing deps.

**New: `scripts/workers/playwright-fetch.mjs`**

Standalone script invoked via the worker's `bash` tool. Usage:
`node <UI_ROOT>/scripts/workers/playwright-fetch.mjs <url>`

- Launches headless Chromium via Playwright
- Navigates to URL, waits for `networkidle` (max 30s)
- Returns page text to stdout (capped at 8 KB)
- Exits non-zero on navigation error or timeout

**`scripts/workers/run-pipeline-job-claude.mjs`** — two changes:

*1. Compute `uiRoot` at startup (used for both workspace-sync and playwright-fetch):*
```js
import { fileURLToPath } from "node:url";
const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
```

*2. System prompt addition:*
"If `web_fetch` returns thin or empty content for a URL, run the bash command:
`node <UI_ROOT>/scripts/workers/playwright-fetch.mjs '<url>'`
(substitute `<UI_ROOT>` with the actual absolute path passed in the system prompt).
This fetches using a real headless browser. It works for JS-rendered public job pages.
It does NOT work for login-gated pages — if the result is a login wall, mark the item `[!]`."

The worker interpolates the actual `uiRoot` value into the system prompt at startup, so Claude
receives an absolute path and the bash tool's `cwd: careerOpsPath` is irrelevant.

No new tool contract needed — Playwright is a capability invoked via the existing `bash` tool.

**After Phase 5D:** re-queue `[!]` items that were marked due to JS rendering (Lever, Ashby) as
`[ ]` and verify they process. LinkedIn `[!]` items stay as-is.

---

#### Files touched

| File | Change |
|---|---|
| `package.json` | add `playwright` runtime dependency (Phase 5D) |
| `railway.toml` | new — Railway build/deploy config |
| `nixpacks.toml` | new — Playwright apt deps + Chromium install |
| `scripts/startup.mjs` | new — env validation + git clone/pull on boot |
| `scripts/workspace-sync.mjs` | new — pull/push helper with explicit status output |
| `scripts/workers/playwright-fetch.mjs` | new — headless Chromium page fetcher |
| `scripts/workers/run-pipeline-job-claude.mjs` | add `uiRoot`, call workspace-sync, add Playwright system prompt |
| `src/app/api/health/route.ts` | new — health check endpoint |
| `src/middleware.ts` | add `/api/health` to PUBLIC_PATHS |

#### Checklist

**5A — Containerize:**
- [ ] Read `node_modules/next/dist/docs/` for any Next.js 16 build/start changes before writing config
- [ ] Write `scripts/startup.mjs` (env validation, git clone/pull, SSH key setup)
- [ ] Add `GET /api/health` route
- [ ] Add `railway.toml`
- [ ] Add `/api/health` to `PUBLIC_PATHS` in `middleware.ts`

**5B — Workspace sync:**
- [ ] Generate ed25519 deploy key for career-ops repo with write access
- [ ] Write `scripts/workspace-sync.mjs` with pull/push actions and JSON status output
- [ ] Compute `uiRoot` from `import.meta.url` in worker
- [ ] Call `workspace-sync.mjs pull` before agentic loop; log conflict warnings to job output
- [ ] Call `workspace-sync.mjs push` after agentic loop; log `push_failed` warnings to job output
- [ ] Test locally: run worker, verify sync JSON output and that push appears in career-ops repo

**5C — Deploy:**
- [ ] Create Railway project from UI repo
- [ ] Attach persistent volume at `/data/career-ops`
- [ ] Set all env vars listed above
- [ ] Deploy and verify `startup.mjs` clones career-ops successfully
- [ ] Verify login works at deployed URL
- [ ] Run one pipeline job end-to-end from deployed URL
- [ ] Confirm commit appears in career-ops git repo
- [ ] `git pull` locally and verify report + tracker update arrived

**5D — Playwright:**
- [ ] Add `playwright` to `package.json` dependencies
- [ ] Write `nixpacks.toml` with Chromium apt deps + install step
- [ ] Verify apt package list with `playwright install --dry-run` against Railway base image
- [ ] Write `scripts/workers/playwright-fetch.mjs`
- [ ] Add Playwright bash instruction to worker system prompt (with interpolated `uiRoot` absolute path)
- [ ] Confirm instruction explicitly says: login-walled/anti-bot pages still skip with `[!]`
- [ ] Test: process one Lever or Ashby URL that was previously `[!]` due to JS rendering
- [ ] Re-queue JS-rendered `[!]` items as `[ ]`; leave LinkedIn `[!]` items as-is

---

## Progress Summary

| Phase | Status | Blocks |
|---|---|---|
| 1 — Claude API Worker | [x] Complete + cost mitigations applied | — |
| 2 — Capability Routing | [x] Complete (behavioral, not domain-based) | — |
| 3 — Browser Capability | [x] Option C selected for local worker | Revisit in Phase 5 |
| 4 — Durable Job State | [x] Complete | — |
| 5 — Deployment Worker | [ ] Design complete — 5A/5B/5C/5D pending | Phases 1–4 ✓ |

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
| `railway.toml` | Railway build/deploy config (Phase 5) |
| `nixpacks.toml` | Nixpacks overrides — Chromium install (Phase 5D) |
| `scripts/startup.mjs` | Container boot — env validation + git clone/pull (Phase 5) |
| `scripts/workers/playwright-fetch.mjs` | Headless Chromium page fetcher (Phase 5D) |
| `src/app/api/health/route.ts` | Railway health check endpoint (Phase 5A) |
