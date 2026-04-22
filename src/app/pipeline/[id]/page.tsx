import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import OpportunityStatusEditor from "@/components/pipeline/OpportunityStatusEditor";
import { getOpportunity, getStates } from "@/lib/api/career-ops";
import type { EvaluationSection } from "@/lib/types";

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

function renderInlineText(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    const match = /^\*\*(.+)\*\*$/.exec(segment);
    if (!match) return <span key={`${segment}-${index}`}>{segment}</span>;
    return <strong key={`${match[1]}-${index}`}>{match[1]}</strong>;
  });
}

function renderTextBlock(block: string) {
  const trimmed = block.trim();
  if (!trimmed) return null;

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
    .filter(Boolean);

  return (
    <div className={styles.blockStack}>
      {heading ? <h4 className={styles.blockHeading}>{heading}</h4> : null}
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{renderInlineText(paragraph.replace(/\n+/g, " "))}</p>
      ))}
    </div>
  );
}

function renderSection(section: EvaluationSection) {
  const blocks = section.body
    .split(/\n\s*\n(?=###\s+|\|[-| ]+\||[-*]\s+|\*\*|[A-Za-z0-9])/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <section className={styles.reportSection} key={section.heading}>
      <div className={styles.cardHead}>
        <span className={styles.cardLabel}>Analysis</span>
        <span className={styles.cardTitle}>{section.heading}</span>
      </div>
      <div className={styles.sectionBody}>
        {blocks.map((block, index) => (
          <div key={`${section.heading}-${index}`}>{renderTextBlock(block) as ReactNode}</div>
        ))}
      </div>
    </section>
  );
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ opportunity, evaluation }, states] = await Promise.all([
    getOpportunity(id),
    getStates(),
  ]);

  if (!opportunity) notFound();

  const scoreLabel =
    typeof opportunity.score === "number"
      ? `${Math.round(opportunity.score * 20)}`
      : opportunity.scoreRaw || "N/A";

  const inquestId = `INQ-${id.slice(-6).toUpperCase()}`;

  return (
    <article className={`app-page ${styles.page}`}>
      {/* PAGE HEADER */}
      <header className={styles.dossierHead}>
        <p className={styles.breadcrumb}>
          <Link href="/pipeline">Pipeline</Link>
          {" // "}
          Analysis Dossier
        </p>

        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <h1>
              {opportunity.company} · {opportunity.role}
            </h1>
            <div className={styles.inquiry}>
              <span className={styles.inquiryId}>{inquestId} | Evaluated</span>
              <span className={styles.statusPill}>{opportunity.status}</span>
              {typeof opportunity.score === "number" ? (
                <span className={styles.scoreBadge}>Score {scoreLabel}/100</span>
              ) : null}
              {opportunity.archetype ? (
                <span className={styles.statusPill}>{opportunity.archetype}</span>
              ) : null}
            </div>
          </div>

          {opportunity.jobUrl || evaluation ? (
            <div className={styles.headerActions}>
              {evaluation ? (
                <Link
                  className={styles.btnOutline}
                  href={`/pipeline/${opportunity.id}/interview`}
                >
                  Interview Prep
                </Link>
              ) : null}
              {opportunity.jobUrl ? (
                <a
                  className={styles.btnOutline}
                  href={opportunity.jobUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open Posting ↗
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {/* DOSSIER BODY */}
      <div className={styles.dossierBody}>
        {/* MAIN COLUMN */}
        <div className={styles.mainColumn}>
          {/* SIGNAL OVERVIEW */}
          <section className={styles.overviewCard}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>Role Signals</span>
              <span className={styles.cardTitle}>
                {evaluation
                  ? "What the report is actually saying"
                  : "No report parsed yet"}
              </span>
            </div>

            {evaluation ? (
              <dl className={styles.signalGrid}>
                {Object.entries(evaluation.roleSummary).map(([label, value]) => (
                  <div className={styles.signalCard} key={label}>
                    <dt>{label.replace(/\*\*/g, "")}</dt>
                    <dd>{value.replace(/\*\*/g, "")}</dd>
                  </div>
                ))}
                <div className={styles.signalCard}>
                  <dt>Detected level</dt>
                  <dd>{evaluation.detectedLevel ?? "Unavailable"}</dd>
                </div>
                <div className={styles.signalCard}>
                  <dt>Candidate level</dt>
                  <dd>{evaluation.candidateLevel ?? "Unavailable"}</dd>
                </div>
                <div className={styles.signalCard}>
                  <dt>CV matches</dt>
                  <dd>{evaluation.cvMatchItems.length}</dd>
                </div>
                <div className={styles.signalCard}>
                  <dt>Gaps</dt>
                  <dd>{evaluation.gapItems.length}</dd>
                </div>
              </dl>
            ) : (
              <div className={styles.sectionBody}>
                <p>
                  A tracker row exists for this role, but there is no parsed report content yet.
                  As soon as a report lands in <code>reports/</code>, this page will render the
                  sections here.
                </p>
              </div>
            )}
          </section>

          {/* REPORT SECTIONS */}
          {evaluation?.sections.length ? (
            evaluation.sections.map((section) => renderSection(section))
          ) : null}
        </div>

        {/* RAIL */}
        <aside className={styles.rail}>
          {/* STATUS EDITOR */}
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

          {/* METADATA */}
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

          {/* KEYWORDS */}
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
        </aside>
      </div>

      {/* FOOTER ACTIONS */}
      <footer className={styles.dossierFooter}>
        <button className={styles.btnOutline} type="button">
          Request Revision
        </button>
        <button className={styles.btnPrimary} type="button">
          Approve &amp; Advance
        </button>
      </footer>
    </article>
  );
}
