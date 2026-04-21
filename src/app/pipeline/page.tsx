import PipelineWorkspace from "@/components/pipeline/PipelineWorkspace";

import {
  getOpportunities,
  getStates,
  getWorkspaceSignals,
} from "@/lib/api/career-ops";

export default async function PipelinePage() {
  const [opportunities, states, workspace] = await Promise.all([
    getOpportunities(),
    getStates(),
    getWorkspaceSignals(),
  ]);
  const reportCount = opportunities.filter((opportunity) => opportunity.reportPath).length;
  const averageScore = opportunities.length
    ? opportunities.reduce((total, opportunity) => total + (opportunity.score ?? 0), 0) /
      opportunities.length
    : null;

  return (
    <article className="app-page">
      <header className="page-head">
        <div className="page-copy">
          <p className="eyebrow">Pipeline</p>
          <h1>The operating table for active opportunities.</h1>
          <p className="lede">
            This route now runs as a working tracker: sticky filters, sortable
            columns, bulk selection, and a right-side dossier drawer layered on
            top of the live career-ops data model.
          </p>
        </div>

        <aside className="page-note">
          <p className="note-label">Live tracker</p>
          <ul className="compact-list">
            <li>{opportunities.length} tracked roles in this workspace.</li>
            <li>{reportCount} linked reports currently available.</li>
            <li>
              Average score:{" "}
              {typeof averageScore === "number" ? averageScore.toFixed(1) : "N/A"}
            </li>
          </ul>
        </aside>
      </header>

      {opportunities.length ? (
        <PipelineWorkspace
          opportunities={opportunities}
          statusOptions={states
            .map((state) => state.label)
            .filter((label) => label !== "Unknown")}
        />
      ) : (
        <section className="empty-state">
          <p className="section-label">No tracked opportunities yet</p>
          <h2>The pipeline route is connected, but the tracker file is still absent.</h2>
          <p>
            Create <code>{workspace.trackerPath}</code> inside{" "}
            <code>{workspace.careerOpsPath}</code> and the table will populate
            from real tracker rows automatically.
          </p>
        </section>
      )}
    </article>
  );
}
