import path from "node:path";

import {
  type CompensationDatum,
  type CvMatchItem,
  type Evaluation,
  type EvaluationSection,
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

function extractSections(markdown: string): EvaluationSection[] {
  const expression = /^##\s+(.+?)\s*$([\s\S]*?)(?=^##\s+|\Z)/gim;
  const sections: EvaluationSection[] = [];

  for (const match of markdown.matchAll(expression)) {
    const heading = match[1]?.trim();
    const body = match[2]?.trim() ?? "";

    if (!heading) {
      continue;
    }

    sections.push({ heading, body });
  }

  return sections;
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

function sectionLetter(heading: string) {
  const match = /^\s*(?:block\s+)?([A-Z])(?:\s*[)\-—:]|\b)/i.exec(heading);
  return match?.[1]?.toUpperCase() ?? null;
}

function stripMarkdownMarkers(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^[*-]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSummaryCandidate(section: string) {
  return splitParagraphs(section)
    .map((paragraph) => paragraph.trim())
    .find((paragraph) => {
      if (!paragraph) {
        return false;
      }

      if (paragraph.startsWith("|")) {
        return false;
      }

      if (/^\*\*[\d.]+\/5\*\*$/.test(paragraph)) {
        return false;
      }

      return true;
    });
}

function findSection(
  sections: EvaluationSection[],
  sectionsByLetter: Map<string, EvaluationSection>,
  patterns: RegExp[],
  letterFallback?: string,
) {
  return (
    sections.find((section) => patterns.some((pattern) => pattern.test(section.heading))) ??
    (letterFallback ? sectionsByLetter.get(letterFallback) : undefined) ??
    null
  );
}

function firstUsefulLine(section: string, patterns: RegExp[]) {
  return section
    .split("\n")
    .map((line) => stripMarkdownMarkers(line.replace(/^#+\s*/, "")))
    .find((line) => line && patterns.some((pattern) => pattern.test(line))) ?? null;
}

function extractInlineValue(section: string, label: RegExp) {
  const match = new RegExp(
    `(?:^|\\n)\\s*(?:[-*]\\s*)?(?:\\*\\*)?${label.source}:?(?:\\*\\*)?\\s*(.+)`,
    "i",
  ).exec(section);
  return match?.[1] ? stripMarkdownMarkers(match[1]) : null;
}

function extractCompensationSignal(section: string) {
  const value = firstUsefulLine(section, [/\$|CAD|hour|salary|comp|rate/i]);
  return value?.replace(/^Metric\s+Value\s+Source\s*/i, "") ?? null;
}

function extractLocationSignal(section: string) {
  return firstUsefulLine(section, [
    /\b(remote|hybrid|on-?site|office|location)\b/i,
    /\b(Toronto|Ottawa|Canada|Ontario)\b/i,
  ]);
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
  const sections = extractSections(markdown);
  const sectionsByLetter = new Map(
    sections
      .map((section) => [sectionLetter(section.heading), section] as const)
      .filter((entry): entry is [string, EvaluationSection] => Boolean(entry[0])),
  );
  const score = Number(extractMetadataValue(markdown, "Score")?.match(/[\d.]+/)?.[0] ?? 0);
  const archetype =
    extractMetadataValue(markdown, "Archetype") ??
    extractMetadataValue(markdown, "Arquetipo") ??
    "Unknown";
  const date = extractMetadataValue(markdown, "Date");
  const url = extractMetadataValue(markdown, "URL");
  const pdfPath = extractMetadataValue(markdown, "PDF");
  const batchId = extractMetadataValue(markdown, "Batch ID");

  const roleSection = findSection(
    sections,
    sectionsByLetter,
    [/role\s+(summary|snapshot)/i],
    "A",
  );
  const cvMatchSection = findSection(
    sections,
    sectionsByLetter,
    [/\b(match|cv)\b/i],
    "B",
  );
  const levelSection = findSection(
    sections,
    sectionsByLetter,
    [/\b(level|seniority|strategy)\b/i],
    undefined,
  );
  const northStarSection = findSection(
    sections,
    sectionsByLetter,
    [/north\s*star|mission|alignment/i],
    undefined,
  );
  const compensationSection = findSection(
    sections,
    sectionsByLetter,
    [/\b(comp|compensation|salary|pay|demand)\b/i],
    "D",
  );
  const personalizationSection = findSection(
    sections,
    sectionsByLetter,
    [/\b(personalization|application|tailor|resume)\b/i],
    undefined,
  );
  const interviewSection = findSection(
    sections,
    sectionsByLetter,
    [/\b(interview|star)\b/i],
    undefined,
  );
  const redFlagSection = findSection(
    sections,
    sectionsByLetter,
    [/\b(red\s*flags?|risks?)\b/i],
    undefined,
  );
  const sectionA = roleSection?.body ?? "";
  const sectionB = cvMatchSection?.body ?? "";
  const sectionC = levelSection?.body ?? "";
  const sectionD = compensationSection?.body ?? "";
  const sectionE = personalizationSection?.body ?? "";
  const sectionF = interviewSection?.body ?? "";
  const keywordsSection =
    sections.find((section) => /^keywords\b/i.test(section.heading))?.body ?? "";

  const roleSummaryRows = parseMarkdownTable(sectionA);
  const roleSummary = roleSummaryRows.reduce<Record<string, string>>((record, row) => {
    const field = row.Field ?? row["**Field**"] ?? "";
    const value = row.Value ?? row["**Value**"] ?? "";

    if (field) {
      record[field.replace(/\*\*/g, "")] = value.replace(/\*\*/g, "");
    }

    return record;
  }, {});
  const inferredArchetype = extractInlineValue(northStarSection?.body ?? "", /Archetype/);
  const inferredCompensation = extractCompensationSignal(sectionD);
  const inferredLocation = extractLocationSignal(`${sectionA}\n${sections.find((section) => /culture|signal/i.test(section.heading))?.body ?? ""}`);

  if (inferredArchetype && !roleSummary.Archetype) {
    roleSummary.Archetype = inferredArchetype;
  }

  if (inferredCompensation && !roleSummary.Comp && !roleSummary.Compensation) {
    roleSummary.Comp = inferredCompensation;
  }

  if (inferredLocation && !roleSummary.Location && !roleSummary.Remote) {
    roleSummary.Location = inferredLocation;
  }

  const cvMatchTable = parseMarkdownTable(sectionB).map<CvMatchItem>((row) => ({
    requirement: row["JD Requirement"] ?? "",
    match: row["CV Match"] ?? "",
    source: row.Evidence ?? row.Source ?? "",
  }));

  const matchGapsTable = parseMarkdownTable(
    sectionB.split(/^###\s+Gaps(?:\s+and\s+Mitigation)?$/im)[1] ?? "",
  ).map((row) => ({
    gap: row.Gap ?? "",
    severity: severityFromText(row.Severity ?? ""),
    mitigation: row.Mitigation ?? "",
  }));
  const redFlagsTable = parseMarkdownTable(redFlagSection?.body ?? "").map((row) => ({
    gap: row.Flag ?? row.Gap ?? "",
    severity: severityFromText(row.Severity ?? ""),
    mitigation: row.Notes ?? row.Mitigation ?? "",
  }));
  const gapsTable = matchGapsTable.length ? matchGapsTable : redFlagsTable;

  const sectionCParagraphs = splitParagraphs(sectionC);
  const detectedLevel =
    /\*\*(?:Detected|Role) level:\*\*\s*(.+)$/im.exec(sectionC)?.[1]?.trim() ??
    null;
  const candidateLevel =
    /\*\*Candidate(?:'s natural)? level:\*\*\s*(.+)$/im.exec(sectionC)?.[1]?.trim() ??
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
    story: row["Story (STAR+R)"] ?? row["STAR Story"] ?? "",
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
    roleSummary["TL;DR"] ||
    roleSummary["TL;DR:"] ||
    roleSummaryRows[0]?.Value ||
    stripMarkdownMarkers(extractSummaryCandidate(sectionA) ?? "") ||
    stripMarkdownMarkers(extractSummaryCandidate(sectionB) ?? "") ||
    "Evaluation available.";

  return {
    opportunityNum: extractOpportunityNumber(reportPath),
    score,
    grade: scoreToGrade(score),
    archetype: archetype === "Unknown" ? (inferredArchetype ?? archetype) : archetype,
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
    sections,
  };
}
