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

  if (lines.length < 2) {
    return null;
  }

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

  if (!rows.length) {
    return null;
  }

  return { header, rows };
}

function renderInlineText(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    const match = /^\*\*(.+)\*\*$/.exec(segment);

    if (!match) {
      return <span key={`${segment}-${index}`}>{segment}</span>;
    }

    return <strong key={`${match[1]}-${index}`}>{match[1]}</strong>;
  });
}

function renderTextBlock(block: string) {
  const trimmed = block.trim();

  if (!trimmed) {
    return null;
  }

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

  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

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
    <section className={`detail-panel ${styles.reportSection}`} key={section.heading}>
      <div className={styles.sectionHead}>
        <p className="section-label">Report section</p>
        <h2>{section.heading}</h2>
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

  if (!opportunity) {
    notFound();
  }

  const scoreLabel =
    typeof opportunity.score === "number"
      ? opportunity.score.toFixed(1)
      : opportunity.scoreRaw || "N/A";

  return (
    <article className={`app-page ${styles.page}`}>
      <header className="page-head">
        <div className="page-copy">
          <p className="eyebrow">Opportunity detail</p>
          <h1>
            {opportunity.company} · {opportunity.role}
          </h1>
          <p className="lede">
            {evaluation?.summary ||
              opportunity.summary ||
              "This role is linked, but no parsed report summary is available yet."}
          </p>

          <div className={styles.heroMeta}>
            <span className={styles.scorePill}>Score {scoreLabel}</span>
            <span className={styles.statusPill}>{opportunity.status}</span>
            {opportunity.archetype ? (
              <span className={styles.metaPill}>{opportunity.archetype}</span>
            ) : null}
          </div>
        </div>

        <aside className={`page-note ${styles.sourceNote}`}>
          <p className="note-label">Linked sources</p>
          <ul className={styles.sourceList}>
            <li>
              <span>Tracker id</span>
              <code>{id}</code>
            </li>
            <li>
              <span>Report file</span>
              <strong>{opportunity.reportPath ?? "Missing"}</strong>
            </li>
            <li>
              <span>PDF output</span>
              <strong>{opportunity.hasPdf ? "Generated" : "Not yet"}</strong>
            </li>
            <li>
              <span>Source link</span>
              {opportunity.jobUrl ? (
                <a
                  className={styles.externalLink}
                  href={opportunity.jobUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open posting
                </a>
              ) : (
                <strong>Unavailable</strong>
              )}
            </li>
          </ul>
        </aside>
      </header>

      <section className="detail-layout">
        <div className="detail-stack">
          <section className={`detail-panel ${styles.overviewPanel}`}>
            <div className={styles.sectionHead}>
              <p className="section-label">Role signals</p>
              <h2>What the report is actually saying.</h2>
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
              <p>
                A tracker row exists for this role, but there is no parsed report
                content yet. As soon as a report lands in <code>reports/</code>,
                this page will render the sections here.
              </p>
            )}
          </section>

          {evaluation?.sections.length ? (
            evaluation.sections.map((section) => renderSection(section))
          ) : (
            <section className="detail-panel">
              <p className="section-label">Report content</p>
              <h2>No full report has been parsed yet.</h2>
              <p>
                This deep link still works for status updates and notes, but the
                report body is not available for this opportunity right now.
              </p>
            </section>
          )}
        </div>

        <aside className="detail-rail">
          <section className={`rail-block ${styles.statusBlock}`}>
            <p className="rail-label">Status</p>
            <strong>{opportunity.status}</strong>
            <OpportunityStatusEditor
              initialNotes={opportunity.notes}
              initialStatus={opportunity.status}
              opportunityId={opportunity.id}
              statusOptions={states.map((state) => state.label).filter(
                (label) => label !== "Unknown",
              )}
            />
          </section>

          {evaluation?.keywords.length ? (
            <section className={`rail-block ${styles.keywordBlock}`}>
              <p className="rail-label">Keywords</p>
              <div className={styles.keywordList}>
                {evaluation.keywords.map((keyword) => (
                  <span className={styles.keyword} key={keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className={`rail-block ${styles.outputBlock}`}>
            <p className="rail-label">Outputs</p>
            <div className={styles.outputStack}>
              {opportunity.reportPath ? (
                <p>
                  Report linked in tracker:
                  <br />
                  <code>{opportunity.reportPath}</code>
                </p>
              ) : (
                <p>No report path is linked in the tracker yet.</p>
              )}

              {evaluation?.pdfPath && evaluation.pdfPath !== "❌" ? (
                <p>
                  Generated PDF:
                  <br />
                  <code>{evaluation.pdfPath}</code>
                </p>
              ) : null}

              <p>
                <Link href="/pipeline">Back to pipeline</Link>
              </p>
            </div>
          </section>
        </aside>
      </section>
    </article>
  );
}
