import type { Opportunity } from "@/lib/types";

export interface NavItem {
  description: string;
  href: string;
  label: string;
  disabled?: boolean;
}

export interface CommandItem {
  description: string;
  group: "Navigation" | "Opportunities" | "Actions";
  href?: string;
  id: string;
  keywords: string[];
  label: string;
  disabled?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    description: "Overview and next actions",
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    description: "Tracked opportunities and status",
  },
  {
    href: "/compare",
    label: "Compare",
    description: "Compare shortlisted roles",
  },
  {
    href: "/resumes",
    label: "Resumes",
    description: "Tailor and export resumes",
  },
  {
    href: "/apply",
    label: "Apply",
    description: "Apply pipeline, cover letters, and outreach drafts",
  },
  {
    href: "/scans",
    label: "Scans",
    description: "Queue pasted links and run backend scanners",
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Profile and scoring preferences",
  },
];

export const PRIMARY_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter((item) =>
  ["Dashboard", "Pipeline", "Compare", "Resumes"].includes(item.label),
);

export const COMMAND_ITEMS: CommandItem[] = [
  ...NAV_ITEMS.map((item) => ({
    id: `nav-${item.label.toLowerCase()}`,
    group: "Navigation" as const,
    keywords: [item.label.toLowerCase(), item.description.toLowerCase()],
    ...item,
  })),
  {
    id: "action-evaluate",
    group: "Actions",
    label: "Review next roles",
    description: "Go back to the dashboard and decide what to work on next",
    href: "/",
    keywords: ["new", "evaluate", "url", "intake"],
  },
  {
    id: "action-compare",
    group: "Actions",
    label: "Open comparison board",
    description: "Move shortlisted roles into side-by-side review",
    href: "/compare",
    keywords: ["compare", "board", "roles"],
  },
  {
    id: "action-resume",
    group: "Actions",
    label: "Open Resume Studio",
    description: "Go straight to tailoring and PDF export",
    href: "/resumes",
    keywords: ["resume", "tailor", "pdf"],
  },
  {
    id: "action-apply",
    group: "Actions",
    label: "Open Apply Pipeline",
    description: "Draft cover letters, write outreach, and track submissions",
    href: "/apply",
    keywords: ["apply", "cover letter", "outreach", "submit", "application"],
  },
  {
    id: "action-scan",
    group: "Actions",
    label: "Open Intake Console",
    description: "Paste URLs, inspect the inbox, and run the backend scanner",
    href: "/scans",
    keywords: ["scan", "scanner", "intake", "pipeline", "queue"],
  },
];

export function buildCommandItems(opportunities: Opportunity[]): CommandItem[] {
  const opportunityItems = opportunities.map<CommandItem>((opportunity) => ({
    id: `opp-${opportunity.id}`,
    group: "Opportunities",
    label: `${opportunity.company} · ${opportunity.role}`,
    description: [
      typeof opportunity.score === "number"
        ? `${opportunity.score.toFixed(1)} score`
        : opportunity.scoreRaw || "No score yet",
      opportunity.status,
      opportunity.summary ?? opportunity.notes,
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/pipeline/${opportunity.id}`,
    keywords: [
      opportunity.company.toLowerCase(),
      opportunity.role.toLowerCase(),
      opportunity.status.toLowerCase(),
      opportunity.archetype?.toLowerCase() ?? "",
      opportunity.summary?.toLowerCase() ?? "",
    ].filter(Boolean),
  }));

  return [...COMMAND_ITEMS, ...opportunityItems];
}

export function matchesCommand(query: string, item: CommandItem) {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return true;
  }

  const tokens = trimmed.split(/\s+/);
  const haystack = [item.label, item.description, ...item.keywords]
    .join(" ")
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}
