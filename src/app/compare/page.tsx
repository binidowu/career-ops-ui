import Link from "next/link";

import { getOpportunities } from "@/lib/api/career-ops";

export default async function ComparePage() {
  const opportunities = (await getOpportunities())
    .filter((opportunity) => typeof opportunity.score === "number")
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, 3);

  return (
    <article className="app-page">
      <header className="page-head">
        <div className="page-copy">
          <p className="eyebrow">Compare</p>
          <h1>Decision support without flattening nuance.</h1>
          <p className="lede">
            This route is staged for a horizontally scrollable comparison grid
            with a sticky criteria column. The shell now gives it the width and
            hierarchy it needs.
          </p>
        </div>

        <aside className="page-note">
          <p className="note-label">Best when populated with 2–5 roles</p>
          <ul className="compact-list">
            <li>Sticky criteria on the left.</li>
            <li>Standout badges for fit, pay, stretch, and pace.</li>
            <li>Fast return to the pipeline when selection changes.</li>
          </ul>
        </aside>
      </header>

      {opportunities.length >= 2 ? (
        <section className="compare-strip">
          <div className="compare-column compare-column--labels">
            <p>Overall fit</p>
            <p>Status</p>
            <p>Archetype</p>
            <p>Next context</p>
          </div>

          {opportunities.map((opportunity) => (
            <div className="compare-column" key={opportunity.id}>
              <strong>
                <Link href={`/pipeline/${opportunity.id}`}>{opportunity.company}</Link>
              </strong>
              <p>{opportunity.score?.toFixed(1) ?? opportunity.scoreRaw}</p>
              <p>{opportunity.status}</p>
              <p>{opportunity.archetype ?? "Pending report detail"}</p>
              <p>
                {(opportunity.summary ?? opportunity.notes) ||
                  "No annotation yet."}
              </p>
            </div>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <p className="section-label">Comparison needs at least two scored roles</p>
          <h2>The structure is ready, but the tracker does not yet expose enough comparable opportunities.</h2>
          <p>
            Once two or more scored rows exist in the tracker, this view will
            switch from setup guidance to a live side-by-side board.
          </p>
        </section>
      )}
    </article>
  );
}
