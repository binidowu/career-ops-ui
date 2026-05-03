import type {
  Evaluation,
  Opportunity,
  OpportunityIntel,
  OpportunityIntelBackgroundFrame,
  OpportunityIntelCvEvidence,
  OpportunityIntelQuestion,
  OpportunityIntelRisk,
  OpportunityIntelRound,
  OpportunityIntelScoreDimension,
  OpportunityIntelStory,
} from "@/lib/types";

type UnknownRecord = Record<string, unknown>;

const EMPTY_INTEL_PREP = {
  checklist: [] as string[],
  likelyQuestions: [] as OpportunityIntelQuestion[],
  rounds: [] as OpportunityIntelRound[],
  stories: [] as OpportunityIntelStory[],
  vocabulary: [] as string[],
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? cleanText(value) : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(asString).filter((item): item is string => Boolean(item)) : [];
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value > 5 ? Math.max(0, Math.min(100, Math.round(value))) : Math.round(value * 20);
}

function cleanText(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/[\u2705\u2611\u2713\u2714\u274C\u26A0\uFE0F]/gu, "")
    .replace(/^\s*[-–—]{3,}\s*$/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function firstMeaningful(...values: Array<string | null | undefined>) {
  return values.find((value) => value && !isPlaceholder(value)) ?? null;
}

function isPlaceholder(value: string | null | undefined) {
  if (!value) return true;
  const cleaned = cleanText(value);
  return /^(unknown|n\/a|none|null|unavailable|not available|-+|—+|gap|blocker\??|mitigation)$/i.test(cleaned);
}

function lookup(record: Record<string, string>, aliases: string[]) {
  const entries = Object.entries(record);

  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hit = entries.find(
      ([key, value]) =>
        value &&
        key.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedAlias,
    );

    if (hit) return cleanText(hit[1]);
  }

  return null;
}

function truncate(value: string, max = 220) {
  if (value.length <= max) return value;
  return `${value.slice(0, max).replace(/\s+\S*$/, "")}...`;
}

function summarizeForUi(value: string | null | undefined, max = 190) {
  const cleaned = value ? cleanText(value) : "";

  if (!cleaned) return null;
  if (cleaned.length <= max) return cleaned;

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const compact = sentences.slice(0, 2).join(" ");

  return truncate(compact && compact.length <= max ? compact : cleaned, max);
}

function compactWorkMode(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = cleanText(value);

  if (/fully\s*remote|remote/i.test(cleaned)) return "Remote";
  if (/hybrid/i.test(cleaned)) return "Hybrid";
  if (/on-?site|office/i.test(cleaned)) return "On-site";
  return summarizeForUi(cleaned, 80);
}

function inferStrength(value: string): OpportunityIntelCvEvidence["strength"] {
  const normalized = value.toLowerCase();
  if (/(not mentioned|missing|no evidence|none)/.test(normalized)) return "missing";
  if (/(partial|adjacent|transferable|some)/.test(normalized)) return "partial";
  if (/(strong|direct|used|listed|proven|matches)/.test(normalized)) return "strong";
  return "unknown";
}

function extractScoreDimensions(
  evaluation: Evaluation | null,
  opportunity: Opportunity,
): OpportunityIntelScoreDimension[] {
  if (evaluation?.dimensions.length) {
    return evaluation.dimensions.map((dimension) => ({
      evidence: dimension.summary ? [cleanText(dimension.summary)] : [],
      label: cleanText(dimension.name),
      rationale: cleanText(dimension.summary),
      score: asNumber(dimension.score),
    }));
  }

  const score = asNumber(opportunity.score ?? evaluation?.score);
  const roleSummary = evaluation?.roleSummary ?? {};
  const location = firstMeaningful(
    opportunity.remote,
    lookup(roleSummary, ["Location", "Remote", "Work mode", "Work Mode", "Office", "HQ"]),
  );

  return [
    {
      label: "Technical alignment",
      score,
      rationale: evaluation?.cvMatchItems.length
        ? `${evaluation.cvMatchItems.length} CV match${evaluation.cvMatchItems.length === 1 ? "" : "es"} surfaced from the report.`
        : "No structured CV-match rows were found in the report.",
      evidence: evaluation?.cvMatchItems.map((item) => cleanText(item.match)).filter(Boolean) ?? [],
    },
    {
      label: "Experience relevance",
      score,
      rationale: firstMeaningful(evaluation?.candidateLevel, evaluation?.detectedLevel) ?? "No level signal extracted from the report.",
      evidence: [],
    },
    {
      label: "Mission fit",
      score,
      rationale: firstMeaningful(evaluation?.archetype, opportunity.archetype) ?? "No archetype signal extracted from the report.",
      evidence: [],
    },
    {
      label: "Compensation overlap",
      score,
      rationale: summarizeForUi(
        firstMeaningful(opportunity.compensation, evaluation?.compensationItems[0]?.value, evaluation?.compensationAnalysis),
        170,
      ) ?? "No compensation signal extracted.",
      evidence: evaluation?.compensationItems.map((item) => `${item.dataPoint}: ${item.value}`).filter(Boolean) ?? [],
    },
    {
      label: "Location compatibility",
      score: location ? (/(remote|flex)/i.test(location) ? 78 : 50) : null,
      rationale: location ?? "No location or work-mode signal extracted.",
      evidence: location ? [location] : [],
    },
    {
      label: "Risk load",
      score,
      rationale: evaluation?.gapItems.length
        ? `${evaluation.gapItems.length} risk area${evaluation.gapItems.length === 1 ? "" : "s"} need framing.`
        : "No structured risk rows were found in the report.",
      evidence: evaluation?.gapItems.map((gap) => cleanText(gap.gap)).filter(Boolean) ?? [],
    },
  ];
}

function extractCvEvidence(evaluation: Evaluation | null): OpportunityIntelCvEvidence[] {
  if (!evaluation?.cvMatchItems.length) return [];

  return evaluation.cvMatchItems
    .map((item) => {
      const match = cleanText(item.match);

      return {
        evidence: truncate(match, 220),
        requirement: truncate(cleanText(item.requirement), 96),
        source: cleanText(item.source || "Evaluation report"),
        strength: inferStrength(`${item.match} ${item.source}`),
      } satisfies OpportunityIntelCvEvidence;
    })
    .filter((item) => !isPlaceholder(item.requirement) && !isPlaceholder(item.evidence));
}

function extractRisks(evaluation: Evaluation | null, opportunity: Opportunity): OpportunityIntelRisk[] {
  if (evaluation?.gapItems.length) {
    return evaluation.gapItems
      .map((gap) => ({
        mitigation: cleanText(gap.mitigation || "Prepare a concise framing before advancing."),
        reason: cleanText(gap.gap),
        severity: gap.severity,
        title: truncate(cleanText(gap.gap), 90),
      }))
      .filter((gap) => !isPlaceholder(gap.reason));
  }

  const risks: OpportunityIntelRisk[] = [];

  if (opportunity.notes) {
    risks.push({
      mitigation: "Resolve this before investing in tailored application work.",
      reason: cleanText(opportunity.notes),
      severity: "moderate",
      title: "Tracker note needs resolution",
    });
  }

  return risks;
}

function extractBackgroundFraming(risks: OpportunityIntelRisk[]): OpportunityIntelBackgroundFrame[] {
  return risks.slice(0, 3).map((risk) => ({
    concern: risk.reason,
    likelyQuestion: risk.title.endsWith("?") ? risk.title : `How would you frame ${risk.title}?`,
    recommendedAnswer: risk.mitigation,
  }));
}

function extractInterviewPrep(evaluation: Evaluation | null): OpportunityIntel["interviewPrep"] {
  if (!evaluation) return EMPTY_INTEL_PREP;

  const stories: OpportunityIntelStory[] = evaluation.interviewItems.map((item) => ({
    action: cleanText(item.action || ""),
    requirement: cleanText(item.requirement || "Role signal"),
    result: cleanText(item.result || ""),
    situation: cleanText(item.situation || ""),
    story: cleanText(item.story || ""),
    task: cleanText(item.task || ""),
  }));

  const checklist = [
    ...evaluation.interviewItems.flatMap((item) =>
      [item.requirement, item.story]
        .filter(Boolean)
        .map((value) => `Rehearse a concise answer for ${cleanText(value)}.`),
    ),
    ...evaluation.gapItems.map((gap) => `Prepare framing for ${cleanText(gap.gap)}.`),
  ].slice(0, 10);

  return {
    checklist,
    likelyQuestions: [],
    rounds: [],
    stories,
    vocabulary: evaluation.keywords.map(cleanText),
  };
}

function coerceSidecar(value: unknown): OpportunityIntel | null {
  if (!isRecord(value)) return null;
  const roleSnapshot = isRecord(value.roleSnapshot) ? value.roleSnapshot : {};
  const recommendation = isRecord(value.recommendation) ? value.recommendation : {};

  return {
    source: "sidecar",
    schemaVersion: 1,
    roleSnapshot: {
      archetype: asString(roleSnapshot.archetype),
      compensation: asString(roleSnapshot.compensation),
      company: asString(roleSnapshot.company) ?? "",
      level: asString(roleSnapshot.level),
      location: asString(roleSnapshot.location),
      role: asString(roleSnapshot.role) ?? "",
      sourceUrl: asString(roleSnapshot.sourceUrl),
      workMode: asString(roleSnapshot.workMode),
    },
    recommendation: {
      nextActions: asStringArray(recommendation.nextActions),
      summary: asString(recommendation.summary) ?? "Evaluation available.",
      verdict: asString(recommendation.verdict) ?? "conditional",
    },
    scoreBreakdown: Array.isArray(value.scoreBreakdown)
      ? value.scoreBreakdown.filter(isRecord).map((item) => ({
          evidence: asStringArray(item.evidence),
          label: asString(item.label) ?? "Score dimension",
          rationale: asString(item.rationale) ?? "",
          score: asNumber(item.score),
        }))
      : [],
    cvEvidence: Array.isArray(value.cvEvidence)
      ? value.cvEvidence.filter(isRecord).map((item) => ({
          evidence: asString(item.evidence) ?? "",
          requirement: asString(item.requirement) ?? "Requirement",
          source: asString(item.source) ?? "UI sidecar",
          strength: (asString(item.strength) as OpportunityIntelCvEvidence["strength"]) ?? "unknown",
        }))
      : [],
    risks: Array.isArray(value.risks)
      ? value.risks.filter(isRecord).map((item) => ({
          mitigation: asString(item.mitigation) ?? "",
          reason: asString(item.reason) ?? "",
          severity: (asString(item.severity) as OpportunityIntelRisk["severity"]) ?? "moderate",
          title: asString(item.title) ?? "Risk",
        }))
      : [],
    backgroundFraming: Array.isArray(value.backgroundFraming)
      ? value.backgroundFraming.filter(isRecord).map((item) => ({
          concern: asString(item.concern) ?? "",
          likelyQuestion: asString(item.likelyQuestion) ?? "",
          recommendedAnswer: asString(item.recommendedAnswer) ?? "",
        }))
      : [],
    interviewPrep: isRecord(value.interviewPrep)
      ? {
          checklist: asStringArray(value.interviewPrep.checklist),
          likelyQuestions: Array.isArray(value.interviewPrep.likelyQuestions)
            ? value.interviewPrep.likelyQuestions.filter(isRecord).map((item) => ({
                angle: asString(item.angle) ?? "",
                prompt: asString(item.prompt) ?? "",
                reason: asString(item.reason) ?? "",
                type: asString(item.type) ?? "general",
              }))
            : [],
          rounds: Array.isArray(value.interviewPrep.rounds)
            ? value.interviewPrep.rounds.filter(isRecord).map((item) => ({
                duration: asString(item.duration) ?? "",
                focus: asString(item.focus) ?? "",
                prepare: asString(item.prepare) ?? "",
                title: asString(item.title) ?? "Interview round",
              }))
            : [],
          stories: Array.isArray(value.interviewPrep.stories)
            ? value.interviewPrep.stories.filter(isRecord).map((item) => ({
                action: asString(item.action) ?? "",
                requirement: asString(item.requirement) ?? "",
                result: asString(item.result) ?? "",
                situation: asString(item.situation) ?? "",
                story: asString(item.story) ?? "",
                task: asString(item.task) ?? "",
              }))
            : [],
          vocabulary: asStringArray(value.interviewPrep.vocabulary),
        }
      : EMPTY_INTEL_PREP,
  };
}

export function parseOpportunityIntelSidecar(raw: string | null) {
  if (!raw) return null;

  try {
    return coerceSidecar(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function buildOpportunityIntel(input: {
  evaluation: Evaluation | null;
  opportunity: Opportunity;
  sidecar?: OpportunityIntel | null;
}): OpportunityIntel {
  const { evaluation, opportunity, sidecar } = input;

  if (sidecar) {
    return {
      ...sidecar,
      roleSnapshot: {
        ...sidecar.roleSnapshot,
        company: sidecar.roleSnapshot.company || opportunity.company,
        role: sidecar.roleSnapshot.role || opportunity.role,
      },
    };
  }

  const roleSummary = evaluation?.roleSummary ?? {};
  const risks = extractRisks(evaluation, opportunity);
  const location = firstMeaningful(
    opportunity.remote,
    lookup(roleSummary, ["Location", "Remote", "Work mode", "Work Mode", "Office", "HQ", "Hybrid"]),
  );
  const compensation = firstMeaningful(
    opportunity.compensation,
    evaluation?.compensationItems[0]?.value,
    lookup(roleSummary, ["Comp", "Compensation", "Salary", "Range", "Pay"]),
  );
  const recommendationSummary = firstMeaningful(opportunity.archetype, evaluation?.archetype)
    ?? summarizeForUi(firstMeaningful(evaluation?.summary, opportunity.summary), 190)
    ?? "Evaluation available.";

  return {
    source: "markdown",
    schemaVersion: 1,
    roleSnapshot: {
      archetype: firstMeaningful(opportunity.archetype, evaluation?.archetype),
      compensation: summarizeForUi(compensation, 120),
      company: opportunity.company,
      level: firstMeaningful(evaluation?.detectedLevel, evaluation?.candidateLevel, lookup(roleSummary, ["Level", "Seniority"])),
      location: summarizeForUi(location, 140),
      role: opportunity.role,
      sourceUrl: opportunity.jobUrl ?? evaluation?.url ?? null,
      workMode: compactWorkMode(firstMeaningful(lookup(roleSummary, ["Work mode", "Work Mode", "Remote"]), location)),
    },
    recommendation: {
      nextActions: [
        "Tailor resume before applying",
        "Use matched evidence in outreach",
        "Resolve location or compensation mismatches",
      ],
      summary: recommendationSummary,
      verdict: risks.some((risk) => risk.severity === "critical") ? "conditional" : "review",
    },
    scoreBreakdown: extractScoreDimensions(evaluation, opportunity),
    cvEvidence: extractCvEvidence(evaluation),
    risks,
    backgroundFraming: extractBackgroundFraming(risks),
    interviewPrep: extractInterviewPrep(evaluation),
  };
}

export function getIntelSidecarPath(reportPath: string) {
  return reportPath.replace(/\.[^.]+$/, ".ui.json");
}
