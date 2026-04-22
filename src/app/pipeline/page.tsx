import PipelineWorkspace from "@/components/pipeline/PipelineWorkspace";

import {
  getOpportunities,
  getStates,
  getWorkspaceSignals,
} from "@/lib/api/career-ops";

import styles from "./pipeline.module.css";

export default async function PipelinePage() {
  const [opportunities, states, workspace] = await Promise.all([
    getOpportunities(),
    getStates(),
    getWorkspaceSignals(),
  ]);

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.pageHead}>
        <p className={styles.breadcrumb}>Workspace // Active</p>
        <h1>The Operating Table</h1>
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
