"use client";

import Link from "next/link";
import { useMemo } from "react";

import type {
  DashboardStats,
  Opportunity,
  OpportunityStatus,
  PipelineInboxItem,
} from "@/lib/types";

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
  pipelineInbox: {
    path: string;
    pending: PipelineInboxItem[];
    processed: PipelineInboxItem[];
  };
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
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
}

type Urgency = "high" | "medium" | "normal";

function getSignal(opportunity: Opportunity): { label: string; tone: string; urgency: Urgency } {
  if (opportunity.status === "Offer") return { label: "Offer", tone: "success", urgency: "high" };
  if (opportunity.status === "Interview") return { label: "Active Interview", tone: "accent", urgency: "high" };
  if (opportunity.status === "Responded") return { label: "High Intent", tone: "accent", urgency: "medium" };
  if ((opportunity.score ?? 0) >= 4.5) return { label: "Top Match", tone: "accent", urgency: "medium" };
  const age = getAgeInDays(opportunity.date);
  if (age !== null && age >= 14) return { label: "Deadline Near", tone: "warn", urgency: "high" };
  if (opportunity.notes.toLowerCase().includes("referral")) return { label: "Referral", tone: "neutral", urgency: "normal" };
  if (!opportunity.notes.trim()) return { label: "Complete", tone: "neutral", urgency: "medium" };
  return { label: "Review", tone: "neutral", urgency: "normal" };
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
  pipelineInbox,
  stats,
  workspace,
}: DashboardOverviewProps) {
  const hasOpportunities = opportunities.length > 0;

  const attentionQueue = useMemo(
    () =>
      [...opportunities]
        .filter((o) => ACTIVE_STATUSES.has(o.status))
        .sort((a, b) => {
          const diff = getAttentionRank(b) - getAttentionRank(a);
          return diff !== 0 ? diff : b.date.localeCompare(a.date);
        })
        .slice(0, 5),
    [opportunities],
  );

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
          <div className={styles.pageHeadLeft}>
            <span className={styles.eyebrow}>Next-Action Desk</span>
            <h1 className={styles.pageTitle}>The Command Center</h1>
          </div>
        </header>

        <div className={styles.emptyCard}>
          <span className={styles.eyebrow}>Setup required</span>
          <h2>No workspace data found yet.</h2>
          <p>Create the tracker file and profile to activate the dashboard.</p>
          <div className={styles.emptyActions}>
            <Link className={styles.btnPrimary} href="/settings">Configure workspace</Link>
            <Link className={styles.btnSecondary} href="/pipeline">Open pipeline</Link>
          </div>
        </div>

        <div className={styles.railCard} style={{ maxWidth: "18rem" }}>
          <span className={styles.railLabel}>System Status</span>
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
        </div>
      </article>
    );
  }

  return (
    <article className={`app-page ${styles.page}`}>
      {/* Page head */}
      <header className={styles.pageHead}>
        <div className={styles.pageHeadLeft}>
          <span className={styles.eyebrow}>Next-Action Desk</span>
          <h1 className={styles.pageTitle}>The Command Center</h1>
          <p className={styles.pageLede}>
            A quiet operational readout of the live workspace: strongest-fit roles, active queue pressure, recent additions.
          </p>
        </div>
      </header>

      {/* Metric cards */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Pipeline Inbox</span>
          <span className={styles.metricValue}>{pipelineInbox.pending.length.toLocaleString()}</span>
          <span className={styles.metricSub}>Pending items waiting for backend evaluation</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Processed</span>
          <span className={styles.metricValue}>{pipelineInbox.processed.length.toLocaleString()}</span>
          <span className={styles.metricSub}>Entries already consumed by the backend pipeline</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Tracked Roles</span>
          <span className={`${styles.metricValue} ${styles["metricValue--accent"]}`}>
            {opportunities.length}
          </span>
          <span className={styles.metricSub}>Opportunities visible in the UI</span>
        </div>
      </div>

      {/* Two-column body */}
      <div className={styles.body}>
        {/* Left col */}
        <div className={styles.leftCol}>

          {/* Attention queue */}
          {attentionQueue.length > 0 && (
            <div>
              <div className={styles.queueHeader}>
                <span className={styles.queueEyebrow}>Attention Queue</span>
                <span className={styles.queueCount}>{attentionQueue.length} high-signal item{attentionQueue.length !== 1 ? "s" : ""}</span>
              </div>
              <div className={styles.queueItems} style={{ marginTop: "var(--space-md)" }}>
                {attentionQueue.map((opp) => {
                  const sig = getSignal(opp);
                  const isHigh = sig.urgency === "high";
                  return (
                    <div key={opp.id} className={isHigh ? styles.queueItemHigh : styles.queueItemMedium}>
                      <div className={isHigh ? styles.queueRoleHigh : styles.queueRoleMedium}>
                        <strong>{opp.role}</strong>
                        <span>{opp.company}</span>
                      </div>
                      <span className={styles.signalPill} data-tone={sig.tone}>{sig.label}</span>
                      <Link
                        href={`/pipeline/${opp.id}`}
                        className={`${styles.actionBtn} ${isHigh ? styles["actionBtn--warn"] : ""}`}
                      >
                        {getActionLabel(opp)}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current lead card */}
          {leadOpportunity && (
            <div className={styles.leadCard}>
              <div className={styles.leadCardLeft}>
                <span className={styles.leadEyebrow}>Current Lead</span>
                <h2 className={styles.leadRole}>{leadOpportunity.role}</h2>
                <p className={styles.leadCompany}>
                  {leadOpportunity.company}
                  {leadOpportunity.remote ? ` · ${leadOpportunity.remote}` : ""}
                </p>
                {leadTags.length > 0 && (
                  <div className={styles.leadTags}>
                    {leadTags.map((tag) => (
                      <span className={styles.tag} key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
                <div className={styles.leadActions}>
                  <Link className={styles.btnAccent} href={`/pipeline/${leadOpportunity.id}`}>
                    Tailor Resume &amp; Apply
                  </Link>
                  <Link className={styles.btnSecondary} href="/pipeline">
                    View Pipeline
                  </Link>
                </div>
              </div>
              {leadScore && (
                <div className={styles.leadScoreBlock}>
                  <span className={styles.leadScoreValue}>{leadScore}</span>
                  <span className={styles.leadScoreLabel}>Match Score</span>
                  <span className={styles.leadScoreSub}>Evaluation available.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className={styles.rightCol}>

          {/* Pipeline health */}
          <div className={styles.railCard}>
            <span className={styles.railLabel}>Pipeline Health</span>
            {(["Applied", "Interview", "Offer"] as const).map((status) => (
              <div key={status} className={styles.railRow}>
                <span className={styles.railRowLabel}>
                  {status === "Interview" ? "Interviewing" : status === "Offer" ? "Offered" : status}
                </span>
                <span className={`${styles.railRowValue} ${(stats.statusCounts[status] ?? 0) > 0 ? styles["railRowValue--active"] : ""}`}>
                  {stats.statusCounts[status] ?? 0}
                </span>
              </div>
            ))}
          </div>

          {/* System status */}
          <div className={styles.railCard}>
            <span className={styles.railLabel}>System Status</span>
            <div className={styles.statusRow}>
              <div className={styles.statusLeft}>
                <span className={styles.statusDot} data-status="active" />
                <span className={styles.statusLabel}>Active Scans</span>
              </div>
              <span className={styles.statusValue}>
                {stats.reportCount > 0 ? `${stats.reportCount} reports` : "Idle"}
              </span>
            </div>
            <div className={styles.statusRow}>
              <div className={styles.statusLeft}>
                <span className={styles.statusDot} data-status={workspace.trackerReady ? "ok" : "warn"} />
                <span className={styles.statusLabel}>Batch Processing</span>
              </div>
              <span className={styles.statusValue}>{workspace.trackerReady ? "Active" : "Idle"}</span>
            </div>
            <div className={styles.statusRow}>
              <div className={styles.statusLeft}>
                <span className={styles.statusDot} data-status="ok" />
                <span className={styles.statusLabel}>API Connection</span>
              </div>
              <span className={styles.statusValue}>Stable</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className={styles.quickActions}>
            <Link className={styles.quickBtn} href="/pipeline">Open full pipeline →</Link>
            <Link className={styles.quickBtn} href="/compare">Compare top fits →</Link>
            <Link className={styles.quickBtn} href="/scans">Intake Console →</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
