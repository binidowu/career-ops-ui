# Career-Ops UI — Code-Verified Implementation Ledger

Last updated: 2026-04-24

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
- Pending and processed inbox states are visible in the UI.

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

What still needs work:

- stronger and more predictable draft quality,
- clearer regenerate behavior,
- better edit-state consistency,
- tighter contract between backend generation output and frontend rendering,
- better trust that what the user edits is what the final asset reflects.

Status: partial

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

What still needs work:

- cleaner decision framing,
- more confidence in the visual model,
- stronger product polish so it feels like a finished prioritization tool.

Status: partial

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

What still needs work:

- production-readiness validation,
- edge-case testing,
- confidence around session lifecycle behavior and environment toggles.

Status: partial

#### Ops safety and operator clarity

What exists:

- maintenance actions in-browser,
- checks and verification in-browser.

What still needs work:

- stronger safeguards around destructive actions,
- clearer operator warnings,
- better confirmation UX,
- clearer distinction between safe checks and mutating operations.

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

### 2. Apply and outreach depth

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
