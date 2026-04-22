import Link from "next/link";

import { getOpportunities } from "@/lib/api/career-ops";
import type { Opportunity, OpportunityStatus } from "@/lib/types";

import styles from "./apply.module.css";

type FunnelStage = "ready" | "active" | "closed";

function getStage(status: OpportunityStatus): FunnelStage {
  if (status === "Applied" || status === "Responded" || status === "Interview") return "active";
  if (status === "Offer" || status === "Rejected" || status === "Discarded") return "closed";
  return "ready";
}

function scoreDisplay(opp: Opportunity) {
  if (typeof opp.score === "number") return (opp.score * 20).toFixed(0);
  return null;
}

function OpportunityCard({ opp }: { opp: Opportunity }) {
  const score = scoreDisplay(opp);
  return (
    <article className={styles.card}>
      <div className={styles.cardMeta}>
        <span className={styles.cardStatus}>{opp.status}</span>
        {score ? <span className={styles.cardScore}>{score}</span> : null}
      </div>
      <h3 className={styles.cardCompany}>{opp.company}</h3>
      <p className={styles.cardRole}>{opp.role}</p>
      {opp.summary ? <p className={styles.cardSummary}>{opp.summary}</p> : null}
      <div className={styles.cardActions}>
        <Link className={styles.cardPrimary} href={`/pipeline/${opp.id}/apply`}>
          Open workspace
        </Link>
        <Link className={styles.cardSecondary} href={`/pipeline/${opp.id}`}>
          Dossier
        </Link>
        {opp.jobUrl ? (
          <a
            className={styles.cardSecondary}
            href={opp.jobUrl}
            rel="noreferrer"
            target="_blank"
          >
            Posting ↗
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default async function ApplyPage() {
  const opportunities = await getOpportunities();

  const ready = opportunities.filter((o) => getStage(o.status) === "ready" && o.status !== "SKIP" && o.status !== "Unknown");
  const active = opportunities.filter((o) => getStage(o.status) === "active");
  const closed = opportunities.filter((o) => getStage(o.status) === "closed");

  // Sort ready by score descending so highest-priority roles appear first
  ready.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const stages = [
    {
      key: "ready",
      label: "Ready to Apply",
      hint: "Evaluated roles waiting for action",
      items: ready,
    },
    {
      key: "active",
      label: "In Progress",
      hint: "Applications submitted or actively engaged",
      items: active,
    },
    {
      key: "closed",
      label: "Closed",
      hint: "Offers, rejections, and withdrawals",
      items: closed,
    },
  ] as const;

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">Apply Pipeline</p>
          <h1>Application Workspace</h1>
          <p className={styles.subtitle}>
            Move evaluated roles through the apply funnel. Draft cover letters,
            write outreach messages, and track every submission from one place.
          </p>
        </div>
        <div className={styles.headStats}>
          <div className={styles.statItem}>
            <strong>{ready.length}</strong>
            <span>Ready</span>
          </div>
          <div className={styles.statItem}>
            <strong>{active.length}</strong>
            <span>Active</span>
          </div>
          <div className={styles.statItem}>
            <strong>{closed.length}</strong>
            <span>Closed</span>
          </div>
        </div>
      </header>

      {opportunities.length === 0 ? (
        <div className="empty-state">
          <p className="eyebrow">Nothing tracked yet</p>
          <h2>No opportunities in the pipeline.</h2>
          <p>
            Evaluate roles through the{" "}
            <Link href="/pipeline">Pipeline</Link> first,
            then come back here to manage applications.
          </p>
        </div>
      ) : (
        <div className={styles.funnel}>
          {stages.map(({ key, label, hint, items }) => (
            <section key={key} className={styles.stage} data-stage={key}>
              <header className={styles.stageHead}>
                <div>
                  <h2 className={styles.stageLabel}>{label}</h2>
                  <p className={styles.stageHint}>{hint}</p>
                </div>
                <span className={styles.stageCount}>{items.length}</span>
              </header>
              {items.length ? (
                <div className={styles.stageItems}>
                  {items.map((opp) => (
                    <OpportunityCard key={opp.id} opp={opp} />
                  ))}
                </div>
              ) : (
                <div className={styles.stageEmpty}>
                  <p>Nothing here yet.</p>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
