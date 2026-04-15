import path from "node:path";

import type { Opportunity, StateDefinition } from "@/lib/types";

import { normalizeOpportunityStatus } from "./parse-states";

const REPORT_LINK_RE = /\[(\d+)\]\(([^)]+)\)/;
const SCORE_RE = /(\d+(?:\.\d+)?)\s*\/\s*5/;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createOpportunityId(parts: {
  company: string;
  num: number;
  reportPath: string | null;
  role: string;
}) {
  if (parts.reportPath) {
    return slugify(path.basename(parts.reportPath, path.extname(parts.reportPath)));
  }

  return slugify(`${parts.num}-${parts.company}-${parts.role}`);
}

export function splitTrackerFields(line: string) {
  if (line.includes("\t")) {
    return line
      .replace(/^\|/, "")
      .split("\t")
      .map((field) => field.replace(/\|/g, "").trim());
  }

  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((field) => field.trim());
}

export function isTrackerRow(line: string) {
  const trimmed = line.trim();

  return (
    trimmed.startsWith("|") &&
    !trimmed.startsWith("| #") &&
    !trimmed.startsWith("|---") &&
    trimmed !== "|"
  );
}

export function formatTrackerFields(fields: string[]) {
  return `| ${fields.join(" | ")} |`;
}

export function parseApplicationsMarkdown(
  markdown: string,
  states: StateDefinition[],
): Opportunity[] {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const opportunities: Opportunity[] = [];
  let fallbackNumber = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!isTrackerRow(line)) {
      continue;
    }

    const fields = splitTrackerFields(line);

    if (fields.length < 8) {
      continue;
    }

    const parsedNum = Number(fields[0]);
    const num = Number.isFinite(parsedNum) && parsedNum > 0 ? parsedNum : fallbackNumber + 1;
    fallbackNumber = num;

    const reportMatch = REPORT_LINK_RE.exec(fields[7] ?? "");
    const reportNumber = reportMatch?.[1] ?? null;
    const reportPath = reportMatch?.[2] ?? null;
    const scoreMatch = SCORE_RE.exec(fields[4] ?? "");
    const score = scoreMatch ? Number(scoreMatch[1]) : null;
    const statusRaw = fields[5] ?? "";

    opportunities.push({
      id: createOpportunityId({
        company: fields[2] ?? "",
        num,
        reportPath,
        role: fields[3] ?? "",
      }),
      num,
      date: fields[1] ?? "",
      company: fields[2] ?? "",
      role: fields[3] ?? "",
      score,
      scoreRaw: fields[4] ?? "",
      status: normalizeOpportunityStatus(statusRaw, states),
      statusRaw,
      hasPdf: (fields[6] ?? "").includes("✅"),
      reportPath,
      reportNumber,
      notes: fields[8] ?? "",
      jobUrl: null,
      archetype: null,
      summary: null,
      remote: null,
      compensation: null,
    });
  }

  return opportunities;
}
