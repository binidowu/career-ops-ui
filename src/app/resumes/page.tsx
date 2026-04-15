import ResumeStudio from "@/components/resumes/ResumeStudio";
import {
  getCvDocument,
  getOpportunities,
  getOpportunity,
  getProfile,
  getWorkspaceSignals,
} from "@/lib/api/career-ops";

export default async function ResumesPage() {
  const [opportunities, profile, workspace, cv] = await Promise.all([
    getOpportunities(),
    getProfile(),
    getWorkspaceSignals(),
    getCvDocument(),
  ]);

  const resumeReady = opportunities
    .filter((opportunity) => opportunity.reportPath)
    .sort((left, right) => {
      const scoreDifference = (right.score ?? 0) - (left.score ?? 0);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return right.date.localeCompare(left.date);
    });

  const initialDetail = resumeReady[0]
    ? await getOpportunity(resumeReady[0].id)
    : { opportunity: null, evaluation: null };

  return (
    <article className="app-page">
      <header className="page-copy">
        <p className="eyebrow">Resume studio</p>
        <h1>A focused tailoring desk with the preview and export path in one place.</h1>
        <p className="lede">
          Choose a report-backed opportunity, trim the evidence down to the
          strongest terms, and export a clean PDF through the connected
          career-ops toolchain.
        </p>
      </header>

      <ResumeStudio
        cv={cv}
        initialEvaluation={initialDetail.evaluation}
        initialOpportunity={initialDetail.opportunity}
        opportunities={opportunities}
        profile={profile}
        workspace={workspace}
      />
    </article>
  );
}
