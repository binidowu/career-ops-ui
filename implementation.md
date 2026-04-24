# Career-Ops UI — Code-Verified Implementation Ledger

Last updated: 2026-04-24 (Resume Studio hardening + backend quality fixes + Compare polish + Pipeline worker)

## Purpose

This file is the working implementation ledger for the UI repo.

It is not a planning wish list. It is a code-verified snapshot of what is currently:

- shipped,
- partially complete,
- still missing,
- and next in line.

The rule for this project remains the same:

If a workflow exists in the `career-ops` backend, the user should not need the terminal to benefit from it.

## Verification Method

This ledger was checked against the codebase, not just older planning notes.

Relevant routes, APIs, and implementation files reviewed for this update include:

- `src/middleware.ts`
- `src/lib/auth.ts`
- `src/app/login/page.tsx`
- `src/app/pipeline/page.tsx`
- `src/app/pipeline/[id]/page.tsx`
- `src/app/pipeline/[id]/apply/page.tsx`
- `src/app/pipeline/[id]/interview/page.tsx`
- `src/app/compare/page.tsx`
- `src/app/resumes/page.tsx`
- `src/app/apply/page.tsx`
- `src/app/scans/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/apply/[id]/route.ts`
- `src/app/api/interview-prep/generate/route.ts`
- `src/app/api/interview-prep/story-bank/route.ts`
- `src/app/api/profile/resume-sources/route.ts`
- `src/app/api/resumes/draft/route.ts`
- `src/app/api/resumes/export/route.ts`
- `src/app/api/scan/route.ts`
- `src/app/api/pipeline/route.ts`
- `src/app/api/system/checks/route.ts`
- `src/app/api/system/maintenance/route.ts`

## Executive Summary

The project is further along than some earlier docs suggest.

The app is no longer in a "build the missing shell" phase. Core routes, auth, browser-triggered ops checks, scans, apply surfaces, resume generation plumbing, and interview prep all exist in code.

The biggest remaining work is now:

1. hardening,
2. workflow depth,
3. data contract reliability,
4. and product polish.

## Current Status

### Shipped

#### App shell and navigation

- Root application shell exists.
- Top navigation is intentionally trimmed to core routes.
- Secondary routes are available through the command palette.
- Command palette supports grouped navigation and context-aware ranking.

#### Authentication and route protection

- Login route exists.
- Auth helpers exist.
- Protected-route middleware exists.
- Unauthenticated API requests return `401`.
- Unauthenticated page requests redirect to `/login`.

Status: implemented

#### Dashboard

- Dashboard route exists.
- Dashboard surfaces live workspace and opportunity summaries.
- Dashboard reflects tracker-backed data rather than static placeholders.

Status: implemented

#### Pipeline

- Pipeline table route exists.
- Opportunity detail route exists.
- Status and notes mutation flows exist.
- Evaluation-backed dossier review exists.

Status: implemented

#### Apply workspace

- Top-level apply route exists.
- Per-opportunity apply workspace exists.
- Apply data can be fetched and patched through the UI.
- Users can work with cover letter notes, outreach draft material, and applied date fields without the terminal.

Status: implemented

#### Compare workspace

- Compare route exists.
- Backend evaluation data is rendered side-by-side.
- Selection is URL-driven and shareable through query params.

Status: implemented, but still needs product polish

#### Resume Studio

- Resume route exists.
- Backend-backed draft generation exists.
- Resume export endpoint exists.
- Resume source upload endpoint exists.
- Multiple resume sources are supported in the data model and settings flow.

Status: implemented, but still uneven in quality and reliability

#### Interview prep workspace

- Dedicated per-opportunity interview prep route exists.
- Browser-triggered interview intel generation exists.
- Existing interview-prep assets are surfaced in the UI.
- Story bank editing exists in-browser.
- Structured interview intel rendering exists instead of raw markdown dumping.

Status: implemented, with room for deeper research capabilities

#### Scans and intake

- Dedicated scans route exists.
- Users can paste URLs or pipeline-style intake lines from the browser.
- Browser-triggered scanner execution exists.
- Browser-triggered pipeline processing works via Claude API (Sonnet 4.6 agentic loop with bash, read_file, write_file, web_fetch, web_search tools). Replaces non-functional Codex CLI path.
- Direct Evaluate: any single URL can be processed immediately without touching the pending queue.
- Gated URLs (login walls, CAPTCHA, JS-only pages) detected behaviorally and marked `[!]` automatically — no hardcoded domain list.
- Pending and processed inbox states are visible in the UI.
- Known cost: ~$0.30–0.60 per evaluation on Sonnet 4.6 after context trimming and result truncation mitigations.

Status: implemented

#### Settings and operations

- Profile editing exists.
- Resume source registration exists.
- Workspace health checks exist.
- Browser-triggered maintenance actions exist.
- Browser-triggered liveness checks exist.

Status: implemented

### Partially Complete

#### Resume Studio product quality

What exists:

- real draft generation,
- source selection,
- export path,
- inline editing controls,
- backend connectivity.

Hardening pass completed (2026-04-24):

- Sidebar headline/summary edits now persist to localStorage (was silently lost on refresh).
- Regenerate button now re-runs the current draft settings rather than cycling to the next variant.
- Preview experience entry heading layout now matches the PDF export (Role | Company with period as the date column).
- Source mismatch warning is now a clickable action that triggers regeneration.

Backend draft quality pass completed (2026-04-24):

- Fixed three regex mismatches in `resume-draft.mjs` that were silently producing wrong/empty data from every evaluation report:
  - Title regex: `# Evaluation: Company — Role` format was never matched, so `role` and `company` were always `"Unknown role"` / `"Unknown company"`.
  - Section regex: `## A) Heading` format was never matched, so `sections` was always `[]` — meaning summary extraction, nextSteps, and keyword scanning all fell back to empty.
  - Archetype regex: `**Archetype:** value` format was never matched, so archetype was always `""`.
- Keywords now use the `## Keywords (ATS)` section at the bottom of each report — curated by the evaluator — instead of guessing from text matches.
- Summary now uses the report's TL;DR (role-specific, evaluator-written) instead of hardcoded template strings about "React delivery" and "frontend delivery".
- Diagnostic notes now extract real personalization suggestions from section E instead of being empty.
- Resume section parser now accepts `## Experience`, `## Professional Experience`, etc. in addition to `## Work Experience`.
- Bullet parsing now handles `•`, `*`, and `◦` prefix styles in addition to `-`.
- `targetRoles` from resume sources is now passed through the entire chain from `resume-draft.mjs` → API type → UI.

What still needs work:

- Edit-state consistency when the base draft regenerates under existing overrides (deep UX issue, low frequency).
- Deeper trust signals for what the final compiled PDF will look like vs the preview.

Status: substantially complete — quality was primarily limited by parsing bugs, not generation capability

#### Apply and outreach depth

What exists:

- apply route,
- per-role apply workspace,
- notes and outreach-related fields,
- links to adjacent flows.

What still needs work:

- deeper assistant behavior,
- stronger draft generation,
- more deliberate outreach research support,
- better continuity between resume, apply, and interview-prep workflows.

Status: partial

#### Compare UX maturity

What exists:

- comparison route,
- selection model,
- evaluation-backed signals,
- readable comparison structure.

Compare polish pass completed (2026-04-24):

- Removed fake "Export .CSV" / "Lock Selection" buttons and "Active Protocol: CMP-88-V2" metadata that eroded trust.
- Replaced the "Weighted Algorithm Output" table (fake weights, "Model: V2.4b") with a ranked "Recommended Moves" list that names each company specifically.
- Added a "Decision Brief" card with a clear recommended focus role, trajectory signal, and critical gap callout.
- Added a "Next Action" row to the comparison grid so action intent is visible inline per role.
- Added contextual per-role action links: Detail, Apply (when not inactive), Prep (when at Interview/Offer stage).
- Made `getNextStep` text company-specific instead of generic status advice.
- Cleaned up jargon labels: "Evaluation Vectors" → "Comparison criteria", "Shortlist Console" → "Role Selector", "X/5 locked" → "X of 5 selected", "Compensation Matrix" → "Compensation", "Risk Factor" → "Risk", "Skill Alignment" → "CV Alignment".

Status: complete

#### Interview research depth

What exists:

- backend-connected intel generation,
- structured rendering,
- role-specific preparation workspace.

What still needs work:

- richer company-specific research,
- stronger sourcing model,
- deeper intelligence beyond deterministic report-derived generation.

Status: partial

#### Auth hardening

What exists:

- auth implementation,
- session cookie checks,
- login flow,
- protected routing.

Auth hardening pass completed (2026-04-24):

- Fixed open redirect: `from` param on login is now validated to be a relative path — external URLs fall back to `/`.
- Fixed logout requiring auth: `/api/auth/logout` added to public paths so an expired-session user can always clear their cookie without a 401 redirect loop.
- Added `getAuthConfigError()`: when `AUTH_PASSWORD` is set but `AUTH_SECRET` is missing or too short, the login endpoint now returns a clear actionable error message instead of a generic 500.
- Deduplicated `SESSION_DURATION_SECONDS` — now exported from `auth.ts` and reused in the login route.

Remaining known limitation: JWT sessions are stateless — a logout only clears the client cookie; the token itself remains cryptographically valid until its 30-day expiry. Acceptable for a personal workspace tool; would need a server-side revocation list for multi-user production use.

Status: hardened for personal use — not production-multi-user ready

#### Ops safety and operator clarity

What exists:

- maintenance actions in-browser,
- checks and verification in-browser.

Ops safety pass completed (2026-04-24):

- `dedup` now shows a persistent red warning callout before any interaction — the only command that permanently deletes rows.
- Confirm prompts are now operation-specific: dedup names permanent deletion and the count, normalize names corrections, merge names additions.
- Dedup confirm button uses a distinct destructive style (red border/background) vs the standard apply style.
- `UpdateCard` Rollback button is now hidden until an update has been applied in the current session — removing unconditional access to an irreversible operation.
- "Apply update" is disabled (with tooltip) when a check has been run and confirmed the system is already current.
- Rollback confirm prompt now explicitly states what reverts ("System scripts will return to the previous version").

Status: complete

Status: partial

### Missing or Thin

#### Mature outreach and contact research desk

There is apply support, but there is not yet a clearly mature browser workspace for:

- outreach strategy,
- contact intelligence,
- reusable networking research,
- and a polished end-to-end contact workflow.

Status: thin

#### Research, training, and project-evaluation modes

Some backend/operator workflows still do not appear to have first-class UI exposure.

These need a deliberate audit in the backend repo and then a decision on:

- whether they belong in the browser,
- where they should live,
- and what shape they should take for normal users.

Status: missing or not yet confirmed in the UI

#### Documentation parity

`implementation.md` itself had fallen behind the codebase before this rewrite.

Status: now corrected, but must be maintained continuously

## Important Corrections to Older Assumptions

The following assumptions were stale and should no longer be used for planning:

- Auth is not backend-only. It is implemented in the UI repo.
- Apply workflows are not backend-only. They already have browser surfaces.
- Scans/intake are not backend-only. They already have a dedicated browser workspace.
- Mutating maintenance commands are not terminal-only anymore. They are already exposed in settings.

That changes the roadmap substantially. The project is now mostly about hardening and depth, not initial exposure.

## Current Risks

### Resume quality can still feel like a frontend bug when it is actually a cross-stack issue

Thin or incomplete resume drafts may come from:

- sparse opportunity reports,
- weak resume source material,
- backend prompt behavior,
- or a brittle response shape.

This remains one of the main cross-stack risks in the product.

### Browser-exposed maintenance actions need disciplined safeguards

Because mutating operations are already in the UI, safety and clarity matter more now than before.

### Some workflows are present but not yet trustworthy enough to feel finished

This is especially true for:

- resumes,
- compare,
- apply/outreach depth,
- and interview research depth.

## Recommended Next Sprint

### 1. Resume Studio hardening

Goals:

- make generation more deterministic,
- clarify source selection and regenerate flows,
- make inline edits more trustworthy,
- tighten the frontend-backend contract for draft shape and export behavior.

Progress: complete. UX and contract bugs resolved first (sidebar persistence, regenerate behavior, heading layout parity, source mismatch action), then backend draft quality fixed — see below.

### 2. Pipeline worker cost and durability

Goals:

- move job state from `/tmp` to workspace-relative storage (survives restarts),
- explore cost reduction further for large batch runs (1000+ queue),
- evaluate Phase 3 browser capability decision (Option C — document the gap — is current stance).

Progress: Phase 1 and 2 complete, cost mitigations applied. Phase 4 (durable state) and Phase 5 (deployment architecture) remain open. See `pipeline-worker-plan.md` for full detail.

### 3. Apply and outreach depth

Goals:

- improve the quality of apply assistance,
- strengthen outreach-related generation and research support,
- and create better continuity between pipeline, resumes, apply, and interview prep.

### 3. Compare polish

Goals:

- improve readability,
- sharpen decision framing,
- and make the route feel like a finished prioritization tool.

### 4. Ops safety pass

Goals:

- review every mutating maintenance action exposed in the UI,
- improve confirmations,
- improve warnings,
- and make the consequences clearer.

### 5. Auth hardening

Goals:

- validate real protected-route behavior end-to-end,
- test edge cases,
- and tighten session handling confidence.

### 6. Backend capability audit for remaining terminal-first modes

Goals:

- review backend-only research / training / evaluation workflows,
- decide which should become browser features,
- and plan their UI exposure intentionally instead of ad hoc.

## Definition of Done

- [ ] A user can complete every core workflow entirely from the frontend UI
- [ ] Resume generation, editing, and export feel reliable enough to trust
- [ ] Apply, outreach, and interview-prep flows feel like connected parts of one system
- [ ] Mutating maintenance actions have appropriate operator safeguards
- [ ] Auth is hardened enough for real protected use
- [x] This ledger reflects the current codebase rather than stale planning assumptions
- [ ] New backend capabilities are planned with frontend exposure from the start
