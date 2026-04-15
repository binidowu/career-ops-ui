import { notFound } from "next/navigation";

import OpportunityStatusEditor from "@/components/pipeline/OpportunityStatusEditor";
import { getOpportunity, getStates } from "@/lib/api/career-ops";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ opportunity, evaluation }, states] = await Promise.all([
    getOpportunity(id),
    getStates(),
  ]);

  if (!opportunity) {
    notFound();
  }

  return (
    <article className="app-page">
      <header className="page-head">
        <div className="page-copy">
          <p className="eyebrow">Opportunity detail</p>
          <h1>
            {opportunity.company} · {opportunity.role}
          </h1>
          <p className="lede">
            {evaluation
              ? evaluation.summary
              : "This route resolves correctly, but no markdown report was found for the selected opportunity yet."}
          </p>
        </div>

        <aside className="page-note">
          <p className="note-label">Route preview</p>
          <ul className="compact-list">
            <li>Dynamic segment: <code>{id}</code></li>
            <li>Status: {opportunity.status}</li>
            <li>
              Score:{" "}
              {typeof opportunity.score === "number"
                ? opportunity.score.toFixed(1)
                : opportunity.scoreRaw || "N/A"}
            </li>
          </ul>
        </aside>
      </header>

      <section className="detail-layout">
        <div className="detail-stack">
          <section className="detail-panel">
            <p className="section-label">Evaluation structure</p>
            <h2>
              {evaluation
                ? "The report has been parsed into structured sections."
                : "The detail route is live even when a report has not been generated yet."}
            </h2>
            {evaluation ? (
              <ul className="compact-list">
                <li>Archetype: {evaluation.archetype}</li>
                <li>Detected level: {evaluation.detectedLevel ?? "Unavailable"}</li>
                <li>CV match rows: {evaluation.cvMatchItems.length}</li>
                <li>Gap rows: {evaluation.gapItems.length}</li>
                <li>Interview prompts: {evaluation.interviewItems.length}</li>
                <li>Keywords extracted: {evaluation.keywords.length}</li>
              </ul>
            ) : (
              <p>
                Once a report lands in <code>reports/</code>, this page will
                show the A–F evaluation blocks, compensation context, and resume
                tailoring cues without changing its route structure.
              </p>
            )}
          </section>

          <section className="detail-panel">
            <p className="section-label">Why this matters</p>
            {evaluation ? (
              <p>
                {evaluation.seniorityStrategy ||
                  evaluation.personalizationNotes ||
                  "The underlying report is present and ready for richer UI treatment in the next pass."}
              </p>
            ) : (
              <p>
                This route remains useful even before the report exists: the
                tracker row can still resolve by id and preserve future deep
                links from the pipeline and command palette.
              </p>
            )}
          </section>
        </div>

        <aside className="detail-rail">
          <section className="rail-block">
            <p className="rail-label">Status</p>
            <strong>{opportunity.status}</strong>
            <OpportunityStatusEditor
              initialNotes={opportunity.notes}
              initialStatus={opportunity.status}
              opportunityId={opportunity.id}
              statusOptions={states.map((state) => state.label).filter(
                (label) => label !== "Unknown",
              )}
            />
          </section>

          <section className="rail-block">
            <p className="rail-label">Outputs</p>
            <p>
              Report: {opportunity.reportPath ?? "Missing"}<br />
              PDF: {opportunity.hasPdf ? "Generated" : "Not yet"}<br />
              URL: {opportunity.jobUrl ?? "Unavailable"}
            </p>
          </section>
        </aside>
      </section>
    </article>
  );
}
