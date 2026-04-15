import type { Opportunity } from "@/lib/types";

import {
  formatTrackerFields,
  isTrackerRow,
  splitTrackerFields,
} from "./parse-applications";

function reportLinkParts(value: string) {
  const match = /\[(\d+)\]\(([^)]+)\)/.exec(value);

  return {
    reportNumber: match?.[1] ?? null,
    reportPath: match?.[2] ?? null,
  };
}

export function updateTrackerMarkdown(
  markdown: string,
  target: Opportunity,
  changes: {
    notes?: string;
    status?: string;
  },
) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  let updated = false;

  const nextLines = lines.map((line) => {
    if (!isTrackerRow(line)) {
      return line;
    }

    const fields = splitTrackerFields(line);
    const rowNumber = Number(fields[0] ?? "");
    const rowCompany = fields[2] ?? "";
    const rowRole = fields[3] ?? "";
    const reportInfo = reportLinkParts(fields[7] ?? "");

    const matchesTarget =
      (target.reportPath && reportInfo.reportPath === target.reportPath) ||
      (target.reportNumber && reportInfo.reportNumber === target.reportNumber) ||
      (rowNumber === target.num &&
        rowCompany === target.company &&
        rowRole === target.role);

    if (!matchesTarget) {
      return line;
    }

    while (fields.length < 9) {
      fields.push("");
    }

    if (typeof changes.status === "string") {
      fields[5] = changes.status;
    }

    if (typeof changes.notes === "string") {
      fields[8] = changes.notes;
    }

    updated = true;
    return formatTrackerFields(fields);
  });

  return {
    updated,
    markdown: nextLines.join("\n"),
  };
}
