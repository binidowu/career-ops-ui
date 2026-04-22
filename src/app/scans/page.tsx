import ScansWorkspace from "@/components/scans/ScansWorkspace";
import { getOpportunities, getPipelineInbox } from "@/lib/api/career-ops";

import styles from "./scans.module.css";

export default async function ScansPage() {
  const [opportunities, pipelineInbox] = await Promise.all([
    getOpportunities(),
    getPipelineInbox(),
  ]);

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.pageHead}>
        <p className={styles.breadcrumb}>Backend parity // Discovery</p>
        <h1>The Intake Console</h1>
        <p className={styles.subtitle}>
          Queue pasted roles, trigger the backend portal scanner, and inspect the
          same inbox the CLI previously managed on its own.
        </p>
      </header>

      <ScansWorkspace
        opportunitiesCount={opportunities.length}
        pipelineInbox={pipelineInbox}
      />
    </article>
  );
}
