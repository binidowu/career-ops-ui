# Career-Ops Web UI — Build Progress

## Step 1: Project Scaffolding

- [x] Install Node 22 LTS via nvm (v22.22.2)
- [x] Create `/Users/binidowu/career-ops-ui` directory
- [x] Initialize Next.js 16.2.3 with App Router, TypeScript, vanilla CSS, src/ dir
- [x] Remove boilerplate and strip default styles
- [x] Create project directory structure (components, lib, styles)
- [x] Add `.env.local` with CAREER_OPS_PATH
- [x] Verify `npm run build` passes clean
- [x] Verify `npm run dev` starts successfully

## Step 2: Design System (CSS Foundation)

- [x] Create tokenized OKLCH palette, typography, spacing, motion, and layout variables
- [x] Add reset styles, global primitives, utility classes, and adaptive light/dark support
- [x] Establish the editorial visual system used across shell, tables, drawers, and forms

## Step 3: Global Shell & Routing

- [x] Build root layout, sticky topbar, responsive navigation, skip link, and shell frame
- [x] Add command palette, toast region, and route-aware navigation state
- [x] Scaffold dashboard, pipeline, compare, resumes, settings, and opportunity detail routes

## Step 4: Data Layer

- [x] Parse tracker markdown, reports, states, and profile YAML into typed objects
- [x] Add server-side career-ops API helpers with cache invalidation and workspace discovery
- [x] Expose route handlers for opportunities, opportunity detail, profile, and dashboard stats
- [x] Support tracker/profile mutations back into the connected career-ops workspace

## Step 5: Core Screens (P0)

- [x] Replace placeholder dashboard with a live command-center overview
- [x] Build interactive pipeline workspace with sticky filters, sorting, selection, and drawer
- [x] Add opportunity detail page with live evaluation and mutation controls
- [x] Add working profile settings form with save feedback

## Step 6: Remaining Screens & Auth — next

- [x] Deepen Compare into a true multi-role analysis workspace
- [x] Turn Resume Studio into a real tailoring/export flow
- [ ] Add multi-user authentication and protected routes
