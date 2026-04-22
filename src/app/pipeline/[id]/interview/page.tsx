import Link from "next/link";
import { notFound } from "next/navigation";

import { getOpportunity } from "@/lib/api/career-ops";

import styles from "./page.module.css";

function buildPrepChecklist(input: {
  gaps: Array<{ gap: string; mitigation: string }>;
  interviewItems: Array<{ requirement: string; story: string }>;
  keywords: string[];
}) {
  const items: string[] = [];

  for (const item of input.interviewItems) {
    if (item.requirement) {
      items.push(`Rehearse a concise answer for: ${item.requirement}`);
    }
    if (item.story) {
      items.push(`Practice the STAR arc for: ${item.story}`);
    }
  }

  for (const gap of input.gaps) {
    if (gap.mitigation) {
      items.push(`Close the gap on "${gap.gap}" by leading with: ${gap.mitigation}`);
    } else if (gap.gap) {
      items.push(`Prepare a confident framing for the gap: ${gap.gap}`);
    }
  }

  for (const keyword of input.keywords) {
    items.push(`Be ready to speak concretely about ${keyword}.`);
  }

  return [...new Set(items)].slice(0, 10);
}

function splitInterviewSummary(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default async function OpportunityInterviewPrepPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { opportunity, evaluation } = await getOpportunity(id);

  if (!opportunity) notFound();

  const hasPrep = Boolean(
    evaluation && (evaluation.interviewItems.length || evaluation.interviewPrep.trim()),
  );
  const prepChecklist = evaluation
    ? buildPrepChecklist({
        gaps: evaluation.gapItems,
        interviewItems: evaluation.interviewItems,
        keywords: evaluation.keywords,
      })
    : [];
  const prepSummary = evaluation ? splitInterviewSummary(evaluation.interviewPrep) : [];

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.head}>
        <p className={styles.breadcrumb}>
          <Link href="/pipeline">Pipeline</Link>
          {" // "}
          <Link href={`/pipeline/${opportunity.id}`}>Analysis Dossier</Link>
          {" // "}
          Interview Prep
        </p>

        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Interview workspace</p>
            <h1>
              {opportunity.company} · {opportunity.role}
            </h1>
            <p className={styles.subtitle}>
              Turn the report into a usable prep surface: what to rehearse, which stories map best,
              and where your weak spots will probably get tested.
            </p>
            <div className={styles.metaRow}>
              <span className={styles.pill}>{opportunity.status}</span>
              {typeof opportunity.score === "number" ? (
                <span className={styles.pill}>Score {(opportunity.score * 20).toFixed(0)}/100</span>
              ) : null}
              {evaluation?.detectedLevel ? <span className={styles.pill}>{evaluation.detectedLevel}</span> : null}
              {evaluation?.candidateLevel ? <span className={styles.pill}>You: {evaluation.candidateLevel}</span> : null}
            </div>
          </div>

          <div className={styles.heroActions}>
            <Link className={styles.btnPrimary} href={`/resumes?opportunity=${opportunity.id}`}>
              Tailor resume
            </Link>
            <Link className={styles.btnOutline} href={`/pipeline/${opportunity.id}`}>
              Open dossier
            </Link>
            {opportunity.jobUrl ? (
              <a
                className={styles.btnOutline}
                href={opportunity.jobUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open posting ↗
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {!evaluation ? (
        <section className={styles.emptyState}>
          <p className={styles.eyebrow}>No evaluation yet</p>
          <h2>This role does not have parsed report data to build prep from.</h2>
          <p>
            Once a report lands in <code>reports/</code>, this workspace will assemble the prep
            notes and story map here.
          </p>
        </section>
      ) : !hasPrep ? (
        <section className={styles.emptyState}>
          <p className={styles.eyebrow}>Prep signals missing</p>
          <h2>The evaluation exists, but there is no dedicated interview-prep section in it yet.</h2>
          <p>
            You can still use the dossier and resume tools for this role, but richer interview
            intelligence has not been generated for it yet.
          </p>
        </section>
      ) : (
        <div className={styles.layout}>
          <div className={styles.main}>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardLabel}>Prep overview</span>
                <span className={styles.cardTitle}>What the report suggests you should emphasize</span>
              </div>
              <div className={styles.cardBody}>
                {prepSummary.length ? (
                  prepSummary.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                ) : (
                  <p>{evaluation.interviewPrep}</p>
                )}
              </div>
            </section>

            {evaluation.interviewItems.length ? (
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardLabel}>Story map</span>
                  <span className={styles.cardTitle}>Which STAR stories already match likely requirements</span>
                </div>
                <div className={styles.storyGrid}>
                  {evaluation.interviewItems.map((item) => (
                    <article className={styles.storyCard} key={`${item.index}-${item.requirement}`}>
                      <p className={styles.storyRequirement}>{item.requirement || "Role signal"}</p>
                      <h3>{item.story || "Story still needs drafting"}</h3>
                      <dl className={styles.starGrid}>
                        <div>
                          <dt>S</dt>
                          <dd>{item.situation || "Not captured yet."}</dd>
                        </div>
                        <div>
                          <dt>T</dt>
                          <dd>{item.task || "Not captured yet."}</dd>
                        </div>
                        <div>
                          <dt>A</dt>
                          <dd>{item.action || "Not captured yet."}</dd>
                        </div>
                        <div>
                          <dt>R</dt>
                          <dd>{item.result || "Not captured yet."}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardLabel}>Rehearsal plan</span>
                <span className={styles.cardTitle}>Concrete prompts to work through before the interview</span>
              </div>
              <div className={styles.checklist}>
                {prepChecklist.length ? (
                  prepChecklist.map((item) => (
                    <label className={styles.checkItem} key={item}>
                      <input type="checkbox" />
                      <span>{item}</span>
                    </label>
                  ))
                ) : (
                  <p>No structured checklist could be derived yet.</p>
                )}
              </div>
            </section>
          </div>

          <aside className={styles.rail}>
            <section className={styles.railCard}>
              <div className={styles.cardHead}>
                <span className={styles.cardLabel}>Pressure points</span>
                <span className={styles.cardTitle}>What could come up</span>
              </div>
              <div className={styles.railBody}>
                <div className={styles.statRow}>
                  <span>Stories mapped</span>
                  <strong>{evaluation.interviewItems.length}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>Gaps flagged</span>
                  <strong>{evaluation.gapItems.length}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>CV matches</span>
                  <strong>{evaluation.cvMatchItems.length}</strong>
                </div>
              </div>
            </section>

            {evaluation.gapItems.length ? (
              <section className={styles.railCard}>
                <div className={styles.cardHead}>
                  <span className={styles.cardLabel}>Risk areas</span>
                  <span className={styles.cardTitle}>Questions you should expect to navigate carefully</span>
                </div>
                <div className={styles.railBody}>
                  <ul className={styles.gapList}>
                    {evaluation.gapItems.map((gap) => (
                      <li key={`${gap.gap}-${gap.mitigation}`}>
                        <strong>{gap.gap}</strong>
                        <span>{gap.mitigation || "Prepare a forward-looking framing."}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}

            {evaluation.keywords.length ? (
              <section className={styles.railCard}>
                <div className={styles.cardHead}>
                  <span className={styles.cardLabel}>Keywords</span>
                  <span className={styles.cardTitle}>Vocabulary to keep active in answers</span>
                </div>
                <div className={styles.keywordList}>
                  {evaluation.keywords.map((keyword) => (
                    <span className={styles.keyword} key={keyword}>{keyword}</span>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      )}
    </article>
  );
}
