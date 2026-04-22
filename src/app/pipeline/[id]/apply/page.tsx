import Link from "next/link";
import { notFound } from "next/navigation";

import ApplyWorkspaceClient from "@/components/apply/ApplyWorkspaceClient";
import { getApplyData, getOpportunity } from "@/lib/api/career-ops";

import styles from "./page.module.css";

export default async function OpportunityApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { opportunity } = await getOpportunity(id);

  if (!opportunity) notFound();

  const applyData = await getApplyData(id);
  const score =
    typeof opportunity.score === "number"
      ? (opportunity.score * 20).toFixed(0)
      : null;

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.head}>
        <p className={styles.breadcrumb}>
          <Link href="/pipeline">Pipeline</Link>
          {" // "}
          <Link href={`/pipeline/${opportunity.id}`}>Analysis Dossier</Link>
          {" // "}
          Apply &amp; Outreach
        </p>

        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Apply &amp; Outreach workspace</p>
            <h1>
              {opportunity.company}
              <span className={styles.roleSep}>·</span>
              {opportunity.role}
            </h1>
            {opportunity.summary ? (
              <p className={styles.subtitle}>{opportunity.summary}</p>
            ) : null}
            <div className={styles.metaRow}>
              <span className={styles.pill}>{opportunity.status}</span>
              {score ? (
                <span className={styles.pillAccent}>Score {score}/100</span>
              ) : null}
              {opportunity.archetype ? (
                <span className={styles.pill}>{opportunity.archetype}</span>
              ) : null}
              {opportunity.remote ? (
                <span className={styles.pill}>{opportunity.remote}</span>
              ) : null}
            </div>
          </div>

          <div className={styles.heroActions}>
            <Link
              className={styles.btnPrimary}
              href={`/resumes?opportunity=${opportunity.id}`}
            >
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

      <ApplyWorkspaceClient
        initialApplyData={applyData}
        opportunity={opportunity}
      />
    </article>
  );
}
