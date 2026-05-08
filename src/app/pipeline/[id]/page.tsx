import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import OpportunityStatusEditor from "@/components/pipeline/OpportunityStatusEditor";
import { getOpportunity, getStates } from "@/lib/api/career-ops";
import { scoreToGrade, type Evaluation, type EvaluationSection, type Opportunity } from "@/lib/types";

import styles from "./page.module.css";

function parseMarkdownTable(block: string) {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (lines.length < 2) return null;

  const header = lines[0]
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

  const rows = lines
    .slice(2)
    .map((line) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((row) => row.length >= header.length);

  if (!rows.length) return null;

  return { header, rows };
}

function stripUiMarks(value: string) {
  return value
    .replace(/[\u2705\u2611\u2713\u2714\u26A0\uFE0F]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderInlineText(text: string) {
  const segments = stripUiMarks(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    const match = /^\*\*(.+)\*\*$/.exec(segment);
    if (!match) return <span key={`${segment}-${index}`}>{segment}</span>;
    return <strong key={`${match[1]}-${index}`}>{match[1]}</strong>;
  });
}

function renderTextBlock(block: string) {
  const trimmed = block.trim();
  if (!trimmed || /^[-–—]{3,}$/.test(trimmed)) return null;

  const headingMatch = /^###\s+(.+)\n([\s\S]*)$/m.exec(trimmed);
  const heading = headingMatch?.[1]?.trim() ?? null;
  const body = headingMatch?.[2]?.trim() ?? trimmed;

  const table = parseMarkdownTable(body);

  if (table) {
    return (
      <div className={styles.tableWrap}>
        {heading ? <h4 className={styles.blockHeading}>{heading}</h4> : null}
        <table className={styles.reportTable}>
          <thead>
            <tr>
              {table.header.map((cell) => (
                <th key={cell}>{cell.replace(/\*\*/g, "")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row[0] ?? "row"}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`}>
                    {renderInlineText(cell.replace(/\*\*/g, ""))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  const listLines = lines.filter((line) => /^[-*]\s+/.test(line));

  if (listLines.length && listLines.length === lines.length) {
    return (
      <div className={styles.blockStack}>
        {heading ? <h4 className={styles.blockHeading}>{heading}</h4> : null}
        <ul className={styles.reportList}>
          {listLines.map((line) => (
            <li key={line}>{renderInlineText(line.replace(/^[-*]\s+/, ""))}</li>
          ))}
        </ul>
      </div>
    );
  }

  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && !/^[-–—]{3,}$/.test(paragraph));

  return (
    <div className={styles.blockStack}>
      {heading ? <h4 className={styles.blockHeading}>{heading}</h4> : null}
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{renderInlineText(paragraph.replace(/\n+/g, " "))}</p>
      ))}
    </div>
  );
}

function renderSection(section: EvaluationSection, index: number) {
  const blocks = section.body
    .split(/\n\s*\n(?=###\s+|\|[-| ]+\||[-*]\s+|\*\*|[A-Za-z0-9])/)
    .map((block) => block.trim())
    .filter((block) => block && !/^[-–—]{3,}$/.test(block));

  return (
    <details className={styles.reportSection} key={section.heading} open={index === 0}>
      <summary className={styles.reportSummary}>
        <span className={styles.reportKicker}>Section {String(index + 1).padStart(2, "0")}</span>
        <span className={styles.reportTitle}>{section.heading}</span>
        <span className={styles.reportMeta}>{blocks.length} blocks</span>
        <span className={styles.chevron} aria-hidden="true" />
      </summary>
      <div className={styles.sectionBody}>
        {blocks.map((block, index) => (
          <div key={`${section.heading}-${index}`}>{renderTextBlock(block) as ReactNode}</div>
        ))}
      </div>
    </details>
  );
}

function normalizeScore(score: number | null | undefined) {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  return score > 5 ? Math.max(0, Math.min(100, Math.round(score))) : Math.round(score * 20);
}

function getGrade(score: number | null) {
  return typeof score === "number" ? scoreToGrade(score / 20) : "F";
}

function gradeClass(grade: string) {
  return `${styles.gradeBadge} ${styles[`grade${grade}` as keyof typeof styles] ?? ""}`;
}

function cleanText(value: string | null | undefined) {
  return (
    value
      ?.replace(/\*\*/g, "")
      .replace(/[\u2705\u2611\u2713\u2714\u26A0\uFE0F]/gu, "")
      .replace(/\s{2,}/g, " ")
      .trim() || "Unavailable"
  );
}

function isMeaningful(value: string | null | undefined) {
  const cleaned = cleanText(value);
  return cleaned !== "Unavailable" && !/^(unknown|n\/a|none|null)$/i.test(cleaned);
}

function truncateText(value: string, maxLength = 190) {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength).replace(/\s+\S*$/, "");
  return `${clipped}...`;
}

function summarizeSlot(value: string | null | undefined, fallback = "No specific signal extracted.", maxLength = 180) {
  const cleaned = cleanText(value);

  if (!isMeaningful(cleaned)) return fallback;
  if (cleaned.length <= maxLength) return cleaned;

  const sentence = cleaned.split(/(?<=[.!?])\s+/).find(Boolean);
  return truncateText(sentence && sentence.length <= maxLength ? sentence : cleaned, maxLength);
}

function extractSummaryEvidence(summary: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `${escapedLabel}:\\s*([\\s\\S]*?)(?=\\s+[A-Z][A-Za-z/+\\s-]{2,}:|$)`,
    "i",
  ).exec(summary);

  return match?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function ScoreBar({ score }: { score: number | null }) {
  const value = score ?? 0;

  return (
    <div className={styles.scoreBar} aria-label={`Score ${value} out of 100`}>
      <span className={styles.scoreTrack}>
        <span className={styles.scoreFill} style={{ width: `${value}%` }} />
      </span>
      <span className={styles.scoreValue}>{score === null ? "N/A" : value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className={styles.sectionTitle}>{children}</h2>;
}

function buildScoreBreakdown(evaluation: Evaluation | null, opportunity: Opportunity) {
  if (evaluation?.dimensions.length) {
    return evaluation.dimensions.map((dimension) => ({
      dim: dimension.name,
      notes: dimension.summary,
      score: normalizeScore(dimension.score),
    }));
  }

  const matchCount = evaluation?.cvMatchItems.length ?? 0;
  const gapCount = evaluation?.gapItems.length ?? 0;
  const score = normalizeScore(opportunity.score);
  const locationText = [opportunity.remote, evaluation?.roleSummary["Work Mode"], evaluation?.roleSummary.Location]
    .filter(Boolean)
    .join(" · ");

  return [
    {
      dim: "Technical alignment",
      score: matchCount ? Math.min(88, 48 + matchCount * 8) : score,
      notes: matchCount
        ? `${matchCount} CV match${matchCount === 1 ? "" : "es"} surfaced from the report.`
        : "No explicit CV match table was parsed from the report.",
    },
    {
      dim: "Experience relevance",
      score: evaluation?.candidateLevel ? 64 : score,
      notes: cleanText(evaluation?.candidateLevel ?? evaluation?.detectedLevel ?? opportunity.summary),
    },
    {
      dim: "Mission fit",
      score,
      notes: cleanText(evaluation?.archetype ?? opportunity.archetype),
    },
    {
      dim: "Compensation overlap",
      score: evaluation?.compensationItems.length ? 68 : score,
      notes: cleanText(opportunity.compensation ?? evaluation?.compensationAnalysis),
    },
    {
      dim: "Location compatibility",
      score: locationText ? (/(remote|flex)/i.test(locationText) ? 78 : 50) : null,
      notes: cleanText(locationText),
    },
    {
      dim: "Risk load",
      score: gapCount ? Math.max(28, 82 - gapCount * 12) : score,
      notes: gapCount
        ? `${gapCount} gap${gapCount === 1 ? "" : "s"} or risk flag${gapCount === 1 ? "" : "s"} need mitigation before advancing.`
        : "No parsed gaps are currently attached to this report.",
    },
  ];
}

function buildCompanyIntel(evaluation: Evaluation | null, opportunity: Opportunity) {
  const roleSummary = evaluation?.roleSummary ?? {};

  return [
    ["Company", opportunity.company],
    ["Role", opportunity.role],
    ["Archetype", opportunity.archetype ?? evaluation?.archetype ?? "Unknown"],
    ["Location", opportunity.remote ?? roleSummary.Location ?? roleSummary["Work Mode"] ?? "Unavailable"],
    ["Compensation", opportunity.compensation ?? evaluation?.compensationItems[0]?.value ?? "Unavailable"],
    ["Source", opportunity.jobUrl ? "Posting linked" : "Posting unavailable"],
    ["Report", opportunity.reportPath ?? "Missing"],
    ["PDF", opportunity.hasPdf ? "Generated" : evaluation?.pdfPath ? "Linked in report" : "Not yet"],
  ];
}

function buildCvHighlights(evaluation: Evaluation | null, opportunity: Opportunity) {
  if (evaluation?.cvMatchItems.length) {
    return evaluation.cvMatchItems.slice(0, 6).map((item) => ({
      detail: truncateText(cleanText(item.match), 220),
      source: cleanText(item.source),
      title: truncateText(cleanText(item.requirement), 86),
    }));
  }

  const summary = cleanText(opportunity.summary ?? evaluation?.summary);
  const highlights = [];
  const reactEvidence = [
    extractSummaryEvidence(summary, "React"),
    extractSummaryEvidence(summary, "TypeScript"),
  ]
    .filter(Boolean)
    .join(" ");
  const testingEvidence =
    extractSummaryEvidence(summary, "Playwright/Cypress") ??
    extractSummaryEvidence(summary, "Playwright");
  const toolingEvidence = extractSummaryEvidence(summary, "AI tooling");
  const archetype = cleanText(opportunity.archetype ?? evaluation?.archetype);

  if (reactEvidence) {
    highlights.push({
      title: "React + TypeScript evidence",
      detail: truncateText(reactEvidence, 220),
      source: "Evaluation summary",
    });
  }

  if (testingEvidence) {
    highlights.push({
      title: "Test automation evidence",
      detail: truncateText(testingEvidence, 220),
      source: "Evaluation summary",
    });
  }

  if (toolingEvidence) {
    highlights.push({
      title: "AI tooling evidence",
      detail: truncateText(toolingEvidence, 220),
      source: "Evaluation summary",
    });
  }

  if (highlights.length === 0 && isMeaningful(summary)) {
    highlights.push({
      title: "Evaluation evidence",
      detail: truncateText(summary, 240),
      source: "Evaluation summary",
    });
  }

  if (isMeaningful(archetype)) {
    highlights.push({
      title: "Role archetype fit",
      detail: "Frame your experience against the role archetype so the application reads as intentional rather than generic.",
      source: "Role archetype",
    });
  }

  return highlights.slice(0, 5);
}

function buildRiskFlags(evaluation: Evaluation | null, opportunity: Opportunity) {
  if (evaluation?.gapItems.length) {
    return evaluation.gapItems.map((gap) => ({
      gap: cleanText(gap.gap),
      mitigation: cleanText(gap.mitigation),
      severity: gap.severity,
    }));
  }

  const flags = [];

  if (opportunity.notes) {
    flags.push({
      gap: opportunity.notes,
      mitigation: "Resolve this before investing time in a tailored resume or outreach sequence.",
      severity: "moderate",
    });
  }

  if (opportunity.compensation) {
    flags.push({
      gap: `Compensation signal: ${opportunity.compensation}`,
      mitigation: "Confirm the expected range early and decide whether the trade-off is acceptable.",
      severity: "minor",
    });
  }

  if (opportunity.remote) {
    flags.push({
      gap: `Work mode signal: ${opportunity.remote}`,
      mitigation: "Check whether the stated work mode matches your availability before advancing.",
      severity: /(remote|flex)/i.test(opportunity.remote) ? "minor" : "moderate",
    });
  }

  return flags;
}

function buildBackgroundFraming(evaluation: Evaluation | null, opportunity: Opportunity) {
  const risks = buildRiskFlags(evaluation, opportunity);

  if (risks.length) {
    return risks.slice(0, 3).map((risk, index) => ({
      body: risk.gap,
      mitigation: risk.mitigation,
      number: `Concern ${String(index + 1).padStart(2, "0")}`,
      title:
        index === 0
          ? "Be ready to frame the main concern directly."
          : "Keep the answer practical and evidence-led.",
    }));
  }

  return [
    {
      body: "The report does not expose structured concerns yet, so use the source report and notes as the interview framing source.",
      mitigation: "Before applying, extract one concise answer for why this role, why this company, and why your background fits the work.",
      number: "Concern 01",
      title: "No structured concerns parsed yet.",
    },
  ];
}

function severityTone(severity: string) {
  if (severity === "critical") return styles.toneCritical;
  if (severity === "minor") return styles.toneMinor;
  return styles.toneModerate;
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ opportunity, evaluation, intel }, states] = await Promise.all([
    getOpportunity(id),
    getStates(),
  ]);

  if (!opportunity) notFound();

  const overallScore = normalizeScore(opportunity.score ?? evaluation?.score);
  const grade = evaluation?.grade ?? getGrade(overallScore);
  const scoreBreakdown = intel?.scoreBreakdown.length
    ? intel.scoreBreakdown.map((dimension) => ({
        dim: dimension.label,
        notes: summarizeSlot(dimension.rationale || dimension.evidence[0]),
        score: dimension.score,
      }))
    : buildScoreBreakdown(evaluation, opportunity);
  const companyIntel = intel
    ? [
        ["Company", intel.roleSnapshot.company],
        ["Role", intel.roleSnapshot.role],
        ["Archetype", intel.roleSnapshot.archetype ?? "Unavailable"],
        ["Location", intel.roleSnapshot.location ?? intel.roleSnapshot.workMode ?? "Unavailable"],
        ["Work mode", intel.roleSnapshot.workMode ?? "Unavailable"],
        ["Compensation", intel.roleSnapshot.compensation ?? "Unavailable"],
        ["Source", intel.roleSnapshot.sourceUrl ? "Posting linked" : "Posting unavailable"],
        ["Report model", intel.source === "sidecar" ? "UI sidecar" : "Markdown fallback"],
      ]
    : buildCompanyIntel(evaluation, opportunity);
  const cvHighlights = intel?.cvEvidence.length
    ? intel.cvEvidence.map((item) => ({
        detail: item.evidence,
        source: [item.strength !== "unknown" ? item.strength : null, item.source]
          .filter(Boolean)
          .join(" · "),
        title: item.requirement,
      }))
    : buildCvHighlights(evaluation, opportunity);
  const riskFlags = intel?.risks.length
    ? intel.risks.map((risk) => ({
        gap: summarizeSlot(risk.reason || risk.title, "Risk signal needs review.", 160),
        mitigation: summarizeSlot(risk.mitigation, "Prepare a concise mitigation before advancing.", 180),
        severity: risk.severity,
      }))
    : buildRiskFlags(evaluation, opportunity);
  const backgroundFraming = intel?.backgroundFraming.length
    ? intel.backgroundFraming.map((frame, index) => ({
        body: summarizeSlot(frame.concern, "Concern needs review.", 180),
        mitigation: summarizeSlot(frame.recommendedAnswer, "Prepare a concise answer before advancing.", 180),
        number: `Concern ${String(index + 1).padStart(2, "0")}`,
        title: summarizeSlot(frame.likelyQuestion, "Prepare concise framing.", 120),
      }))
    : buildBackgroundFraming(evaluation, opportunity);
  const recommendation = summarizeSlot(
    intel?.recommendation.summary ?? evaluation?.summary ?? opportunity.summary,
    "A tracker row exists for this role, but no parsed report content is available yet.",
    190,
  );
  const nextActions = intel?.recommendation.nextActions.length
    ? intel.recommendation.nextActions
    : [
        "Tailor resume before applying",
        "Use matched evidence in outreach",
        "Resolve any location or compensation mismatch",
      ];
  const inquestId = `INQ-${id.slice(-6).toUpperCase()}`;

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.dossierHead}>
        <p className={styles.breadcrumb}>
          <Link href="/pipeline">Pipeline</Link>
          <span aria-hidden="true">/</span>
          <span>Analysis Dossier</span>
        </p>

        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <span className={styles.eyebrow}>Intelligence Dossier</span>
            <h1>{opportunity.role}</h1>
            <div className={styles.inquiry}>
              <span className={styles.companyLine}>{opportunity.company}</span>
              {intel?.roleSnapshot.workMode || opportunity.remote ? (
                <span>{intel?.roleSnapshot.workMode ?? opportunity.remote}</span>
              ) : null}
              <span className={styles.inquiryId}>{inquestId}</span>
              <span className={styles.statusPill}>{opportunity.status}</span>
            </div>
          </div>

          <div className={styles.headerActions}>
            {evaluation ? (
              <Link className={styles.btnOutline} href={`/pipeline/${opportunity.id}/interview`}>
                Prep Interview
              </Link>
            ) : null}
            <Link className={styles.btnPrimary} href={`/pipeline/${opportunity.id}/apply`}>
              Open Workspace
            </Link>
            {opportunity.jobUrl ? (
              <a className={styles.btnOutline} href={opportunity.jobUrl} rel="noreferrer" target="_blank">
                Open Posting ↗
              </a>
            ) : null}
          </div>
        </div>

        <div className={styles.badgeRow}>
          <span className={gradeClass(grade)}>{grade}</span>
          <span className={styles.scoreBadge}>{overallScore === null ? "Score N/A" : `${overallScore}/100`}</span>
          {intel?.roleSnapshot.archetype || opportunity.archetype ? (
            <span className={styles.statusPill}>
              {intel?.roleSnapshot.archetype ?? opportunity.archetype}
            </span>
          ) : null}
          {opportunity.reportPath ? <span className={styles.statusPill}>Report linked</span> : null}
        </div>
      </header>

      <div className={styles.dossierBody}>
        <div className={styles.mainColumn}>
          <section className={styles.summaryPanel}>
            <div className={styles.cardHeadLoose}>
              <span className={styles.cardLabel}>Evaluation Summary</span>
              <span className={styles.cardTitle}>{evaluation ? "Parsed from the role report" : "Waiting for report content"}</span>
            </div>
            <p>{recommendation}</p>
            {opportunity.notes ? (
              <div className={styles.noteBlock}>
                <span>Additional notes</span>
                <p>{opportunity.notes}</p>
              </div>
            ) : null}
          </section>

          <section className={styles.sectionStack}>
            <SectionTitle>Score Breakdown</SectionTitle>
            <div className={styles.breakdownCard}>
              {scoreBreakdown.map((dimension) => (
                <details className={styles.breakdownItem} key={dimension.dim}>
                  <summary className={styles.breakdownRow}>
                    <span className={styles.breakdownTitle}>{dimension.dim}</span>
                    <ScoreBar score={dimension.score} />
                    <span className={styles.chevron} aria-hidden="true" />
                  </summary>
                  <div className={styles.breakdownDetails}>
                    <p>{dimension.notes}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section className={styles.sectionStack}>
            <SectionTitle>CV Highlights Matched</SectionTitle>
            <div className={styles.matchList}>
              {cvHighlights.map((item) => (
                <div className={styles.matchItem} key={`${item.title}-${item.source}`}>
                  <span className={styles.matchIcon} aria-hidden="true" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                    {item.source && item.source !== "Unavailable" ? <small>{item.source}</small> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.sectionStack}>
            <SectionTitle>Gaps &amp; Risk Flags</SectionTitle>
            <div className={styles.riskList}>
              {riskFlags.map((gap) => (
                <div className={`${styles.riskCard} ${severityTone(gap.severity)}`} key={gap.gap}>
                  <div className={styles.riskHead}>
                    <h3>{gap.gap}</h3>
                    <span>{gap.severity}</span>
                  </div>
                  <div className={styles.mitigationBox}>
                    <span>Mitigation path</span>
                    <p>{gap.mitigation}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.sectionStack}>
            <SectionTitle>Background Framing</SectionTitle>
            <div className={styles.framingList}>
              {backgroundFraming.map((item) => (
                <div className={styles.framingCard} key={item.number}>
                  <div className={styles.framingHead}>
                    <span>{item.number}</span>
                    <strong>{item.title}</strong>
                  </div>
                  <p>{item.body}</p>
                  <div className={styles.mitigationBox}>
                    <span>Mitigation</span>
                    <p>{item.mitigation}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.sectionStack}>
            <SectionTitle>Company Intelligence</SectionTitle>
            <dl className={styles.companyIntel}>
              {companyIntel.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {evaluation?.sections.length ? (
            <section className={styles.sectionStack}>
              <div className={styles.sourceReportHead}>
                <SectionTitle>Source Report</SectionTitle>
                <p>
                  Original parsed report sections, kept as a restrained appendix so the dossier
                  stays scannable while preserving the underlying evidence.
                </p>
              </div>
              <div className={styles.sourceReportDeck}>
                {evaluation.sections.map((section, index) => renderSection(section, index))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className={styles.rail}>
          <div className={`${styles.railCard} ${styles.scoreCard}`}>
            <span className={styles.cardLabel}>Overall Evaluation</span>
            <div className={styles.bigScore}>
              <span>{overallScore ?? "N/A"}</span>
              <div>
                <small>/ 100</small>
                <span className={gradeClass(grade)}>{grade}</span>
              </div>
            </div>
            <ScoreBar score={overallScore} />
            <p>
              Weighted fit across technical alignment, experience relevance, mission fit,
              compensation, location, and risk load.
            </p>
          </div>

          <div className={styles.railCard}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>Recommendation</span>
            </div>
            <div className={styles.railBody}>
              <div className={styles.recommendCallout}>
                <span className={styles.recommendLabel}>
                  <span className={styles.recommendIcon} aria-hidden="true" />
                  Conditional
                </span>
                <p>{recommendation}</p>
              </div>
              <div className={styles.recommendList}>
                {nextActions.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.railCard}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>Status</span>
              <span className={styles.cardTitle}>{opportunity.status}</span>
            </div>
            <div className={styles.railBody}>
              <OpportunityStatusEditor
                initialNotes={opportunity.notes}
                initialStatus={opportunity.status}
                opportunityId={opportunity.id}
                statusOptions={states
                  .map((state) => state.label)
                  .filter((label) => label !== "Unknown")}
              />
            </div>
          </div>

          <div className={styles.railCard}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>Linked Sources</span>
            </div>
            <div className={styles.railBody}>
              <div className={styles.metaList}>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Tracker ID</span>
                  <span className={styles.metaVal}>{id}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Report</span>
                  <span className={styles.metaVal}>{opportunity.reportPath ?? "Missing"}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>PDF</span>
                  <span className={styles.metaVal}>{opportunity.hasPdf ? "Generated" : "Not yet"}</span>
                </div>
                {opportunity.jobUrl ? (
                  <div className={styles.metaRow}>
                    <span className={styles.metaKey}>Source</span>
                    <a
                      className={styles.externalLink}
                      href={opportunity.jobUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open posting ↗
                    </a>
                  </div>
                ) : null}
                {evaluation ? (
                  <div className={styles.metaRow}>
                    <span className={styles.metaKey}>Prep</span>
                    <Link
                      className={styles.externalLink}
                      href={`/pipeline/${opportunity.id}/interview`}
                    >
                      Open interview workspace
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {evaluation?.keywords.length ? (
            <div className={styles.railCard}>
              <div className={styles.cardHead}>
                <span className={styles.cardLabel}>Keywords</span>
                <span className={styles.cardTitle}>{evaluation.keywords.length} terms</span>
              </div>
              <div className={styles.railBody}>
                <div className={styles.keywordList}>
                  {evaluation.keywords.map((keyword) => (
                    <span className={styles.keyword} key={keyword}>
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className={styles.railActions}>
            <Link className={styles.btnPrimary} href={`/pipeline/${opportunity.id}/apply`}>
              Open Workspace
            </Link>
            {evaluation ? (
              <Link className={styles.btnOutline} href={`/pipeline/${opportunity.id}/interview`}>
                Prep Interview
              </Link>
            ) : null}
            <Link className={styles.btnOutline} href="/resumes">
              Tailor Resume
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
