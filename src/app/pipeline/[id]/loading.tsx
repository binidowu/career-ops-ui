export default function LoadingOpportunityDetail() {
  return (
    <div aria-busy="true" className="route-loading">
      <div className="skeleton-line" data-size="sm" />
      <div className="skeleton-line" data-size="lg" />
      <div className="skeleton-line" data-size="md" />
      <div className="detail-layout">
        <div className="detail-stack">
          <div className="detail-panel">
            <div className="skeleton-line" data-size="sm" />
            <div className="skeleton-line" data-size="md" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        </div>

        <aside className="detail-rail">
          <div className="rail-block">
            <div className="skeleton-line" data-size="sm" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        </aside>
      </div>
    </div>
  );
}
