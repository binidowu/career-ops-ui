# Career-Ops Web UI — Phase 1 Design Brief

> Shaped from the Career-Ops PRD v1.0 (April 2026), project design context ([.impeccable.md](file:///Users/binidowu/career-ops/.impeccable.md)), and discovery interview.

---

## 1. Feature Summary

Career-Ops Web UI is a multi-user web application that exposes the existing Career-Ops CLI engine through a modern, keyboard-navigable interface. Phase 1 delivers the **Foundation**: authentication, a dashboard overview, the full pipeline tracker, opportunity detail with 6-block evaluation, basic role comparison (2–5), resume generation trigger, and user profile/settings. The app reads from the existing markdown/YAML file system through a clean data-access layer — no database migration in V1.

The audience is high-intent job seekers managing a deliberate, selective search across dozens to hundreds of roles. The interface must feel like a **professional command center** — calm, information-dense, and always transparent about its reasoning.

---

## 2. Primary User Action

**Decide what to do next.** Every screen should answer one question: *which opportunity deserves my attention right now, and what's the right next action?* The system filters, scores, and organizes — the user decides and acts.

---

## 3. Design Direction

### Aesthetic positioning

The design sits at the intersection of four reference products, each contributing a specific quality:

| Reference | What to take | What to leave behind |
|-----------|-------------|---------------------|
| **Notion** | Spacious content areas, clean type hierarchy, unhurried pacing | Block-editor UI patterns, emoji-heavy navigation |
| **Height** | Dense-but-clear data tables, strong filter/sort controls, subtle status indicators | Overly colorful status pills |
| **Vercel Dashboard** | Precision typography, monochrome restraint, developer-grade clarity | Cold emptiness on sparse pages |
| **Raycast** | Keyboard-first interaction, ⌘K command palette, instant response feel | Desktop-app-only patterns |

### Calibration against `.impeccable.md` principles

| Principle | How it manifests in Phase 1 |
|-----------|---------------------------|
| **Earned attention** | No decorative widgets. Dashboard shows only actionable data. No charts for the sake of charts. |
| **Editorial restraint** | Typography and whitespace create hierarchy — not color, not shadows, not cards-within-cards. |
| **Inclusive by default** | WCAG AAA contrast. Color-vision-safe semantic indicators (shape + label, never color alone). Reduced-motion safe. |
| **System-native comfort** | Light and dark modes via `prefers-color-scheme`, both equally polished. No "primary" theme. |
| **Information over decoration** | Pipeline table adapts to data volume. Empty states teach; full states compress gracefully. |

### Tone

Serious, operational, high-signal. The interface should feel like opening a well-organized research dossier, not launching an app. No gamification, no congratulations, no confetti. Progress is implicit in the data.

### What this is NOT

- Not a recruiter/HR platform (no candidate pipelines, no applicant views)
- Not a consumer app (no onboarding carousels, no badges, no streaks)
- Not a fintech dashboard (no dark gradients, no glowing numbers, no crypto energy)
- Not corporate enterprise (no gray boxes, no breadcrumb soup, no Workday vibes)

---

## 4. Layout Strategy

### Global shell

```
┌─────────────────────────────────────────────────────┐
│  Topbar: Logo · Navigation tabs · ⌘K · User menu   │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│  (none)  │          Main content area               │
│          │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

**No sidebar.** Navigation lives in a horizontal topbar with tab-style items. This maximizes horizontal space for data tables (Pipeline) and side-by-side comparisons (Compare). The topbar is slim — one row, left-aligned nav, right-aligned user controls.

Rationale: sidebar navigation works for deep hierarchies (Notion) but Career-Ops has a flat IA — 7 top-level screens in Phase 1. Horizontal tabs are more space-efficient and align with Vercel/Height patterns.

### Content areas

- **Dashboard**: Asymmetric grid — primary column (≈65%) for actionable items (top scores, follow-ups due), secondary column (≈35%) for summary metrics and insights. Not a symmetric card grid.
- **Pipeline**: Full-width table with sticky header and sticky filter bar. No sidebar. Detail opens in a **right-side drawer** (≈480px) that overlays the table without navigating away.
- **Opportunity Detail**: Full page when accessed directly. Two-column layout — primary column for the 6-block evaluation (scrollable), secondary column for metadata, status controls, and related outputs.
- **Compare**: Horizontally scrollable comparison grid. Left column is the dimension labels (sticky), remaining columns are the roles being compared. 2–5 columns.
- **Resume Studio**: Focused single-task view. Left panel for controls (source opportunity, keywords, template), right panel for live preview.
- **Profile & Settings**: Single-column form-style layout with clear sections. Max-width constrained (~720px, centered).

### Spatial hierarchy

Information flows top-to-bottom within each screen. The most important content is at the top of the viewport on load — no scrolling required to understand what's happening. Secondary content reveals on scroll.

Varied spacing creates rhythm:
- **Tight** (8–12px): Within data rows, between related labels
- **Standard** (16–24px): Between sections within a component
- **Generous** (32–48px): Between major page sections
- **Dramatic** (64–96px): Page-level breathing room (top/bottom padding on content)

---

## 5. Key States

### 5.1 Dashboard

| State | What the user sees | What the user should feel |
|-------|-------------------|--------------------------|
| **Default (active search)** | Top-scoring roles, follow-ups due, recent activity, pipeline summary | "I know exactly where I stand" |
| **Empty (new user)** | Welcome message, clear first action: "Paste a job URL to get started" | Guided, not overwhelmed |
| **Empty (no follow-ups)** | Follow-up section collapses gracefully; no "nothing here" placeholder | Clean, not absent |
| **Dense (700+ roles)** | Summary stats aggregate meaningfully; top-scores list caps at ~10 with "View all in Pipeline" | Manageable, not drowning |
| **Stale (no activity for 7+ days)** | Gentle prompt: "Your pipeline has 3 roles waiting for a decision" | Nudged, not nagged |

### 5.2 Pipeline

| State | What the user sees | What the user should feel |
|-------|-------------------|--------------------------|
| **Default (populated)** | Dense table rows, filter bar at top, sort controls in column headers | In control |
| **Empty** | "No opportunities tracked yet. Paste a URL above or run a scan." | Clear path forward |
| **Filtered (no results)** | "No roles match these filters" with one-click "Clear filters" | Not broken — just filtered |
| **Loading (initial)** | Skeleton rows matching table structure | Fast, predictable |
| **Bulk selection active** | Checkbox column appears, floating action bar at bottom | Power mode |
| **Drawer open** | Right drawer slides in, table content compresses but remains visible | Context preserved |

### 5.3 Opportunity Detail

| State | What the user sees | What the user should feel |
|-------|-------------------|--------------------------|
| **Evaluated** | Full 6-block evaluation, score, grade, all dimension breakdowns | Complete picture |
| **Pending evaluation** | "Evaluating…" with step indicators (extracting → scoring → generating) | Progress, not mystery |
| **Evaluation failed** | Error message with specific reason + retry action | Recoverable |
| **Stale (role may have closed)** | Subtle warning: "This posting was evaluated 30+ days ago" | Informed |

### 5.4 Compare

| State | What the user sees | What the user should feel |
|-------|-------------------|--------------------------|
| **2–5 roles selected** | Side-by-side grid with dimension rows, badges on standout roles | Clarity for decision |
| **1 role selected** | "Select at least one more role to compare" | Directed |
| **0 roles** | "Choose roles from Pipeline to compare" with link to Pipeline | Not lost |

### 5.5 Resume Studio

| State | What the user sees | What the user should feel |
|-------|-------------------|--------------------------|
| **Source selected, preview ready** | Keywords highlighted, summary rewritten, bullets reordered | Impressed by tailoring quality |
| **Generating PDF** | Progress indicator with "Rendering PDF…" | Brief, predictable wait |
| **PDF ready** | Download button + inline preview + version saved | Accomplished |
| **No evaluated roles** | "Evaluate a role first to generate a tailored resume" | Logical dependency |

### 5.6 Profile & Settings

| State | What the user sees | What the user should feel |
|-------|-------------------|--------------------------|
| **Populated** | All fields filled, clear sections, edit-in-place | Organized |
| **Incomplete** | Missing fields highlighted with gentle indicators (not red errors) | Guided |
| **Saving** | Optimistic update — field saves inline, subtle confirmation | Instant |

### 5.7 Auth

| State | What the user sees | What the user should feel |
|-------|-------------------|--------------------------|
| **Sign in** | Clean, minimal form. Brand mark + email/password. No marketing. | Professional |
| **Sign up** | Same form, one extra field. No onboarding carousel. | Fast |
| **Session expired** | Redirect to sign-in with "Session expired, please sign in again" | Clear, not alarming |

---

## 6. Interaction Model

### Navigation

- **Topbar tabs**: Click to navigate. Active tab has a subtle bottom indicator (2px line, not a bold colored bar).
- **⌘K command palette**: Global shortcut opens a Raycast-style command palette for power users. Search across opportunities, actions ("evaluate URL…", "compare roles…"), and navigation.
- **Keyboard shortcuts**: `n` = new evaluation, `f` = focus filter bar, `esc` = close drawer/modal, `j/k` = navigate list items, `enter` = open selected.

### Pipeline table

- **Row hover**: Subtle background tint. No dramatic color change.
- **Row click**: Opens right-side detail drawer. Table stays visible and scrollable behind the drawer.
- **Column header click**: Sorts ascending/descending. Sort indicator (small arrow) in header.
- **Filter bar**: Persistent at top. Dropdown filters for status, archetype, score range, location. Filters compose with AND logic. Active filters shown as dismissible chips.
- **Bulk select**: Checkbox appears on hover in leftmost position. Select all via header checkbox. Floating action bar appears at bottom: "3 selected — Compare · Update status · Archive".
- **Quick preview on hover** (optional, can be disabled): Hovering a row for 500ms shows a small tooltip-style preview with score, grade, archetype, and one-line summary.

### Opportunity detail drawer

- **Open**: Slides in from right edge, 480px wide on desktop. Table compresses to accommodate.
- **Close**: Click X, press `esc`, or click outside the drawer.
- **Sections collapse/expand**: The 6 evaluation blocks are collapsible sections. Default: all expanded on first view, then remembers user preference.
- **Status change**: Dropdown in the drawer header. Selecting a new status applies immediately (optimistic update) with a subtle confirmation toast.
- **Actions**: "Generate Resume", "Add to Compare", "Open Report" — secondary actions in a toolbar below the header.

### Evaluation in-progress

- **Step indicator**: A horizontal 4-step progress bar (Extracting → Analyzing → Scoring → Complete). Each step lights up as it completes. No animation — just state transition. (With `prefers-reduced-motion`, steps appear instantly without transition.)
- **Estimated time**: "Usually takes 30–60 seconds" below the progress bar.

### Resume Studio

- **Left panel controls → Right panel preview**: Changes on the left immediately update the preview on the right. No "Apply" button — direct manipulation.
- **Keyword pills**: JD keywords shown as interactive pills. User can toggle keywords on/off. Toggling a keyword updates the preview.
- **Export**: "Download PDF" button. Downloads immediately (no modal, no "where do you want to save?" — browser's native download behavior).

### ⌘K Command Palette

- **Trigger**: ⌘K (Mac) / Ctrl+K
- **Behavior**: Overlay centered on screen, dark scrim behind. Search input at top, results below grouped by category (Navigation, Opportunities, Actions).
- **Type-to-filter**: Results update as user types. Fuzzy matching on opportunity titles, company names, actions.
- **Keyboard nav**: Arrow keys navigate results, Enter selects, Esc closes.

### Toasts and feedback

- **Success**: Subtle toast at bottom-right, auto-dismisses after 4 seconds. No green background — just text with a checkmark icon.
- **Error**: Toast persists until dismissed. Contains actionable text ("Evaluation failed — Retry").
- **Never modal confirmations for routine actions.** Status changes, filter changes, saves — all instant with undo capability via toast ("Status changed to Applied — Undo").

---

## 7. Content Requirements

### Navigation labels

| Position | Label |
|----------|-------|
| Tab 1 | Dashboard |
| Tab 2 | Pipeline |
| Tab 3 | Compare |
| Tab 4 | Resumes |
| Tab 5 | Scans *(Phase 2 — visible but disabled with "Coming soon" tooltip)* |
| Tab 6 | Settings |

### Pipeline table column headers

`Company · Role · Score · Grade · Archetype · Status · Location · Comp · Last Activity`

### Status labels (canonical, from `states.yml`)

`Evaluated · Applied · Responded · Interview · Offer · Rejected · Discarded · SKIP`

### Grade badges

`A · B · C · D · F` — each grade needs a unique visual treatment that doesn't rely on color alone. Proposed: letter inside a small shape that varies by grade:
- **A**: Filled circle
- **B**: Filled rounded square
- **C**: Outlined circle
- **D**: Outlined square
- **F**: No shape, letter only with a line-through treatment

This ensures color-vision safety: even in grayscale, grades are distinguishable by shape.

### Semantic flags (as labels, not colors)

`High Fit · Stretch · Weak Match · Duplicate · Follow-up Due`

Each flag uses a distinct icon + text label. The icon shape differentiates (not just color):
- **High Fit**: Upward chevron ↑
- **Stretch**: Diagonal arrow ↗
- **Weak Match**: Horizontal dash —
- **Duplicate**: Overlapping squares ⊞
- **Follow-up Due**: Clock ⏱

### Empty state copy

| Screen | Heading | Body | Action |
|--------|---------|------|--------|
| Dashboard (new user) | "Your command center" | "Paste a job URL to evaluate your first opportunity." | Text input + "Evaluate" button |
| Pipeline (empty) | "No opportunities yet" | "Evaluated roles appear here. Start by pasting a URL on the Dashboard." | Link to Dashboard |
| Compare (empty) | "Choose roles to compare" | "Select 2–5 roles from Pipeline to see them side by side." | Link to Pipeline |
| Resumes (empty) | "No resumes generated" | "Generate a tailored resume from any evaluated opportunity." | Link to Pipeline |
| Settings (incomplete) | "Complete your profile" | "The AI produces better evaluations when it knows your background." | Highlight first empty field |

### Error copy

- Evaluation failed: "Couldn't evaluate this posting — [specific reason]. Try again or paste the job description directly."
- PDF generation failed: "Resume generation failed. Check that the opportunity has been evaluated first."
- Network error: "Connection lost. Your data is safe — we'll retry when you're back online."

### Score display

- Numeric: `4.2 / 5` (always with denominator for context)
- Grade: Single letter in badge
- Dimension breakdown: 10 rows, each showing dimension name · score bar · numeric value

### Dynamic content ranges

| Content | Minimum | Typical | Maximum |
|---------|---------|---------|---------|
| Pipeline rows | 0 | 50–200 | 700+ |
| Evaluation blocks per detail | 6 (fixed) | 6 | 6 |
| Keywords per resume | 10 | 15–20 | 30 |
| Comparison columns | 2 | 3 | 5 |
| Follow-ups due | 0 | 3–8 | 20+ |

---

## 8. Recommended References

These impeccable reference files should be consulted during implementation:

| Reference | Why |
|-----------|-----|
| [spatial-design.md](file:///Users/binidowu/career-ops/.agents/skills/impeccable/reference/spatial-design.md) | Pipeline table layout, drawer behavior, dashboard grid, responsive adaptation |
| [typography.md](file:///Users/binidowu/career-ops/.agents/skills/impeccable/reference/typography.md) | Type scale for data-dense tables vs. editorial detail views, tabular figures for scores |
| [color-and-contrast.md](file:///Users/binidowu/career-ops/.agents/skills/impeccable/reference/color-and-contrast.md) | WCAG AAA palette construction, color-vision-safe semantic indicators, light/dark mode |
| [interaction-design.md](file:///Users/binidowu/career-ops/.agents/skills/impeccable/reference/interaction-design.md) | Command palette, drawer open/close, form patterns for Settings, optimistic updates |
| [motion-design.md](file:///Users/binidowu/career-ops/.agents/skills/impeccable/reference/motion-design.md) | Drawer transitions, toast entrances, reduced-motion fallbacks |
| [responsive-design.md](file:///Users/binidowu/career-ops/.agents/skills/impeccable/reference/responsive-design.md) | Desktop-first with mobile-readable pipeline, container queries for components |
| [ux-writing.md](file:///Users/binidowu/career-ops/.agents/skills/impeccable/reference/ux-writing.md) | Empty states, error messages, status labels, microcopy |

---

## 9. Open Questions

These should be resolved during implementation, not before:

1. **API design**: The data layer reads from existing markdown/YAML files. Should the API be REST or tRPC? Next.js server actions are another option. The choice affects how optimistic updates work.

2. **Real-time updates**: When an evaluation runs (30–60 seconds), should the UI poll for status, or should the API push via SSE/WebSocket? Polling is simpler for V1; SSE is better UX.

3. **Command palette scope**: Should ⌘K allow executing actions (e.g., "evaluate [URL]") or only navigation + search? Full actions are more powerful but harder to implement safely.

4. **Mobile breakpoint**: The PRD says "desktop-first, mobile-readable for pipeline review." How much adaptation is needed? Suggestion: Pipeline table becomes a card list on mobile, all other screens get a single-column reflow. Details to be decided during responsive implementation.

5. **Auth provider**: Multi-user auth needs a provider. Options: NextAuth.js with email/password, Clerk, Auth0. Each has different complexity and hosting implications. Decision depends on deployment target.

6. **Deployment target**: Vercel? Self-hosted? Docker? This affects SSR strategy, auth, and file system access (the data layer reads local files, which complicates serverless deployment).

7. **Score bar visualization**: The 10-dimension score breakdown needs a visual bar/indicator. Should this be a horizontal bar (like a progress bar), a dot on a scale, or a numeric-only display? The bar is more scannable but needs careful accessible implementation.

8. **Notification system**: The PRD mentions "persistent notifications for scan completions and batch results." For Phase 1 (no scans/batches), should this be scaffolded or deferred entirely?

---

## Appendix: Phase 1 Screen Inventory

| Screen | Route | Priority | PRD Section |
|--------|-------|----------|-------------|
| Sign In / Sign Up | `/auth` | P0 | §6 |
| Dashboard | `/` | P0 | §8.1 |
| Pipeline | `/pipeline` | P0 | §8.2 |
| Opportunity Detail | `/pipeline/[id]` | P0 | §8.3 |
| Opportunity Drawer | (overlay on `/pipeline`) | P0 | §8.2 |
| Compare | `/compare` | P1 | §8.4 |
| Resume Studio | `/resumes` | P1 | §8.5 |
| Resume Detail | `/resumes/[id]` | P1 | §8.5 |
| Profile & Settings | `/settings` | P1 | §8.9 |

---

*This brief is ready for handoff to `/impeccable craft` or direct implementation. All design decisions are grounded in the PRD v1.0, the project's design context, and the confirmed discovery answers.*
