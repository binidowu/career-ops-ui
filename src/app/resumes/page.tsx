import { getOpportunities } from "@/lib/api/career-ops";

export default async function ResumesPage() {
  const opportunities = await getOpportunities();
  const withReports = opportunities.filter((opportunity) => opportunity.reportPath);
  const withPdf = opportunities.filter((opportunity) => opportunity.hasPdf);

  return (
    <article className="app-page">
      <header className="page-head">
        <div className="page-copy">
          <p className="eyebrow">Resume studio</p>
          <h1>A focused workshop for tailoring, not a wizard.</h1>
          <p className="lede">
            The route is reserved for a direct-manipulation layout: controls on
            the left, live preview on the right, and export actions that stay
            close to the working draft.
          </p>
        </div>

        <aside className="page-note">
          <p className="note-label">Studio flow</p>
          <ul className="compact-list">
            <li>Select a source opportunity.</li>
            <li>Toggle or rewrite target keywords.</li>
            <li>Generate and export a PDF without leaving the page.</li>
          </ul>
        </aside>
      </header>

      <section className="detail-layout">
        <div className="detail-panel">
          <p className="section-label">Preview pane</p>
          <h2>
            {withReports.length
              ? "The route can already see which opportunities are resume-ready."
              : "Resume studio is connected, but there are no report-backed opportunities yet."}
          </h2>
          <p>
            {withReports.length
              ? `${withReports.length} tracked role${withReports.length === 1 ? "" : "s"} have report paths, and ${withPdf.length} already show generated PDFs in the tracker.`
              : "Generate a few evaluations first; resume tailoring will then have source opportunities, keywords, and downstream PDF context to work from."}
          </p>
        </div>

        <aside className="detail-rail">
          <section className="rail-block">
            <p className="rail-label">Inputs</p>
            <p>
              Role selector, keyword toggles, and format choices will bind to
              the report-backed opportunity set rather than static fixtures.
            </p>
          </section>
        </aside>
      </section>
    </article>
  );
}
