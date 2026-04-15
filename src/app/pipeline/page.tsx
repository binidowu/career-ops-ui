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
          <p className="note-label">Planned interactions</p>
          <ul className="compact-list">
            <li>Dense rows with sort and status controls.</li>
            <li>Right-side detail drawer that preserves table context.</li>
            <li>Bulk actions and compare handoff for selected roles.</li>
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
