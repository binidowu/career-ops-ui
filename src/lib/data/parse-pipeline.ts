import type { PipelineInboxItem } from "@/lib/types";

const PENDING_HEADER = "## Pendientes";
const PROCESSED_HEADER = "## Procesadas";

function normalizeLine(line: string) {
  return line.trim();
}

function parsePendingLine(line: string): PipelineInboxItem | null {
  const match = /^- \[( |x|!)\]\s+(.+)$/.exec(normalizeLine(line));
  if (!match) return null;

  const state =
    match[1] === "x" ? "processed" : match[1] === "!" ? "error" : "pending";
  const content = match[2].trim();
  const [url = "", companyHint = "", roleHint = ""] = content.split("|").map((part) => part.trim());

  if (!url) return null;

  return {
    url,
    companyHint: companyHint || null,
    roleHint: roleHint || null,
    raw: content,
    state,
    reportNumber: null,
    score: null,
  };
}

function parseProcessedLine(line: string): PipelineInboxItem | null {
  const match = /^- \[x\]\s+#(\d+)\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|\s+([0-9.]+\/5|N\/A)\s+\|/.exec(
    normalizeLine(line),
  );

  if (!match) {
    return parsePendingLine(line);
  }

  return {
    reportNumber: match[1],
    url: match[2].trim(),
    companyHint: match[3].trim(),
    roleHint: match[4].trim(),
    score: match[5].trim(),
    raw: line.trim(),
    state: "processed",
  };
}

export function createEmptyPipelineMarkdown() {
  return `${PENDING_HEADER}\n\n${PROCESSED_HEADER}\n`;
}

export function parsePipelineMarkdown(text: string) {
  const pending: PipelineInboxItem[] = [];
  const processed: PipelineInboxItem[] = [];

  let section: "pending" | "processed" | null = null;

  for (const rawLine of text.split("\n")) {
    const line = normalizeLine(rawLine);

    if (!line) continue;
    if (line === PENDING_HEADER) {
      section = "pending";
      continue;
    }
    if (line === PROCESSED_HEADER) {
      section = "processed";
      continue;
    }
    if (!line.startsWith("- [")) continue;

    const parsed =
      section === "processed" ? parseProcessedLine(line) : parsePendingLine(line);

    if (!parsed) continue;

    if (section === "processed" || parsed.state === "processed") {
      processed.push(parsed);
    } else {
      pending.push(parsed);
    }
  }

  return { pending, processed };
}

export function appendPendingUrlsToPipeline(text: string, entries: string[]) {
  const base = text.trim() ? text : createEmptyPipelineMarkdown();
  const normalizedEntries = entries.map((entry) => `- [ ] ${entry.trim()}`);

  if (!normalizedEntries.length) {
    return base.endsWith("\n") ? base : `${base}\n`;
  }

  const markerIndex = base.indexOf(PENDING_HEADER);
  if (markerIndex === -1) {
    return `${createEmptyPipelineMarkdown().replace(PROCESSED_HEADER, `${normalizedEntries.join("\n")}\n\n${PROCESSED_HEADER}`)}`;
  }

  const afterPendingIndex = markerIndex + PENDING_HEADER.length;
  const nextSectionIndex = base.indexOf(`\n${PROCESSED_HEADER}`, afterPendingIndex);
  const insertAt = nextSectionIndex === -1 ? base.length : nextSectionIndex;
  const prefix = base.slice(0, insertAt).replace(/\s*$/, "");
  const suffix = base.slice(insertAt).replace(/^\s*/, "\n");

  return `${prefix}\n\n${normalizedEntries.join("\n")}${suffix.endsWith("\n") ? suffix : `${suffix}\n`}`;
}
