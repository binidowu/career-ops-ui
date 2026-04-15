import type { OpportunityStatus, StateDefinition } from "@/lib/types";

import { parseYaml } from "./yaml-lite";

const FALLBACK_STATUS_RULES: Array<{
  match: string[];
  value: OpportunityStatus;
}> = [
  {
    match: ["no aplicar", "no_aplicar", "geo blocker", "skip", "monitor"],
    value: "SKIP",
  },
  {
    match: ["interview", "entrevista"],
    value: "Interview",
  },
  {
    match: ["offer", "oferta"],
    value: "Offer",
  },
  {
    match: ["responded", "respondido"],
    value: "Responded",
  },
  {
    match: ["applied", "aplicado", "aplicada", "enviada", "sent"],
    value: "Applied",
  },
  {
    match: ["rejected", "rechazado", "rechazada"],
    value: "Rejected",
  },
  {
    match: [
      "discarded",
      "descartado",
      "descartada",
      "cerrada",
      "cancelada",
      "duplicado",
      "dup",
    ],
    value: "Discarded",
  },
  {
    match: ["evaluated", "evaluada", "condicional", "hold", "evaluar", "verificar"],
    value: "Evaluated",
  },
];

function toOpportunityStatus(value: string): OpportunityStatus {
  switch (value) {
    case "Evaluated":
    case "Applied":
    case "Responded":
    case "Interview":
    case "Offer":
    case "Rejected":
    case "Discarded":
    case "SKIP":
      return value;
    default:
      return "Unknown";
  }
}

export function parseStatesYaml(text: string): StateDefinition[] {
  const parsed = parseYaml(text);
  const states = Array.isArray(parsed.states) ? parsed.states : [];

  return states
    .map((entry) => {
      if (!entry || Array.isArray(entry) || typeof entry !== "object") {
        return null;
      }

      const aliases = Array.isArray(entry.aliases)
        ? entry.aliases
            .map((alias) => (typeof alias === "string" ? alias : String(alias)))
            .filter(Boolean)
        : [];

      return {
        id: String(entry.id ?? ""),
        label: toOpportunityStatus(String(entry.label ?? "")),
        aliases,
        description: String(entry.description ?? ""),
        dashboardGroup: String(entry.dashboard_group ?? ""),
      } satisfies StateDefinition;
    })
    .filter((state): state is StateDefinition => state !== null && state.id !== "");
}

function normalizeStatusToken(raw: string) {
  const withoutBold = raw.replaceAll("**", "").trim().toLowerCase();
  return withoutBold.replace(/\s+20\d{2}-\d{2}-\d{2}$/, "").trim();
}

export function normalizeOpportunityStatus(
  raw: string,
  states: StateDefinition[],
): OpportunityStatus {
  const normalized = normalizeStatusToken(raw);

  for (const state of states) {
    const candidates = [
      state.id.toLowerCase(),
      state.label.toLowerCase(),
      ...state.aliases.map((alias) => alias.toLowerCase()),
    ];

    if (candidates.includes(normalized)) {
      return state.label;
    }
  }

  for (const rule of FALLBACK_STATUS_RULES) {
    if (rule.match.some((candidate) => normalized.includes(candidate))) {
      return rule.value;
    }
  }

  return "Unknown";
}

export function createEmptyStatusCounts(): Record<OpportunityStatus, number> {
  return {
    Evaluated: 0,
    Applied: 0,
    Responded: 0,
    Interview: 0,
    Offer: 0,
    Rejected: 0,
    Discarded: 0,
    SKIP: 0,
    Unknown: 0,
  };
}
