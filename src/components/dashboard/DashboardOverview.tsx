import Link from "next/link";

import type { DashboardStats, Opportunity, OpportunityStatus } from "@/lib/types";

import styles from "./DashboardOverview.module.css";

interface WorkspaceSignals {
  trackerReady: boolean;
  profileReady: boolean;
  reportsReady: boolean;
  careerOpsPath: string;
  trackerPath: string;
  profilePath: string;
}

interface DashboardOverviewProps {
  opportunities: Opportunity[];
  stats: DashboardStats;
  workspace: WorkspaceSignals;
}

const ACTIVE_STATUSES = new Set<OpportunityStatus>([
  "Evaluated",
  "Applied",
  "Responded",
  "Interview",
  "Offer",
]);

function formatScore(opportunity: Opportunity) {
  if (typeof opportunity.score === "number") {
    return opportunity.score.toFixed(1);
  }

  return opportunity.scoreRaw || "N/A";
}

function getAgeInDays(date: string) {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const difference = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(difference / (1000 * 60 * 60 * 24)));
}

function formatAgeLabel(date: string) {
  const age = getAgeInDays(date);

  if (age === null) {
    return "Date pending";
  }

  if (age === 0) {
    return "Added today";
  }

  if (age === 1) {
    return "1 day ago";
  }

  return `${age} days ago`;
}

function getAttentionReasons(opportunity: Opportunity) {
  const age = getAgeInDays(opportunity.date);
  const reasons: string[] = [];

  if (opportunity.status === "Offer") {
    reasons.push("Offer stage");
  } else if (opportunity.status === "Interview") {
    reasons.push("Interview active");
  } else if (opportunity.status === "Responded") {
    reasons.push("Conversation open");
  } else if (opportunity.status === "Applied") {
    reasons.push("Application live");
  }

  if ((opportunity.score ?? 0) >= 4.5) {
    reasons.push("Highest-fit role");
  } else if ((opportunity.score ?? 0) >= 4) {
    reasons.push("Strong fit");
  }

  if (!opportunity.reportPath) {
    reasons.push("Report missing");
  }

  if (!opportunity.notes.trim()) {
    reasons.push("Notes missing");
  }

  if (age !== null && age >= 14) {
    reasons.push(`${age}d in queue`);
  } else if (age !== null && age >= 7) {
    reasons.push("Needs review");
  }

  return reasons.slice(0, 3);
}

function getAttentionRank(opportunity: Opportunity) {
  const age = getAgeInDays(opportunity.date) ?? 0;
  let rank = 0;

  switch (opportunity.status) {
    case "Offer":
      rank += 12;
      break;
    case "Interview":
      rank += 10;
      break;
    case "Responded":
      rank += 8;
      break;
    case "Applied":
      rank += 6;
      break;
    case "Evaluated":
      rank += 4;
      break;
    default:
      break;
  }

  if (typeof opportunity.score === "number") {
    rank += opportunity.score * 2;
  }

  if (!opportunity.notes.trim()) {
    rank += 2;
  }

  if (!opportunity.reportPath) {
    rank += 1;
  }

  if (age >= 14) {
    rank += 4;
  } else if (age >= 7) {
    rank += 2;
  }

  return rank;
}

function statusTone(status: OpportunityStatus) {
  if (status === "Offer") {
    return "success";
  }

  if (status === "Interview" || status === "Responded" || status === "Applied") {
    return "info";
  }

  if (status === "Rejected" || status === "Discarded" || status === "SKIP") {
    return "quiet";
  }

  return "default";
}

export default function DashboardOverview({
  opportunities,
  stats,
  workspace,
}: DashboardOverviewProps) {
  const hasOpportunities = opportunities.length > 0;
  const activeFunnelCount =
    stats.statusCounts.Applied +
    stats.statusCounts.Responded +
    stats.statusCounts.Interview +
    stats.statusCounts.Offer;
  const reportCoverage = stats.totalEvaluated
    ? Math.round((stats.reportCount / stats.totalEvaluated) * 100)
    : 0;
  const attentionQueue = [...opportunities]
    .filter((opportunity) => ACTIVE_STATUSES.has(opportunity.status))
    .sort((left, right) => {
      const rankDifference = getAttentionRank(right) - getAttentionRank(left);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return right.date.localeCompare(left.date);
    })
    .slice(0, 4);
  const recentActivity = [...opportunities]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 4);
  const statusRows = Object.entries(stats.statusCounts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);
  const strongestRole = stats.topScoring[0] ?? attentionQueue[0] ?? null;
  const leadOpportunity = attentionQueue[0] ?? null;
  const supportingQueue = attentionQueue.slice(1);

  if (!hasOpportunities) {
    return (
      <article className={`app-page ${styles.dashboardPage}`}>
        <header className={styles.hero}>
          <div className={styles.heroIntro}>
            <p className="eyebrow">Dashboard</p>
            <h1>The command center is live; the dossier just needs its first records.</h1>
            <p className="lede">
              The shell is now reading your connected career-ops workspace and
              reporting exactly what is present on disk. Nothing is fabricated:
              this state means the tracker, profile, or reports still need to be
              created.
            </p>

            <div className={styles.actionRow}>
              <Link className={styles.primaryAction} href="/settings">
                Create profile source of truth
              </Link>
              <Link className={styles.secondaryAction} href="/pipeline">
                Open pipeline route
              </Link>
            </div>
          </div>

          <aside className={styles.heroAside}>
            <p className="note-label">Workspace pulse</p>
            <ul className={styles.signalList}>
              <li data-ready={workspace.trackerReady}>
                <span>Tracker</span>
                <strong>{workspace.trackerReady ? "Connected" : "Missing"}</strong>
              </li>
              <li data-ready={workspace.profileReady}>
                <span>Profile</span>
                <strong>{workspace.profileReady ? "Connected" : "Missing"}</strong>
              </li>
              <li data-ready={workspace.reportsReady}>
                <span>Reports</span>
                <strong>{workspace.reportsReady ? "Directory ready" : "Missing"}</strong>
              </li>
            </ul>

            <p className={styles.pathNote}>
              Live workspace: <code>{workspace.careerOpsPath}</code>
            </p>
          </aside>
        </header>

        <section className={styles.emptyGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className="section-label">First setup sequence</p>
              <h2>Three files unlock the rest of Phase 1.</h2>
            </div>

            <div className={styles.setupSteps}>
              <div className={styles.stepCard}>
                <p className={styles.stepIndex}>01</p>
                <h3>Create the tracker markdown</h3>
                <p>
                  Add <code>{workspace.trackerPath}</code> so the dashboard and
                  pipeline can hydrate real opportunities.
                </p>
              </div>

              <div className={styles.stepCard}>
                <p className={styles.stepIndex}>02</p>
                <h3>Save a profile</h3>
                <p>
                  Populate <code>{workspace.profilePath}</code> from the example
                  file to drive resume tailoring and narrative context.
                </p>
              </div>

              <div className={styles.stepCard}>
                <p className={styles.stepIndex}>03</p>
                <h3>Generate evaluation reports</h3>
                <p>
                  As markdown reports appear, the dashboard will automatically
                  enrich each role with summaries, archetypes, and outputs.
                </p>
              </div>
            </div>
          </section>

          <aside className={styles.sideColumn}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <p className="section-label">What the shell can already do</p>
                <h2>Navigation and writes are no longer placeholders.</h2>
              </div>

              <ul className={styles.bulletList}>
                <li>Dashboard, pipeline, compare, resumes, and settings are routed.</li>
                <li>Profile edits write to the connected workspace.</li>
                <li>Tracker status and notes can update once roles exist.</li>
                <li>Command palette results reflect live workspace data.</li>
              </ul>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <p className="section-label">Next practical moves</p>
                <h2>Start with the files that unlock the highest leverage.</h2>
              </div>

              <nav className={styles.linkStack} aria-label="Dashboard quick actions">
                <Link href="/settings">Finish profile setup</Link>
                <Link href="/pipeline">Inspect tracker status</Link>
                <Link href="/resumes">See resume studio scaffolding</Link>
              </nav>
            </section>
          </aside>
        </section>
      </article>
    );
  }

  return (
    <article className={`app-page ${styles.dashboardPage}`}>
      <header className={styles.hero}>
        <div className={styles.heroIntro}>
          <p className="eyebrow">Dashboard</p>
          <h1>The next-action desk for the roles currently in motion.</h1>
          <p className="lede">
            A quiet operational readout of the live career-ops workspace:
            strongest-fit roles, active queue pressure, recent additions, and
            the pieces of the system that still need attention.
          </p>

          <dl className={styles.heroStats}>
            <div>
              <dt>Total tracked</dt>
              <dd className="tabular-nums">{stats.totalEvaluated}</dd>
            </div>
            <div>
              <dt>Active funnel</dt>
              <dd className="tabular-nums">{activeFunnelCount}</dd>
            </div>
            <div>
              <dt>Report coverage</dt>
              <dd className="tabular-nums">{reportCoverage}%</dd>
            </div>
          </dl>
        </div>

        <aside className={styles.heroAside}>
          <p className="note-label">Current advantage</p>
          {strongestRole ? (
            <div className={styles.spotlight}>
              <div className={styles.spotlightHeader}>
                <p className={styles.spotlightKicker}>Strongest role on file</p>
                <span
                  className={styles.statusPill}
                  data-tone={statusTone(strongestRole.status)}
                >
                  {strongestRole.status}
                </span>
              </div>
              <h2>
                <Link href={`/pipeline/${strongestRole.id}`}>
                  {strongestRole.company} · {strongestRole.role}
                </Link>
              </h2>
              <p>
                Score {formatScore(strongestRole)}
                {strongestRole.archetype ? ` · ${strongestRole.archetype}` : ""}
              </p>
              <p className={styles.pathNote}>
                {(strongestRole.summary ?? strongestRole.notes) ||
                  "No summary captured yet."}
              </p>
            </div>
          ) : null}

          <div className={styles.actionRow}>
            <Link className={styles.primaryAction} href="/pipeline">
              Open full pipeline
            </Link>
            <Link className={styles.secondaryAction} href="/compare">
              Compare top fits
            </Link>
          </div>
        </aside>
      </header>

      <section className={styles.dashboardGrid}>
        <div className={styles.mainColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className="section-label">Attention queue</p>
              <h2>Roles most likely to deserve the next deliberate move.</h2>
            </div>

            {leadOpportunity ? (
              <div className={styles.queueSplit}>
                <Link
                  className={styles.queueLead}
                  href={`/pipeline/${leadOpportunity.id}`}
                >
                  <div className={styles.queueHeading}>
                    <div>
                      <p className={styles.kickerLine}>Primary next move</p>
                      <strong>
                        {leadOpportunity.company} · {leadOpportunity.role}
                      </strong>
                      <p>
                        {formatAgeLabel(leadOpportunity.date)}
                        {leadOpportunity.archetype
                          ? ` · ${leadOpportunity.archetype}`
                          : ""}
                      </p>
                    </div>

                    <div className={styles.queueMeta}>
                      <span className={styles.scoreBadge}>
                        Score {formatScore(leadOpportunity)}
                      </span>
                      <span
                        className={styles.statusPill}
                        data-tone={statusTone(leadOpportunity.status)}
                      >
                        {leadOpportunity.status}
                      </span>
                    </div>
                  </div>

                  <div className={styles.badgeRow}>
                    {getAttentionReasons(leadOpportunity).map((reason) => (
                      <span className={styles.reasonBadge} key={reason}>
                        {reason}
                      </span>
                    ))}
                  </div>

                  <p>
                    {leadOpportunity.notes ||
                      leadOpportunity.summary ||
                      "No note captured yet."}
                  </p>
                </Link>

                <div className={styles.stack}>
                  {supportingQueue.map((opportunity) => (
                    <Link
                      className={styles.queueItem}
                      href={`/pipeline/${opportunity.id}`}
                      key={opportunity.id}
                    >
                      <div className={styles.queueHeading}>
                        <div>
                          <strong>
                            {opportunity.company} · {opportunity.role}
                          </strong>
                          <p>
                            {formatAgeLabel(opportunity.date)}
                            {opportunity.archetype
                              ? ` · ${opportunity.archetype}`
                              : ""}
                          </p>
                        </div>

                        <div className={styles.queueMeta}>
                          <span className={styles.scoreBadge}>
                            {formatScore(opportunity)}
                          </span>
                          <span
                            className={styles.statusPill}
                            data-tone={statusTone(opportunity.status)}
                          >
                            {opportunity.status}
                          </span>
                        </div>
                      </div>

                      <p>
                        {opportunity.notes ||
                          opportunity.summary ||
                          "No note captured yet."}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className="section-label">Best-fit roles</p>
              <h2>The highest scoring opportunities currently on the board.</h2>
            </div>

            <div className={styles.tableLike}>
              {stats.topScoring.slice(0, 5).map((opportunity, index) => (
                <div className={styles.tableRow} key={opportunity.id}>
                  <p className={styles.rank}>{String(index + 1).padStart(2, "0")}</p>
                  <div className={styles.rowCopy}>
                    <strong>
                      <Link href={`/pipeline/${opportunity.id}`}>
                        {opportunity.company} · {opportunity.role}
                      </Link>
                    </strong>
                    <p>
                      {opportunity.summary || opportunity.notes || "No summary captured yet."}
                    </p>
                  </div>
                  <div className={styles.rowMeta}>
                    <span className={`${styles.scoreBadge} tabular-nums`}>
                      {formatScore(opportunity)}
                    </span>
                    <small>{opportunity.status}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className="section-label">Recent activity</p>
              <h2>The newest entries to land in the tracker.</h2>
            </div>

            <div className={styles.activityStrip}>
              {recentActivity.map((opportunity) => (
                <Link
                  className={styles.activityCard}
                  href={`/pipeline/${opportunity.id}`}
                  key={opportunity.id}
                >
                  <p className={styles.activityDate}>{opportunity.date}</p>
                  <h3>{opportunity.company}</h3>
                  <p>{opportunity.role}</p>
                  <small>
                    {opportunity.status}
                    {opportunity.remote ? ` · ${opportunity.remote}` : ""}
                  </small>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className="section-label">Funnel shape</p>
              <h2>Status distribution across the live tracker.</h2>
            </div>

            <div className={styles.statusList}>
              {statusRows.map(([status, count]) => (
                <div className={styles.statusRow} key={status}>
                  <div className={styles.statusLabel}>
                    <span>{status}</span>
                    <strong className="tabular-nums">{count}</strong>
                  </div>
                  <div className={styles.statusBar}>
                    <span
                      style={{
                        width: `${Math.max(
                          12,
                          Math.round((count / stats.totalEvaluated) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className="section-label">System readiness</p>
              <h2>The parts of the workspace still affecting depth and quality.</h2>
            </div>

            <ul className={styles.signalList}>
              <li data-ready={workspace.trackerReady}>
                <span>Tracker file</span>
                <strong>{workspace.trackerReady ? "Ready" : "Missing"}</strong>
              </li>
              <li data-ready={workspace.profileReady}>
                <span>Profile source</span>
                <strong>{workspace.profileReady ? "Ready" : "Needs setup"}</strong>
              </li>
              <li data-ready={workspace.reportsReady}>
                <span>Reports directory</span>
                <strong>{workspace.reportsReady ? "Ready" : "Missing"}</strong>
              </li>
              <li data-ready={stats.reportCount > 0}>
                <span>Report-backed roles</span>
                <strong>{stats.reportCount}</strong>
              </li>
            </ul>

            <p className={styles.pathNote}>
              Workspace path: <code>{workspace.careerOpsPath}</code>
            </p>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className="section-label">Quick routes</p>
              <h2>Jump directly into the next likely workspace.</h2>
            </div>

            <nav className={styles.linkStack} aria-label="Dashboard quick routes">
              <Link href="/pipeline">Review the full tracker</Link>
              <Link href="/settings">
                {stats.profileReady ? "Refine profile settings" : "Finish profile setup"}
              </Link>
              <Link href="/resumes">Open resume studio</Link>
              <Link href="/compare">Review comparison workspace</Link>
            </nav>
          </section>
        </aside>
      </section>
    </article>
  );
}
