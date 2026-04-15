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
    description: "Side-by-side role review",
  },
  {
    href: "/resumes",
    label: "Resumes",
    description: "Tailored resume workshop",
  },
  {
    href: "/scans",
    label: "Scans",
    description: "Source monitoring comes later",
    disabled: true,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Profile and scoring preferences",
  },
];

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
    label: "Open evaluation intake",
    description: "Prepare the next URL-based evaluation flow",
    href: "/",
    keywords: ["new", "evaluate", "url", "intake"],
  },
  {
    id: "action-compare",
    group: "Actions",
    label: "Set up a comparison board",
    description: "Move into the multi-role decision view",
    href: "/compare",
    keywords: ["compare", "board", "roles"],
  },
  {
    id: "action-resume",
    group: "Actions",
    label: "Continue tailoring a resume",
    description: "Jump directly into resume studio",
    href: "/resumes",
    keywords: ["resume", "tailor", "pdf"],
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
