# Career-Ops UI — Frontend / Backend Parity Ledger

Last updated: 2026-04-22

## Objective

This file tracks one rule: if a workflow exists in the `career-ops` backend, the user should not need the terminal to benefit from it. The frontend should expose the workflow, surface the important data it returns, and make the current parity gaps explicit.

This ledger did not previously exist in the UI repo. It is now the source of truth for parity work.

## Audit Summary

The backend currently contains four broad classes of capability:

1. Core workspace data and evaluation artifacts
   - Tracker ingestion from `applications.md`
   - Report parsing from `reports/*.md`
   - Profile loading from `config/profile.yml`
   - Resume source material from `cv.md` and other local resume files
2. Job discovery and intake operations
   - URL / JD intake through the auto-pipeline flow
   - Pending inbox management through `data/pipeline.md`
   - Portal scanning via `scan.mjs`
3. Asset generation and decision support
   - Opportunity detail evaluation
   - Side-by-side comparison
   - Resume draft + PDF generation
4. Operator / terminal-first flows
   - Apply assistant
   - Contact / outreach research
   - Interview prep mode
   - Batch maintenance scripts such as `doctor`, `verify`, `normalize`, `dedup`, `merge`, `update`, `rollback`, and `liveness`
   - Research / training / project evaluation modes

## Current Parity Status

### Exposed in the frontend now

- Dashboard
  - Live stats
  - Attention queue
  - Workspace health
- Pipeline
  - Tracker-backed table
  - Sorting, filtering, selection
  - Detail route and drawer-backed evaluation review
  - Status and notes mutations
- Compare
  - Multi-role comparison workspace
  - Backend report data surfaced side-by-side
- Resume Studio
  - Backend-backed draft regeneration
  - Resume source selection
  - PDF export path
- Settings / profile
  - Profile editing
  - Multiple resume source registration
- Operations / verification
  - Browser-triggered workspace doctor
  - Browser-triggered pipeline verify
  - Browser-triggered resume sync check
  - Browser-triggered job link liveness check over tracked URLs
- Interview prep
  - Dedicated per-role interview prep workspace
  - STAR story map from parsed evaluation data
  - Rehearsal checklist and risk-area surfacing
  - Browser editing for `interview-prep/story-bank.md`
  - Existing interview-prep reports surfaced when present
  - Browser-triggered generation for fresh company-specific interview intel from the backend report parser
- Discovery / intake
  - URL paste queue via `/api/pipeline`
  - Backend scanner trigger via `/api/scan`
  - Inbox visibility on the dashboard
  - Dedicated `/scans` route for queueing, scanning, and inspecting pending / processed inbox items

### Partially exposed or still uneven

- Resume generation quality
  - The frontend can now trigger real draft generation, but final resume quality still depends on backend prompt logic and the richness of the uploaded source resumes.
  - If output is thin, that is not purely a frontend rendering bug; it is a parity issue between backend drafting rules, source material, and the UI controls.
- Compare experience
  - Functional parity exists, but visual refinement is still in progress.
- Resume editing controls
  - Regeneration is connected; editing ergonomics still need a dedicated polish pass to ensure each control maps cleanly to backend behavior and updates the preview consistently.
- Interview prep generation depth
  - The UI can now trigger fresh company-specific interview intel generation, but the current backend generator is deterministic and report-driven.
  - It does not yet perform live external research or source-cited company-specific interview harvesting.

### Still backend-only

- Apply assistant workflows
- Contact / outreach workflows
- Full interview research orchestration with external company-specific sourcing beyond static report sections
- Mutating maintenance commands
  - `normalize`
  - `dedup`
  - `merge`
  - `update`
  - `rollback`
- Research / training / project evaluation modes that are still terminal-driven
- Authentication / multi-user protection

## Broken or Missing Data Risks

- Resume drafts can appear incomplete when:
  - the selected opportunity report is sparse,
  - the selected resume source lacks depth,
  - the backend drafting prompt is not extracting enough structured material.
- Some backend scripts return operator-oriented stdout rather than structured JSON. The UI can call them, but long-term parity is stronger when the backend exposes stable machine-readable responses.
- The UI now surfaces safe read-only health checks, but mutating maintenance commands still remain terminal-only by design.

## What Shipped In This Parity Pass

- Added backend-backed resume source management in Settings so multiple resume files can be registered and selected.
- Connected Resume Studio draft regeneration to the backend generator instead of relying on static local shaping alone.
- Added frontend API routes for:
  - `POST /api/pipeline`
  - `POST /api/scan`
- Added dashboard intake controls so users can:
  - paste job URLs,
  - queue backend pipeline entries,
  - run the real backend scanner,
  - see pending inbox state without touching the terminal.
- Added a dedicated `Scans` page and enabled it in navigation / command palette.
- Added a Settings operations panel that runs safe backend health checks from the browser:
  - `doctor`
  - `verify`
  - `sync-check`
  - `liveness`
- Added a dedicated interview prep route for each tracked role so prep is no longer buried inside the raw evaluation report.
- Added browser editing for the backend interview story bank and surfaced existing `interview-prep/*.md` reports when they already exist.
- Added a backend interview intel generator script and a frontend trigger so users can generate a fresh `interview-prep/*.md` brief directly from the browser.

## Recommended Next Parity Queue

1. Expose apply and outreach / research flows as first-class UI workspaces.
2. Decide which mutating maintenance flows are safe enough for the browser.
   - `normalize`
   - `dedup`
   - `merge`
   - `update`
   - `rollback`
3. Strengthen Resume Studio end-to-end.
   - Make preview edits deterministic.
   - Add clearer regenerate variants and source selection feedback.
   - Tighten the backend drafting contract so the UI can trust the response shape.
4. Add auth and protected routes so parity work is happening inside the eventual real application shell, not an open local workspace.

## Definition of Done Tracking

- [ ] A user can complete every core workflow entirely from the frontend UI
- [ ] No data is missing or misrepresented compared to the backend source
- [x] `implementation.md` reflects the current known state of the application
- [ ] New features follow the backend -> frontend parity rule from the start
