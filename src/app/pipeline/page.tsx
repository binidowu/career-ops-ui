import Link from "next/link";

import { getOpportunities, getWorkspaceSignals } from "@/lib/api/career-ops";

export default async function PipelinePage() {
  const [opportunities, workspace] = await Promise.all([
    getOpportunities(),
    getWorkspaceSignals(),
  ]);

  return (
    <article className="app-page">
      <header className="page-head">
        <div className="page-copy">
          <p className="eyebrow">Pipeline</p>
          <h1>The operating table for active opportunities.</h1>
          <p className="lede">
            This route is framed for a full-width tracker with a sticky filter
            rail, compact rows, and an adjacent detail drawer. For now, the
            content below sketches the information rhythm the live parser will
            populate.
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
        <section className="table-preview">
          <div className="table-toolbar">
            <span className="chip">Tracked: {opportunities.length}</span>
            <span className="chip">
              Reports: {opportunities.filter((opportunity) => opportunity.reportPath).length}
            </span>
            <span className="chip">
              Active:{" "}
              {
                opportunities.filter((opportunity) =>
                  ["Applied", "Responded", "Interview", "Offer"].includes(
                    opportunity.status,
                  ),
                ).length
              }
            </span>
          </div>

          <div className="table-head" role="presentation">
            <span>Role</span>
            <span>Score</span>
            <span>Status</span>
            <span>Next note</span>
          </div>

          <div className="table-body">
            {opportunities.map((opportunity) => (
              <div className="table-row" key={opportunity.id}>
                <div>
                  <strong>
                    <Link href={`/pipeline/${opportunity.id}`}>
                      {opportunity.company} · {opportunity.role}
                    </Link>
                  </strong>
                  <small>
                    {opportunity.remote ?? "Location pending"} · Evaluated{" "}
                    {opportunity.date || "unknown date"}
                  </small>
                </div>
                <p className="tabular-nums">
                  {typeof opportunity.score === "number"
                    ? opportunity.score.toFixed(1)
                    : opportunity.scoreRaw || "N/A"}
                </p>
                <p>{opportunity.status}</p>
                <p>{opportunity.notes || opportunity.summary || "No note captured yet."}</p>
              </div>
            ))}
          </div>
        </section>
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
