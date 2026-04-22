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

function getAgeInDays(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const difference = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(difference / (1000 * 60 * 60 * 24)));
}

function getSignalLabel(opportunity: Opportunity): { label: string; tone: string } {
  if (opportunity.status === "Offer") return { label: "Offer", tone: "success" };
  if (opportunity.status === "Interview") return { label: "Active Interview", tone: "accent" };
  if (opportunity.status === "Responded") return { label: "High Intent", tone: "accent" };
  if ((opportunity.score ?? 0) >= 4.5) return { label: "Top Match", tone: "accent" };

  const age = getAgeInDays(opportunity.date);
  if (age !== null && age >= 14) return { label: "Deadline Near", tone: "warn" };
  if (opportunity.notes.toLowerCase().includes("referral")) return { label: "Referral", tone: "neutral" };

  return { label: "Review", tone: "neutral" };
}

function getActionLabel(opportunity: Opportunity) {
  if (opportunity.status === "Offer") return "DECIDE";
  if (opportunity.status === "Interview") return "PREP";
  if (opportunity.status === "Applied" || opportunity.status === "Responded") return "FOLLOW UP";
  if (!opportunity.notes.trim()) return "COMPLETE";
  return "REVIEW";
}

function getAttentionRank(opportunity: Opportunity) {
  const age = getAgeInDays(opportunity.date) ?? 0;
  let rank = 0;
  switch (opportunity.status) {
    case "Offer": rank += 12; break;
    case "Interview": rank += 10; break;
    case "Responded": rank += 8; break;
    case "Applied": rank += 6; break;
    case "Evaluated": rank += 4; break;
    default: break;
  }
  if (typeof opportunity.score === "number") rank += opportunity.score * 2;
  if (!opportunity.notes.trim()) rank += 2;
  if (age >= 14) rank += 4;
  else if (age >= 7) rank += 2;
  return rank;
}

export default function DashboardOverview({
  opportunities,
  stats,
  workspace,
}: DashboardOverviewProps) {
  const hasOpportunities = opportunities.length > 0;

  const attentionQueue = [...opportunities]
    .filter((o) => ACTIVE_STATUSES.has(o.status))
    .sort((a, b) => {
      const diff = getAttentionRank(b) - getAttentionRank(a);
      return diff !== 0 ? diff : b.date.localeCompare(a.date);
    })
    .slice(0, 5);

  const leadOpportunity = attentionQueue[0] ?? null;

  const leadScore = leadOpportunity
    ? `${Math.round((leadOpportunity.score ?? 0) * 20)}%`
    : null;

  const leadTags = leadOpportunity?.archetype
    ? leadOpportunity.archetype.split(/[,/]/).map((t) => t.trim()).filter(Boolean).slice(0, 3)
    : [];

  if (!hasOpportunities) {
    return (
      <article className={`app-page ${styles.page}`}>
        <header className={styles.pageHead}>
          <h1>The Next-Action Desk</h1>
          <p className={styles.subtitle}>Clinical operational overview. Prioritize and execute.</p>
        </header>

        <div className={styles.emptyState}>
          <div className={styles.emptyCard}>
            <p className={styles.sectionLabel}>Setup required</p>
            <h2>No workspace data found yet.</h2>
            <p>Create the tracker file and profile to activate the dashboard.</p>
            <div className={styles.emptyActions}>
              <Link className={styles.btnPrimary} href="/settings">Configure workspace</Link>
              <Link className={styles.btnOutline} href="/pipeline">Open pipeline</Link>
            </div>
          </div>

          <aside className={styles.statusCard}>
            <p className={styles.sectionLabel}>System Status</p>
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
                <strong>{workspace.reportsReady ? "Ready" : "Missing"}</strong>
              </li>
            </ul>
          </aside>
        </div>
      </article>
    );
  }

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.pageHead}>
        <h1>The Next-Action Desk</h1>
        <p className={styles.subtitle}>Clinical operational overview. Prioritize and execute.</p>
      </header>

      <div className={styles.topRow}>
        {/* CURRENT LEAD */}
        <div className={styles.leadCard}>
          <div className={styles.leadCardMeta}>
            <span className={styles.sectionLabel}>Current Lead</span>
            {leadOpportunity && (
              <span className={styles.idBadge}>
                ID: {leadOpportunity.id.toUpperCase().slice(0, 8)}
              </span>
            )}
          </div>

          {leadOpportunity ? (
            <div className={styles.leadInner}>
              <div className={styles.leadLeft}>
                <h2 className={styles.leadRole}>{leadOpportunity.role}</h2>
                <p className={styles.leadCompany}>
                  {leadOpportunity.company}
                  {leadOpportunity.remote ? ` · ${leadOpportunity.remote}` : ""}
                </p>
                {leadTags.length > 0 && (
                  <div className={styles.tagRow}>
                    {leadTags.map((tag) => (
                      <span className={styles.tag} key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.leadRight}>
                {leadScore && (
                  <p className={styles.matchScore}>
                    <span className={styles.matchNumber}>{leadScore}</span>
                    <span className={styles.matchLabel}>Match Score</span>
                  </p>
                )}
                <p className={styles.leadSummary}>
                  {leadOpportunity.summary || leadOpportunity.notes || "No summary captured yet."}
                </p>
                <Link
                  className={styles.btnPrimary}
                  href={`/pipeline/${leadOpportunity.id}`}
                >
                  Tailor Resume &amp; Apply
                </Link>
              </div>
            </div>
          ) : (
            <p>No active leads in the pipeline yet.</p>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.rightColumn}>
          {/* PIPELINE HEALTH */}
          <div className={styles.sideCard}>
            <p className={styles.sectionLabel}>Pipeline Health</p>
            <div className={styles.healthList}>
              <div className={styles.healthRow}>
                <span>Applied</span>
                <strong className={styles.healthCount}>{stats.statusCounts.Applied ?? 0}</strong>
              </div>
              <div className={styles.healthRow}>
                <span>Interviewing</span>
                <strong
                  className={styles.healthCount}
                  data-active={Boolean(stats.statusCounts.Interview)}
                >
                  {stats.statusCounts.Interview ?? 0}
                </strong>
              </div>
              <div className={styles.healthRow}>
                <span>Offered</span>
                <strong
                  className={styles.healthCount}
                  data-offer={Boolean(stats.statusCounts.Offer)}
                >
                  {stats.statusCounts.Offer ?? 0}
                </strong>
              </div>
            </div>
          </div>

          {/* SYSTEM STATUS */}
          <div className={styles.sideCard}>
            <p className={styles.sectionLabel}>System Status</p>
            <ul className={styles.systemList}>
              <li>
                <span className={styles.systemIcon} data-status="active" />
                <span className={styles.systemLabel}>Active Scans</span>
                <span className={styles.systemValue}>{stats.reportCount > 0 ? `${stats.reportCount} reports` : "Idle"}</span>
              </li>
              <li>
                <span className={styles.systemIcon} data-status={workspace.trackerReady ? "ok" : "warn"} />
                <span className={styles.systemLabel}>Batch Processing</span>
                <span className={styles.systemValue}>{workspace.trackerReady ? "Active" : "Idle"}</span>
              </li>
              <li>
                <span className={styles.systemIcon} data-status="ok" />
                <span className={styles.systemLabel}>API Connection</span>
                <span className={styles.systemValue}>Stable</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ATTENTION QUEUE */}
      {attentionQueue.length > 0 && (
        <section className={styles.queueSection}>
          <div className={styles.queueHeader}>
            <h2 className={styles.queueTitle}>Attention Queue</h2>
            <span className={styles.queueCount}>{attentionQueue.length} High-Signal Items</span>
          </div>

          <div className={styles.queueTable}>
            <div className={styles.queueTableHead}>
              <span>Role / Company</span>
              <span>Signal</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {attentionQueue.map((opportunity) => {
              const signal = getSignalLabel(opportunity);
              return (
                <div className={styles.queueRow} key={opportunity.id}>
                  <div className={styles.queueRoleCell}>
                    <strong>{opportunity.role}</strong>
                    <span>{opportunity.company}</span>
                  </div>
                  <div>
                    <span className={styles.signalBadge} data-tone={signal.tone}>
                      {signal.label}
                    </span>
                  </div>
                  <div className={styles.queueStatus}>
                    {opportunity.status}
                  </div>
                  <div>
                    <Link
                      className={styles.actionLink}
                      href={`/pipeline/${opportunity.id}`}
                    >
                      {getActionLabel(opportunity)}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
