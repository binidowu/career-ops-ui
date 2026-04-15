import path from "node:path";

import {
  type CompensationDatum,
  type CvMatchItem,
  type Evaluation,
  type InterviewPrepItem,
  type PersonalizationItem,
  scoreToGrade,
} from "@/lib/types";

function extractMetadataValue(markdown: string, label: string) {
  const expression = new RegExp(
    `^\\*\\*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\*\\*\\s*(.+)$`,
    "im",
  );
  return expression.exec(markdown)?.[1]?.trim() ?? null;
}

function extractSection(markdown: string, heading: string) {
  const expression = new RegExp(
    `^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`,
    "im",
  );
  return expression.exec(markdown)?.[1]?.trim() ?? "";
}

function splitParagraphs(section: string) {
  return section
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function parseMarkdownTable(section: string) {
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (lines.length < 2) {
    return [] as Array<Record<string, string>>;
  }

  const header = lines[0]
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

  return lines
    .slice(2)
    .map((line) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((row) => row.length >= header.length)
    .map((row) =>
      header.reduce<Record<string, string>>((record, key, index) => {
        record[key] = row[index] ?? "";
        return record;
      }, {}),
    );
}

function severityFromText(value: string): "critical" | "minor" | "moderate" {
  const normalized = value.toLowerCase();

  if (normalized.includes("critical") || normalized.includes("high")) {
    return "critical";
  }

  if (normalized.includes("low") || normalized.includes("minor")) {
    return "minor";
  }

  return "moderate";
}

function summarizeParagraphs(paragraphs: string[]) {
  return paragraphs.join("\n\n").trim();
}

function extractOpportunityNumber(reportPath: string | null) {
  if (!reportPath) {
    return null;
  }

  const base = path.basename(reportPath);
  const match = /^(\d+)/.exec(base);
  return match ? Number(match[1]) : null;
}

export function parseReportMarkdown(
  markdown: string,
  reportPath: string | null,
): Evaluation {
  const score = Number(extractMetadataValue(markdown, "Score")?.match(/[\d.]+/)?.[0] ?? 0);
  const archetype =
    extractMetadataValue(markdown, "Archetype") ??
    extractMetadataValue(markdown, "Arquetipo") ??
    "Unknown";
  const date = extractMetadataValue(markdown, "Date");
  const url = extractMetadataValue(markdown, "URL");
  const pdfPath = extractMetadataValue(markdown, "PDF");
  const batchId = extractMetadataValue(markdown, "Batch ID");

  const sectionA = extractSection(markdown, "A) Role Summary");
  const sectionB = extractSection(markdown, "B) CV Match");
  const sectionC = extractSection(markdown, "C) Level and Strategy");
  const sectionD = extractSection(markdown, "D) Comp and Demand");
  const sectionE = extractSection(markdown, "E) Personalization Plan");
  const sectionF = extractSection(markdown, "F) Interview Plan");
  const keywordsSection = extractSection(markdown, "Keywords Extracted");

  const roleSummaryRows = parseMarkdownTable(sectionA);
  const roleSummary = roleSummaryRows.reduce<Record<string, string>>((record, row) => {
    const field = row.Field ?? row["**Field**"] ?? "";
    const value = row.Value ?? row["**Value**"] ?? "";

    if (field) {
      record[field.replace(/\*\*/g, "")] = value.replace(/\*\*/g, "");
    }

    return record;
  }, {});

  const cvMatchTable = parseMarkdownTable(sectionB).map<CvMatchItem>((row) => ({
    requirement: row["JD Requirement"] ?? "",
    match: row["CV Match"] ?? "",
    source: row.Source ?? "",
  }));

  const gapsTable = parseMarkdownTable(
    sectionB.split(/^###\s+Gaps$/im)[1] ?? "",
  ).map((row) => ({
    gap: row.Gap ?? "",
    severity: severityFromText(row.Severity ?? ""),
    mitigation: row.Mitigation ?? "",
  }));

  const sectionCParagraphs = splitParagraphs(sectionC);
  const detectedLevel =
    /\*\*Detected level:\*\*\s*(.+)$/im.exec(sectionC)?.[1]?.trim() ?? null;
  const candidateLevel =
    /\*\*Candidate's natural level:\*\*\s*(.+)$/im.exec(sectionC)?.[1]?.trim() ??
    null;

  const compensationItems = parseMarkdownTable(sectionD).map<CompensationDatum>((row) => ({
    dataPoint: row["Data Point"] ?? "",
    value: row.Value ?? "",
    source: row.Source ?? "",
  }));

  const personalizationItems = parseMarkdownTable(sectionE).map<PersonalizationItem>((row) => ({
    index: row["#"] ?? "",
    section: row.Section ?? "",
    current: row.Current ?? "",
    proposedChange: row["Proposed Change"] ?? "",
    why: row.Why ?? "",
  }));

  const interviewItems = parseMarkdownTable(sectionF).map<InterviewPrepItem>((row) => ({
    index: row["#"] ?? "",
    requirement: row["JD Requirement"] ?? "",
    story: row["STAR Story"] ?? "",
    situation: row.S ?? "",
    task: row.T ?? "",
    action: row.A ?? "",
    result: row.R ?? "",
  }));

  const keywords = keywordsSection
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const summary =
    roleSummary["TL;DR"] ??
    roleSummary["TL;DR:"] ??
    roleSummaryRows[0]?.Value ??
    "Evaluation available.";

  return {
    opportunityNum: extractOpportunityNumber(reportPath),
    score,
    grade: scoreToGrade(score),
    archetype,
    summary,
    date,
    url,
    pdfPath,
    batchId,
    roleSummary,
    dimensions: [],
    cvMatchItems: cvMatchTable,
    gapItems: gapsTable,
    seniorityStrategy: summarizeParagraphs(sectionCParagraphs),
    detectedLevel,
    candidateLevel,
    compensationAnalysis: summarizeParagraphs(splitParagraphs(sectionD)),
    compensationItems,
    personalizationNotes: summarizeParagraphs(splitParagraphs(sectionE)),
    personalizationItems,
    interviewPrep: summarizeParagraphs(splitParagraphs(sectionF)),
    interviewItems,
    keywords,
    generatedAt: date ?? "",
  };
}
