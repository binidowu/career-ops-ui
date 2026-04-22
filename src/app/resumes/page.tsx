import ResumeStudio from "@/components/resumes/ResumeStudio";
import {
  getOpportunities,
  getOpportunity,
  getProfile,
  getWorkspaceSignals,
} from "@/lib/api/career-ops";

import styles from "./resumes.module.css";

export default async function ResumesPage({
  searchParams,
}: {
  searchParams?: Promise<{ opportunity?: string }>;
}) {
  const [opportunities, profile, workspace] = await Promise.all([
    getOpportunities(),
    getProfile(),
    getWorkspaceSignals(),
  ]);
  const resolvedSearchParams = await searchParams;

  const resumeReady = opportunities
    .filter((o) => o.reportPath)
    .sort((a, b) => {
      const diff = (b.score ?? 0) - (a.score ?? 0);
      return diff !== 0 ? diff : b.date.localeCompare(a.date);
    });

  const preferredOpportunityId = resolvedSearchParams?.opportunity?.trim();
  const preferredOpportunity = preferredOpportunityId
    ? resumeReady.find((opportunity) => opportunity.id === preferredOpportunityId) ?? null
    : null;
  const initialTarget = preferredOpportunity ?? resumeReady[0] ?? null;

  const initialDetail = initialTarget
    ? await getOpportunity(initialTarget.id)
    : { opportunity: null, evaluation: null };

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.pageHead}>
        <div>
          <h1>The Asset Laboratory</h1>
          <p className={styles.subtitle}>Refined Resume Studio V2.1</p>
        </div>
      </header>

      <ResumeStudio
        initialEvaluation={initialDetail.evaluation}
        initialOpportunity={initialDetail.opportunity}
        opportunities={opportunities}
        profile={profile}
        workspace={workspace}
      />
    </article>
  );
}
