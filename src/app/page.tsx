import Link from "next/link";

import { getDashboardStats, getWorkspaceSignals } from "@/lib/api/career-ops";

export default async function Home() {
  const [stats, workspace] = await Promise.all([
    getDashboardStats(),
    getWorkspaceSignals(),
  ]);

  const hasOpportunities = stats.totalEvaluated > 0;

  return (
    <article className="app-page">
      <header className="page-head">
        <div className="page-copy">
          <p className="eyebrow">Dashboard</p>
          <h1>
            {hasOpportunities
              ? "A live view of the pipeline as it exists on disk."
              : "The shell is ready; the workspace is waiting for its first records."}
          </h1>
          <p className="lede">
            {hasOpportunities
              ? "This dashboard is now reading the local career-ops workspace. The next implementation pass can deepen the visualizations, but the counts and top opportunities are already grounded in the tracker and reports."
              : "Career-Ops is connected to your local workspace, but the tracker, profile, or reports have not been populated yet. The web UI now detects that state and explains what is missing instead of showing fake dashboard data."}
          </p>
        </div>

        <aside className="page-note">
          <p className="note-label">Foundation status</p>
          <ul className="compact-list">
            <li>Sticky topbar and horizontal routing are active.</li>
            <li>⌘K / Ctrl+K opens navigation, actions, and tracked roles.</li>
            <li>The shell reads from <code>{workspace.careerOpsPath}</code>.</li>
          </ul>
        </aside>
      </header>

      {hasOpportunities ? (
        <section className="metrics-grid">
          <section className="metric-card">
            <p className="section-label">Total tracked</p>
            <h2 className="tabular-nums">{stats.totalEvaluated}</h2>
            <p>{stats.newThisWeek} added in the last 7 days.</p>
          </section>

          <section className="metric-card">
            <p className="section-label">Average score</p>
            <h2 className="tabular-nums">
              {stats.averageScore !== null ? stats.averageScore.toFixed(2) : "N/A"}
            </h2>
            <p>{stats.reportCount} report-backed entries available.</p>
          </section>

          <section className="metric-card">
            <p className="section-label">Active funnel</p>
            <h2 className="tabular-nums">
              {stats.statusCounts.Applied +
                stats.statusCounts.Responded +
                stats.statusCounts.Interview +
                stats.statusCounts.Offer}
            </h2>
            <p>Applied, responded, interviewing, or at offer stage.</p>
          </section>
        </section>
      ) : null}

      <section className="section-cluster">
        <div className="section-copy">
          <p className="section-label">
            {hasOpportunities ? "Current highlights" : "What the workspace still needs"}
          </p>
          <h2>
            {hasOpportunities
              ? "The highest-signal records surfaced from the local tracker."
              : "A clean empty state that points to the source files instead of guessing."}
          </h2>
        </div>

        <div className="ledger">
          {hasOpportunities ? (
            <>
              {stats.topScoring.map((opportunity, index) => (
                <div className="ledger-row" key={opportunity.id}>
                  <div>
                    <p className="row-kicker">{String(index + 1).padStart(2, "0")}</p>
                    <h3>
                      <Link href={`/pipeline/${opportunity.id}`}>
                        {opportunity.company} · {opportunity.role}
                      </Link>
                    </h3>
                  </div>
                  <p>
                    {typeof opportunity.score === "number"
                      ? `${opportunity.score.toFixed(1)} score`
                      : opportunity.scoreRaw}
                    {" · "}
                    {opportunity.status}
                    {opportunity.summary ? ` · ${opportunity.summary}` : ""}
                  </p>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="ledger-row">
                <div>
                  <p className="row-kicker">01</p>
                  <h3>Create the tracker</h3>
                </div>
                <p>
                  Add <code>{workspace.trackerPath}</code> in the connected
                  career-ops repo. The parser supports both root-level and
                  <code>data/</code>-scoped tracker files.
                </p>
              </div>

              <div className="ledger-row">
                <div>
                  <p className="row-kicker">02</p>
                  <h3>Add your profile</h3>
                </div>
                <p>
                  Create <code>{workspace.profilePath}</code> from the example
                  file so settings, resume tailoring, and future scoring context
                  have a source of truth.
                </p>
              </div>

              <div className="ledger-row">
                <div>
                  <p className="row-kicker">03</p>
                  <h3>Generate reports</h3>
                </div>
                <p>
                  Once evaluations create markdown reports, the pipeline and
                  detail routes will automatically enrich opportunities with
                  archetype, summary, and report-level context.
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </article>
  );
}
