# Resume Studio Dynamic Tailoring Implementation Plan

## Purpose

Resume Studio should become a dynamic resume composer, not a fixed PDF generator. The system should read the candidate's resume sources as evidence, interpret that evidence against a target job description/evaluation report, generate a role-specific structured resume, let the user edit it in a document-like interface, and export the edited version to PDF.

This plan covers both sides of the stack:

- Backend / CLI / API: evidence parsing, role strategy, AI rewriting, structured draft storage, export.
- Frontend: Resume Studio V2, structured document editor, section ordering, inline editing, rewrite controls, export flow.

The visual target for the final resume should follow the provided `Ayo_Resume.pdf` direction: clean professional resume styling, strong hierarchy, polished typography, and predictable one/two-page export behavior. The structure should remain dynamic even when the visual system stays consistent.

## Current State

### Current Flow

1. User opens `/resumes`.
2. `src/components/resumes/ResumeStudio.tsx` calls `POST /api/resumes/draft`.
3. `src/app/api/resumes/draft/route.ts` calls `generateResumeDraft`.
4. `src/lib/api/career-ops.ts` shells into `/Users/binidowu/career-ops/resume-draft.mjs`.
5. `resume-draft.mjs` parses markdown resume sources and a report, scores existing bullets by keyword overlap, then returns a fixed draft shape.
6. UI renders the draft and supports limited overrides.
7. `POST /api/resumes/export` regenerates the draft, applies limited overrides, renders HTML, and calls `generate-pdf.mjs`.

### Current Limitations

- The draft shape is too rigid: summary, experience, projects, education, skills.
- Projects are always treated as a normal resume section when present, even when the target job does not need them.
- Experience bullets are mostly selected/reordered, not deeply rewritten for the job context.
- The backend does not preserve a structured evidence model or provenance for rewritten claims.
- Export regenerates from the backend instead of exporting the exact edited document state.
- Editing is partial: headline, summary, and some experience bullets can be overridden, but the user cannot fully edit the resume like a formatted document.
- The UI does not expose section policy controls: show/hide, reorder, rename, convert Projects to Selected Work, etc.
- Upload support currently favors markdown/plain text; PDF/DOCX parsing is not wired into the resume source pipeline.

## Product Principles

### Resume Sources Are Evidence, Not Final Copy

Uploaded resumes should be treated as source material. The system should extract facts, achievements, skills, dates, companies, projects, certifications, and outcomes. It should not simply copy bullet text into every generated resume.

Example evidence:

```json
{
  "id": "evidence_foot_iq_dashboard",
  "source": "resume:frontend",
  "kind": "project",
  "title": "FootIQ dashboard",
  "skills": ["React", "TypeScript", "dashboarding"],
  "actions": ["built dashboard", "tracked support activity"],
  "outcomes": ["improved visibility", "reduced manual triage"],
  "originalText": "Built a React dashboard for tracking support tickets and user activity."
}
```

The generated bullet should be a role-specific rewrite of that evidence.

### Section Order Should Be Dynamic

Yes, the section order should depend on the job. The strongest evidence for the target role should appear earliest, while the visual template remains consistent.

Examples:

- Software / AI / data role: Summary, Technical Skills, Projects, Experience, Education.
- Operations / business role: Summary, Experience, Core Skills, Selected Work, Education.
- Teaching role: Summary, Certifications, Teaching Experience, Education, Skills.
- Medical / regulated role: Summary, Licenses, Clinical Experience, Education, Certifications, Skills.
- Entry-level / career transition: Summary, Relevant Projects, Skills, Experience, Education.

### Structured Editor, Not Freeform Canvas

Resume Studio should feel like editing a document, but the underlying data should remain structured.

The user should be able to:

- Click a bullet and edit it directly.
- Add/delete/reorder bullets.
- Hide/show sections.
- Drag sections into a better order.
- Rename a section.
- Ask AI to rewrite a bullet, section, or whole draft.
- Export the exact current edited state to PDF.

The app should still know what each element is:

- `summary`
- `experience.entry`
- `experience.bullet`
- `project.entry`
- `skills.group`
- `education.entry`
- `certification.entry`

This preserves clean PDF export, validation, provenance, and future AI actions.

## Target Architecture

### Layer 1: Candidate Evidence Model

Create a durable normalized evidence model from resume sources and profile data.

Recommended concepts:

```ts
type ResumeEvidenceKind =
  | "experience"
  | "project"
  | "skill"
  | "education"
  | "certification"
  | "award"
  | "publication"
  | "volunteering"
  | "summary"
  | "contact";

interface ResumeEvidenceItem {
  id: string;
  kind: ResumeEvidenceKind;
  sourceId: string;
  sourcePath: string;
  title: string;
  organization?: string;
  role?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  skills: string[];
  actions: string[];
  outcomes: string[];
  metrics: string[];
  originalText: string;
  confidence: number;
}
```

Evidence should support multiple resumes. A frontend resume, general resume, teaching resume, and finance resume can all contribute evidence, but the generator should choose which sources matter for the target role.

### Layer 2: Job Target Model

Normalize the target opportunity into a strategy-ready object.

Inputs:

- Opportunity record.
- Evaluation report.
- Parsed job description / role snapshot.
- Existing `intel` sidecar when available.
- User-selected resume source.
- User-selected tone/format/preferences.

Recommended model:

```ts
interface ResumeTargetContext {
  opportunityId: string;
  company: string;
  role: string;
  jobFamily: string;
  seniority: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  responsibilities: string[];
  domainSignals: string[];
  riskFlags: string[];
  recommendedAngle: string;
}
```

### Layer 3: Resume Strategy

Before writing any resume text, produce a strategy object.

```ts
interface ResumeStrategy {
  templateId: "ayo-clean-v1";
  jobFamily: string;
  narrativeAngle: string;
  sectionOrder: ResumeSectionType[];
  sectionPolicies: Record<ResumeSectionType, ResumeSectionPolicy>;
  keywordPlan: string[];
  evidencePlan: ResumeEvidenceSelection[];
  warnings: string[];
}

interface ResumeSectionPolicy {
  enabled: boolean;
  label: string;
  maxItems?: number;
  maxBulletsPerItem?: number;
  prominence: "primary" | "secondary" | "supporting";
  reason: string;
}
```

The strategy decides:

- Whether Projects appears.
- Whether Projects should be renamed to Selected Work.
- Whether Skills should appear before Experience.
- Whether Certifications/Licenses should be elevated.
- How many bullets per role.
- Which evidence items to use.
- Which sections should be hidden by default.

### Layer 4: AI Rewrite Engine

The AI should rewrite evidence into role-specific resume content.

Responsibilities:

- Rewrite original bullets to match job context.
- Preserve truthfulness and trace each claim back to evidence.
- Avoid overclaiming missing tools or experience.
- Use job vocabulary naturally.
- Produce concise, ATS-readable bullets.
- Vary wording across different target jobs.
- Create section summaries and headlines that match the target role.

Recommended rewrite constraints:

- Every generated bullet must cite one or more `sourceEvidenceIds`.
- Generated claims must not introduce unsupported employers, tools, degrees, dates, metrics, or certifications.
- If a metric is inferred or generalized, mark it in diagnostics and avoid exporting it unless user approves.
- Prefer concrete actions/outcomes over generic responsibility language.

Example rewrite request:

```json
{
  "target": {
    "role": "AI Forward Analytics & Data Associate",
    "mustHaveSkills": ["dashboards", "data integrations", "workflow automation"]
  },
  "evidence": [
    {
      "id": "evidence_bike_theft_dashboard",
      "originalText": "Built a bicycle theft recovery ML project with ETL, feature engineering, and Power BI dashboard."
    }
  ],
  "sectionPolicy": {
    "label": "Selected Analytics Work",
    "maxBulletsPerItem": 2
  }
}
```

Example output:

```json
{
  "text": "Built an ETL-backed Power BI dashboard that turned city theft data into actionable recovery patterns for non-technical stakeholders.",
  "sourceEvidenceIds": ["evidence_bike_theft_dashboard"],
  "matchedKeywords": ["ETL", "dashboard", "non-technical stakeholders"],
  "risk": "none"
}
```

### Layer 5: Structured Resume Document

The output of generation should be a persisted editable document, not only an ephemeral draft.

Recommended model:

```ts
interface ResumeDocument {
  id: string;
  opportunityId: string;
  resumeSourceIds: string[];
  templateId: "ayo-clean-v1";
  format: "letter" | "a4";
  status: "draft" | "edited" | "exported";
  strategy: ResumeStrategy;
  sections: ResumeSection[];
  diagnostics: ResumeDiagnostic[];
  createdAt: string;
  updatedAt: string;
}

interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  label: string;
  enabled: boolean;
  order: number;
  blocks: ResumeBlock[];
}

type ResumeBlock =
  | ResumeTextBlock
  | ResumeExperienceBlock
  | ResumeProjectBlock
  | ResumeSkillGroupBlock
  | ResumeListItemBlock;

interface ResumeBullet {
  id: string;
  text: string;
  sourceEvidenceIds: string[];
  matchedKeywords: string[];
  userEdited: boolean;
  locked: boolean;
}
```

## Backend Implementation Plan

### Phase B1: Add Evidence Extraction

Files likely involved:

- `/Users/binidowu/career-ops/resume-draft.mjs`
- `src/lib/data/parse-cv.ts`
- `src/lib/api/career-ops.ts`
- `src/lib/types.ts`

Tasks:

1. Expand resume parsing beyond the current fixed sections.
2. Support common section aliases:
   - Experience, Work Experience, Professional Experience, Employment.
   - Projects, Selected Work, Portfolio, Case Studies.
   - Certifications, Licenses, Credentials.
   - Publications, Awards, Volunteer Experience.
3. Convert parsed resume content into normalized `ResumeEvidenceItem[]`.
4. Add stable IDs for evidence items.
5. Preserve original text and source metadata.
6. Return evidence diagnostics:
   - missing contact info
   - unsupported source format
   - weak bullets without outcomes
   - duplicate evidence

Acceptance criteria:

- A resume with no Projects section does not produce an empty Projects section.
- A resume with Certifications/Licenses preserves those as first-class evidence.
- Every parsed bullet or project can be traced back to a source.

### Phase B2: Add PDF/DOCX Source Ingestion

Current upload only accepts markdown/plain text. Add ingestion for actual resume files.

Tasks:

1. Extend `src/app/api/profile/resume-sources/route.ts`.
2. Accept PDF and DOCX uploads.
3. Extract text server-side.
4. Convert extracted text into normalized markdown or evidence JSON.
5. Store both:
   - original uploaded file
   - parsed normalized source
6. Add extraction diagnostics in Settings and Resume Studio.

Implementation options:

- PDF: use a Node PDF text extraction package in the UI backend or call an existing CLI tool if already available.
- DOCX: use a DOCX text extraction package.
- Keep markdown as the canonical normalized source even if the original upload is PDF/DOCX.

Acceptance criteria:

- User can upload `Ayo_Resume.pdf`.
- Resume Studio can use it as a source without manual conversion.
- The user sees extraction quality warnings when parsing is incomplete.

### Phase B3: Build Resume Strategy Engine

Tasks:

1. Add job family classification:
   - software
   - data/analytics
   - IT/support
   - product/design
   - finance
   - teaching
   - healthcare/medical
   - operations/admin
   - general
2. Use evaluation report + job title + role snapshot to classify target job.
3. Produce section policies and section order.
4. Add a rule layer before AI:
   - technical/data roles may elevate Projects.
   - regulated roles elevate Licenses/Certifications.
   - traditional roles elevate Experience.
   - weak/no project evidence disables Projects.
5. Return the strategy in the draft payload.

Acceptance criteria:

- Same resume source produces different section ordering for different jobs.
- Projects can be disabled, renamed, or moved down.
- Skills can move before or after Experience depending on job family.

### Phase B4: Add AI Rewrite Pass

Tasks:

1. Add a rewrite mode to `resume-draft.mjs` or split into a new backend module.
2. Input: `ResumeTargetContext`, `ResumeStrategy`, evidence items.
3. Output: `ResumeDocument`.
4. Add prompt sections:
   - source evidence
   - target job context
   - section policy
   - truthfulness rules
   - output JSON schema
5. Validate AI output:
   - JSON schema validation.
   - all bullets cite evidence IDs.
   - no unsupported dates/degrees/tools.
   - max line/length constraints.
6. Fall back to deterministic scoring if AI is unavailable.

Acceptance criteria:

- Bullets change meaningfully across different job targets.
- Generated content still traces to uploaded resume evidence.
- Draft does not invent unsupported qualifications.
- If AI fails, user receives a useful fallback draft and diagnostic note.

### Phase B5: Persist Draft Documents

Tasks:

1. Store generated resume documents as JSON.
2. Recommended path:
   - `/Users/binidowu/career-ops/resume-drafts/<opportunity-id>/<draft-id>.json`
3. Include:
   - document structure
   - strategy
   - source IDs
   - user edits
   - export history
4. Add `latest.json` per opportunity/source combination.

Acceptance criteria:

- Refreshing Resume Studio does not lose edits.
- Export uses saved edited document state.
- Regenerate can create a new draft without destroying the edited draft.

### Phase B6: API Contract V2

Current endpoints can evolve without breaking the UI immediately.

Recommended endpoints:

```txt
POST /api/resumes/draft
GET  /api/resumes/drafts/:id
PATCH /api/resumes/drafts/:id
POST /api/resumes/drafts/:id/rewrite
POST /api/resumes/drafts/:id/export
POST /api/profile/resume-sources
```

`POST /api/resumes/draft` should return:

```ts
interface GenerateResumeDraftResponse {
  document: ResumeDocument;
  resumeSource: ResumeSource;
  evidenceSummary: {
    totalEvidenceItems: number;
    usedEvidenceItems: number;
    warnings: string[];
  };
}
```

`PATCH /api/resumes/drafts/:id` should support:

- edit text
- reorder sections
- toggle section
- rename section
- add/delete bullet
- lock bullet
- update format

`POST /api/resumes/drafts/:id/rewrite` should support:

- whole resume rewrite
- section rewrite
- bullet rewrite
- tone adjustment
- length adjustment
- make more technical
- make more concise
- make more ATS-aligned

`POST /api/resumes/drafts/:id/export` should export the saved document state, not regenerate from scratch.

### Phase B7: Export Renderer V2

Tasks:

1. Replace `renderResumeHtml(draft: ResumeDraft)` with `renderResumeDocumentHtml(document: ResumeDocument)`.
2. Implement the `ayo-clean-v1` template.
3. Support dynamic section order.
4. Skip disabled sections.
5. Respect renamed sections.
6. Support one-page and two-page constraints.
7. Add overflow diagnostics before PDF export.

Acceptance criteria:

- PDF output matches the edited preview.
- Disabled Projects section does not appear in the PDF.
- Reordered sections export in the same order shown in UI.
- The Ayo-style design remains consistent across role-specific section plans.

## Frontend Implementation Plan

### Phase F1: Resume Studio V2 Information Architecture

Current file:

- `src/components/resumes/ResumeStudio.tsx`

Recommended UI regions:

1. Left rail: target role, source resume, format, tone, template, regenerate controls.
2. Center: editable resume document preview.
3. Right rail: strategy, evidence, section controls, diagnostics.

Primary user flow:

1. Select opportunity.
2. Select resume source.
3. Generate dynamic draft.
4. Review strategy and section order.
5. Edit document directly.
6. Rewrite individual pieces if needed.
7. Export PDF.

### Phase F2: Structured Document Editor

Build an editor that feels document-like but edits structured blocks.

Interactions:

- Click headline/summary/bullet to edit inline.
- Press Enter in a bullet to create a new bullet.
- Use drag handles to reorder bullets and sections.
- Use section menu to hide, rename, regenerate, or move section.
- Lock a bullet to prevent AI rewrite.
- Show source/evidence provenance in a side panel.

Do not use a fully freeform rich text canvas as the source of truth. It can break export fidelity and erase structure.

Recommended component split:

```txt
ResumeStudioV2
ResumeControlRail
ResumeDocumentEditor
ResumeSectionEditor
ResumeBlockEditor
ResumeBulletEditor
ResumeStrategyPanel
ResumeEvidencePanel
ResumeDiagnosticsPanel
ResumeExportBar
```

### Phase F3: Section Policy UI

Expose dynamic section logic without overwhelming the user.

Controls:

- Section outline with drag ordering.
- Toggle section on/off.
- Rename section label.
- Section reason:
  - "Projects are elevated because this target role values proof-of-work."
  - "Certifications are elevated because this job family often screens for credentials."
  - "Projects are hidden because stronger direct experience exists for this role."
- Reset to AI-recommended order.

### Phase F4: Rewrite Controls

Add AI actions at three levels:

Document-level:

- Regenerate draft.
- Make more technical.
- Make more concise.
- Emphasize leadership.
- Emphasize operations.
- Reduce jargon.

Section-level:

- Rewrite section for this job.
- Shorten section.
- Add stronger keywords.
- Convert Projects to Selected Work.

Bullet-level:

- Rewrite bullet.
- Make more quantified.
- Make more ATS-friendly.
- Make more plain-language.
- Replace with alternate evidence.

All rewrite actions should preserve source evidence IDs unless the user explicitly chooses a different evidence item.

### Phase F5: Evidence Traceability UI

For trust, each generated claim should expose where it came from.

UI ideas:

- Hover/focus a bullet to show "Based on: FootIQ project, original resume".
- Side panel lists original source text.
- Badge for user-edited bullets.
- Warning for low-confidence AI rewrite.
- "Unsupported claim" diagnostic if validation fails.

This helps the user understand that the AI is rewriting evidence, not inventing.

### Phase F6: Preview and Export Parity

The preview should use the same structured document and the same template logic as export.

Requirements:

- Preview and PDF share section order.
- Preview and PDF share labels.
- Preview and PDF share bullet text.
- Export should not call draft regeneration.
- Export should call the document export endpoint with the current `document.id`.

### Phase F7: Autosave and Versioning

Tasks:

1. Autosave user edits after debounce.
2. Show save status:
   - Saved
   - Saving
   - Unsaved
   - Save failed
3. Add version history later:
   - Generated baseline
   - User edited
   - Regenerated
   - Exported
4. Add reset controls:
   - Reset section
   - Reset bullet
   - Reset whole draft to generated baseline

## Data Migration Plan

### Backward Compatibility

Keep current `ResumeDraft` support temporarily.

Transition path:

1. Add new `ResumeDocument` model alongside current `ResumeDraft`.
2. Adapt old backend payloads into `ResumeDocument` when necessary.
3. Convert current UI preview section by section.
4. Move export to `ResumeDocument`.
5. Remove old `ResumeDraft` once no route depends on it.

### Storage

Recommended workspace paths:

```txt
resumes/
  uploaded/
  normalized/
resume-drafts/
  <opportunity-id>/
    <draft-id>.json
    latest.json
```

## Testing Plan

### Backend Tests

Fixtures:

- Technical/software resume with Projects.
- Healthcare/medical resume with Licenses.
- Teaching resume with Certifications.
- Finance resume with Experience but no Projects.
- Sparse resume with weak bullets.
- PDF resume source.
- DOCX resume source.

Test cases:

- Evidence extraction preserves source IDs.
- Section strategy changes by job family.
- Projects can be hidden when irrelevant.
- Certifications/Licenses can be elevated.
- AI output validates against schema.
- Unsupported claims are flagged.
- Export uses edited document state.

### Frontend Tests

Test cases:

- Generate draft from selected opportunity/source.
- Edit headline, summary, bullets.
- Add/delete/reorder bullets.
- Toggle Projects off and verify it disappears.
- Reorder Skills before Experience and export.
- Trigger bullet rewrite and preserve provenance.
- Autosave survives refresh.
- Export downloads PDF from edited document state.

### Visual QA

Viewports:

- Desktop wide.
- Laptop.
- Tablet.
- Mobile.

Checks:

- Resume preview remains readable.
- Editor controls do not overlap document content.
- Long bullets wrap cleanly.
- Section labels do not collide with content.
- PDF output matches preview.
- One-page/two-page behavior is predictable.

## Risks and Mitigations

### Risk: AI Hallucination

Mitigation:

- Require evidence IDs for every bullet.
- Validate generated claims against source evidence.
- Show diagnostics and source text.
- Let user lock trusted content.

### Risk: Freeform Editing Breaks Export

Mitigation:

- Use structured editor blocks.
- Keep HTML/PDF renderer driven by structured JSON.
- Avoid storing the resume as one rich-text blob.

### Risk: Dynamic Section Order Feels Unpredictable

Mitigation:

- Show the strategy reason for every section decision.
- Let user reset to AI recommendation.
- Let user manually override order.

### Risk: PDF Parsing Quality Is Uneven

Mitigation:

- Store extraction diagnostics.
- Let user inspect normalized source.
- Allow manual correction of parsed resume source.

### Risk: Existing Resume Studio Breaks During Migration

Mitigation:

- Build V2 behind a feature flag or adapter.
- Keep old `ResumeDraft` flow until V2 draft/export are both stable.
- Add compatibility adapter from old payload to new `ResumeDocument`.

## Milestone Plan

### Milestone 1: Strategy and Document Model

Deliverables:

- `ResumeEvidenceItem` model.
- `ResumeStrategy` model.
- `ResumeDocument` model.
- Adapter from current draft to new document shape.
- No major UI redesign yet.

### Milestone 2: Dynamic Sections

Deliverables:

- Job family classification.
- Section policy engine.
- Dynamic section order.
- Projects can be hidden, renamed, or moved.
- Export respects section policy.

### Milestone 3: AI Rewrite Engine

Deliverables:

- Role-specific bullet rewriting.
- Evidence provenance.
- JSON validation.
- Rewrite diagnostics.
- Fallback deterministic generation.

### Milestone 4: Structured Editor

Deliverables:

- Editable document preview.
- Inline text editing.
- Add/delete/reorder bullets.
- Section reorder/toggle/rename.
- Autosave.

### Milestone 5: Rewrite Controls and Evidence Panel

Deliverables:

- Bullet/section/document rewrite actions.
- Evidence source panel.
- User-edited and locked states.
- Low-confidence warning states.

### Milestone 6: PDF/DOCX Source Ingestion

Deliverables:

- PDF upload support.
- DOCX upload support.
- Parsed-source review.
- Extraction diagnostics.

### Milestone 7: Export Hardening

Deliverables:

- Export current edited document.
- Preview/PDF parity.
- Ayo-style template implementation.
- Overflow diagnostics.
- Regression fixtures.

## Definition of Done

Resume Studio V2 is complete when:

- A user can upload/select a resume source.
- The backend extracts structured evidence from it.
- The system generates a job-specific resume with rewritten bullets, not copied bullets.
- Section order and section visibility adapt to the job.
- The user can edit the formatted resume directly in the browser.
- The edited resume persists across refreshes.
- The exported PDF matches the edited preview.
- Every generated claim can be traced back to source evidence.
- The resume design follows the selected clean professional template while staying dynamic in structure.

