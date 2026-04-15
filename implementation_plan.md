# Career-Ops Web UI — Implementation Plan

## Goal

Build the Phase 1 (Foundation) web UI for Career-Ops: a Next.js application in a separate repo that wraps the existing CLI tools via an API layer, reads from the file system, and delivers 7 screens with multi-user auth, system-adaptive theming, and WCAG AAA accessibility.

## User Review Required

> [!IMPORTANT]
> **Node.js upgrade required.** Your current Node is v18.20.8. The latest Next.js (v16) requires Node ≥ 20.9.0. I'll install Node 20 or 22 via nvm as the first step. Is Node 22 LTS (Jod) acceptable, or do you prefer Node 20 LTS (Iron)?

> [!IMPORTANT]
> **Repo location.** I'll create the project at `/Users/binidowu/career-ops-ui`. Let me know if you want a different location.

> [!IMPORTANT]
> **Auth choice.** For multi-user auth, I'll use **NextAuth.js v5** (Auth.js) with email/password credentials. This is zero-cost, self-hosted, and doesn't add external dependencies. If you'd prefer Clerk or Auth0, let me know.

---

## Proposed Changes

The build is organized into 6 incremental steps. Each step produces something testable.

---

### Step 1 — Project Scaffolding

Set up the Next.js project with the correct tooling and structure.

#### [NEW] `/Users/binidowu/career-ops-ui/`

- Initialize Next.js 16 with App Router, TypeScript, vanilla CSS (no Tailwind), `src/` directory, ESLint
- Install Node 20+ via nvm
- Command: `npx -y create-next-app@latest ./ --ts --app --src-dir --eslint --no-tailwind --use-npm --yes`
- Create project structure:

```
career-ops-ui/
├── src/
│   ├── app/              # App Router pages
│   │   ├── layout.tsx     # Root layout (global shell)
│   │   ├── page.tsx       # Dashboard
│   │   ├── pipeline/
│   │   ├── compare/
│   │   ├── resumes/
│   │   └── settings/
│   ├── components/        # Shared UI components
│   │   ├── shell/         # Topbar, CommandPalette
│   │   ├── pipeline/      # Table, Drawer, Filters
│   │   ├── dashboard/     # Widgets, Metrics
│   │   └── common/        # Toast, Badge, Button, etc.
│   ├── lib/               # Data layer, API utilities
│   │   ├── data/          # File parsers (markdown, YAML)
│   │   └── api/           # Server-side data access
│   └── styles/            # CSS design system
│       ├── tokens.css     # Colors, spacing, typography tokens
│       ├── reset.css      # CSS reset
│       ├── globals.css    # Global styles
│       └── components/    # Per-component CSS modules
├── public/
└── .env.local             # CAREER_OPS_PATH, auth secrets
```

---

### Step 2 — Design System (CSS Foundation)

Build the complete CSS token system before any components. This is the visual foundation for everything.

#### [NEW] `src/styles/tokens.css`

- **Color palette** in OKLCH — new direction, not teal+purple
  - System-adaptive via `prefers-color-scheme` and CSS `light-dark()`
  - Neutrals tinted toward brand hue
  - Single accent color for primary actions
  - Semantic colors for grades (A–F) that pass color-vision checks
  - All text meets WCAG AAA (7:1 contrast ratio)
- **Typography** — custom font pairing (not Space Grotesk / DM Sans / anything on the reject list)
  - Modular type scale with fixed `rem` sizes (app UI, not marketing)
  - Tabular figures for data columns
- **Spacing** — 4pt scale with semantic names (`--space-xs` through `--space-3xl`)
- **Elevation** — minimal, no generic drop-shadows
- **Motion** — transition tokens with `prefers-reduced-motion` override
- **Focus** — visible, high-contrast custom focus indicators

#### [NEW] `src/styles/reset.css`

- Minimal CSS reset (box-sizing, margin removal, sensible defaults)

#### [NEW] `src/styles/globals.css`

- Import tokens, reset
- Base element styles (body, headings, links, lists, tables)
- Utility classes (visually-hidden, reduced-motion, etc.)

---

### Step 3 — Global Shell & Routing

Build the app skeleton: topbar, navigation, layout, and page routing.

#### [NEW] `src/components/shell/Topbar.tsx` + `Topbar.module.css`

- Horizontal navigation tabs: Dashboard · Pipeline · Compare · Resumes · Scans (disabled) · Settings
- Right side: ⌘K trigger button, user avatar/menu
- Active tab indicator (subtle bottom line)
- Responsive: collapses to hamburger on narrow viewports

#### [NEW] `src/components/shell/CommandPalette.tsx` + `CommandPalette.module.css`

- ⌘K / Ctrl+K trigger
- Overlay with search input, grouped results (Navigation, Opportunities, Actions)
- Keyboard navigation (arrows, enter, esc)
- Fuzzy search across opportunity titles and company names

#### [NEW] `src/components/common/Toast.tsx` + `Toast.module.css`

- Bottom-right toast container
- Auto-dismiss (4s success, manual dismiss for errors)
- Undo capability for destructive actions

#### [MODIFY] `src/app/layout.tsx`

- Root layout wrapping Topbar + main content area
- Font loading (Google Fonts link or self-hosted woff2)
- CSS imports
- Auth session provider

---

### Step 4 — Data Layer

Build server-side parsers that read from the career-ops file system.

#### [NEW] `src/lib/data/parse-applications.ts`

- Parse `data/applications.md` markdown table into typed `Opportunity[]` objects
- Handle all columns: #, Date, Company, Role, Score, Status, PDF, Report, Notes

#### [NEW] `src/lib/data/parse-report.ts`

- Parse `reports/*.md` files into structured `Evaluation` objects
- Extract: score, grade, archetype, CV match items, gaps, strategy, comp analysis, interview prep

#### [NEW] `src/lib/data/parse-profile.ts`

- Parse `config/profile.yml` into typed `UserProfile` object

#### [NEW] `src/lib/data/parse-states.ts`

- Parse `templates/states.yml` for canonical statuses

#### [NEW] `src/lib/api/career-ops.ts`

- Central module that reads `CAREER_OPS_PATH` from env
- Exposes typed functions: `getOpportunities()`, `getOpportunity(id)`, `getEvaluation(reportPath)`, `getProfile()`, etc.
- Caching strategy: file mtime check to avoid re-parsing unchanged files

#### [NEW] `src/app/api/` routes

- `GET /api/opportunities` — list all pipeline entries
- `GET /api/opportunities/[id]` — single opportunity with evaluation
- `PATCH /api/opportunities/[id]` — update status/notes
- `GET /api/profile` — user profile data
- `PUT /api/profile` — update profile
- `GET /api/stats` — dashboard metrics

---

### Step 5 — Core Screens

Build the 4 P0 screens: Dashboard, Pipeline, Pipeline Drawer (Opportunity Detail), and Opportunity Detail page.

#### [NEW] Dashboard (`src/app/page.tsx`)

- Asymmetric grid: primary column (top scores, follow-ups due), secondary column (pipeline summary, insights)
- Evaluation input at top: "Paste a URL to evaluate"
- All widgets backed by `/api/stats` and `/api/opportunities`

#### [NEW] Pipeline (`src/app/pipeline/page.tsx`)

- Full-width data table with sticky header
- Filter bar: status, archetype, score range, location
- Sort on column headers
- Row click opens detail drawer
- Bulk selection with floating action bar

#### [NEW] Pipeline Drawer (`src/components/pipeline/OpportunityDrawer.tsx`)

- Right-side drawer (480px), slides in on row click
- Shows: header (score, grade, status), 6 evaluation blocks (collapsible), actions toolbar
- Status dropdown with optimistic update + toast
- Close on X, Esc, or click outside

#### [NEW] Opportunity Detail (`src/app/pipeline/[id]/page.tsx`)

- Full-page version of the evaluation
- Two-column: primary (6-block eval), secondary (metadata, status, outputs)
- Activity timeline
- Related outputs: report link, resume link

---

### Step 6 — Remaining Screens & Auth

Build the P1 screens and authentication.

#### [NEW] Compare (`src/app/compare/page.tsx`)

- Horizontally scrollable grid
- Sticky left column (dimension labels)
- 2–5 role columns
- Badges: Best Fit, Best Pay, Best Stretch, Fastest Process
- Role selection from pipeline data

#### [NEW] Resume Studio (`src/app/resumes/page.tsx`)

- Left panel: source opportunity selector, keyword pills (toggleable), template/format options
- Right panel: live preview
- Export PDF button (triggers existing `generate-pdf.mjs` via API)

#### [NEW] Profile & Settings (`src/app/settings/page.tsx`)

- Single-column form (max-width ~720px, centered)
- Sections: Target roles, Salary, Location, Career story, Proof points, CV data, Scoring weights
- Inline save with optimistic updates

#### [NEW] Auth (`src/app/auth/`)

- NextAuth.js v5 with credentials provider
- Sign in / Sign up forms (minimal, professional)
- Session management, protected routes via middleware

---

## Open Questions

> [!IMPORTANT]
> **Font selection**: The design brief requires a non-reflex font pairing. I'll select fonts during Step 2 after running the font selection procedure from the impeccable skill. The final choice will be presented for your approval before building further.

> [!WARNING]
> **File system access at runtime**: The data layer reads from the career-ops directory. This works in local development and self-hosted deploys, but **won't work on Vercel** (serverless, no persistent filesystem). For V1, the assumption is local or Docker deployment. If you plan to host on Vercel, we'd need to add a database layer.

---

## Verification Plan

### Automated Tests

- `npm run build` — ensures no TypeScript errors or build failures
- `npm run lint` — ESLint passes
- Visual inspection via `npm run dev` — each screen rendered in both light and dark mode

### Manual Verification

- Browser testing: Chrome + Safari on macOS
- Keyboard-only navigation through all screens
- Reduced motion: verify with `prefers-reduced-motion: reduce` enabled
- Color-vision simulation: verify grade badges and semantic flags are distinguishable in grayscale
- Data layer: verify parsing against the live career-ops data files
- Mobile breakpoint: verify pipeline table reflows on narrow viewport

### Screen-by-Screen Checklist

| Screen | Renders | Data loads | Interactions work | Light mode | Dark mode | Keyboard nav |
|--------|---------|-----------|-------------------|------------|-----------|-------------|
| Dashboard | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Pipeline | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Drawer | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Detail | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Compare | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Resume | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Settings | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Auth | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
