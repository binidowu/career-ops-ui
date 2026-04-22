"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type {
  DashboardStats,
  Opportunity,
  OpportunityStatus,
  PipelineInboxItem,
  ScanRunResult,
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

function normalizePipelineEntries(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function DashboardOverview({
  opportunities,
  pipelineInbox,
  stats,
  workspace,
}: DashboardOverviewProps) {
  const notify = useToast();
  const router = useRouter();
  const hasOpportunities = opportunities.length > 0;
  const [pipelineEntriesInput, setPipelineEntriesInput] = useState("");
  const [queueing, setQueueing] = useState(false);
  const [scanCompany, setScanCompany] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scannerResult, setScannerResult] = useState<ScanRunResult | null>(null);

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

  async function handleQueueEntries() {
    const entries = normalizePipelineEntries(pipelineEntriesInput);
    if (!entries.length) {
      notify({
        title: "Paste at least one URL",
        description: "You can paste one URL per line, or use the backend pipeline format: URL | Company | Role.",
        tone: "error",
        dismissAfter: 5000,
      });
      return;
    }

    setQueueing(true);

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = (await response.json()) as { added?: number; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to queue the pipeline entries.");
      }

      setPipelineEntriesInput("");
      notify({
        title: data.added ? "Pipeline inbox updated" : "No new URLs added",
        description: data.added
          ? `${data.added} new item${data.added === 1 ? "" : "s"} queued for backend processing.`
          : "Those URLs were already present in the pipeline inbox.",
        dismissAfter: 4000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      notify({
        title: "Queue failed",
        description:
          error instanceof Error ? error.message : "Unable to queue the pipeline entries.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setQueueing(false);
    }
  }

  async function handleRunScan() {
    setScanning(true);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: scanCompany.trim() || undefined,
          dryRun: false,
        }),
      });
      const data = (await response.json()) as ScanRunResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to run the portal scanner.");
      }

      setScannerResult(data);
      notify({
        title: "Scanner finished",
        description:
          data.summary.newOffersAdded && data.summary.newOffersAdded > 0
            ? `${data.summary.newOffersAdded} new offer${data.summary.newOffersAdded === 1 ? "" : "s"} added to the backend pipeline inbox.`
            : "Scan completed. No new offers were added this run.",
        dismissAfter: 5000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      notify({
        title: "Scan failed",
        description:
          error instanceof Error ? error.message : "Unable to run the backend scanner.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setScanning(false);
    }
  }

  const intakePanel = (
    <section className={styles.intakeSection}>
      <div className={styles.intakeCard}>
        <div className={styles.intakeHead}>
          <div>
            <p className={styles.sectionLabel}>Search & Intake</p>
            <h2 className={styles.intakeTitle}>Move backend job discovery into the UI.</h2>
          </div>
          <span className={styles.idBadge}>{pipelineInbox.pending.length} pending</span>
        </div>

        <div className={styles.intakeGrid}>
          <div className={styles.intakePanel}>
            <label className={styles.fieldLabel} htmlFor="pipeline-intake">
              Paste job URLs or pipeline entries
            </label>
            <textarea
              className={styles.intakeTextarea}
              id="pipeline-intake"
              onChange={(event) => setPipelineEntriesInput(event.target.value)}
              placeholder={"https://jobs.example.com/role\nhttps://boards.greenhouse.io/company/jobs/123 | Company | Role"}
              rows={6}
              value={pipelineEntriesInput}
            />
            <div className={styles.intakeActions}>
              <button
                className={styles.btnPrimary}
                disabled={queueing}
                onClick={() => void handleQueueEntries()}
                type="button"
              >
                {queueing ? "Queueing…" : "Queue for Backend Pipeline"}
              </button>
              <span className={styles.inputHint}>Writes to <code>{pipelineInbox.path}</code></span>
            </div>
          </div>

          <div className={styles.intakePanel}>
            <label className={styles.fieldLabel} htmlFor="scan-company">
              Trigger portal scanner
            </label>
            <input
              className={styles.intakeInput}
              id="scan-company"
              onChange={(event) => setScanCompany(event.target.value)}
              placeholder="Optional company filter, e.g. Cohere"
              type="text"
              value={scanCompany}
            />
            <div className={styles.intakeActions}>
              <button
                className={styles.btnOutline}
                disabled={scanning}
                onClick={() => void handleRunScan()}
                type="button"
              >
                {scanning ? "Scanning…" : "Run Backend Scan"}
              </button>
            </div>

            {scannerResult ? (
              <div className={styles.scanResult}>
                <div className={styles.scanStats}>
                  <span>Scanned: <strong>{scannerResult.summary.companiesScanned ?? "—"}</strong></span>
                  <span>Found: <strong>{scannerResult.summary.totalJobsFound ?? "—"}</strong></span>
                  <span>Added: <strong>{scannerResult.summary.newOffersAdded ?? "—"}</strong></span>
                  <span>Errors: <strong>{scannerResult.summary.errorsCount}</strong></span>
                </div>
                <pre className={styles.scanOutput}>{scannerResult.output}</pre>
              </div>
            ) : (
              <p className={styles.inputHint}>
                Runs the real backend `scan.mjs` script and refreshes the frontend queue when it finishes.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className={styles.queueTable}>
        <div className={styles.queueTableHead}>
          <span>Pending inbox</span>
          <span>Company hint</span>
          <span>Role hint</span>
          <span>State</span>
        </div>
        {pipelineInbox.pending.length ? (
          pipelineInbox.pending.slice(0, 6).map((item) => (
            <div className={styles.queueRow} key={`${item.url}-${item.raw}`}>
              <div className={styles.queueRoleCell}>
                <strong title={item.url}>
                  {(() => { try { return new URL(item.url).hostname; } catch { return item.url; } })()}
                </strong>
                <span>{item.url}</span>
              </div>
              <div className={styles.queueStatus}>{item.companyHint ?? "—"}</div>
              <div className={styles.queueStatus}>{item.roleHint ?? "—"}</div>
              <div>
                <span className={styles.signalBadge} data-tone="neutral">
                  {item.state}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyInline}>
            <p>No pending pipeline entries yet.</p>
            <p>Paste URLs above or run the scanner to feed the backend queue.</p>
          </div>
        )}
      </div>
    </section>
  );

  if (!hasOpportunities) {
    return (
      <article className={`app-page ${styles.page}`}>
        <header className={styles.pageHead}>
          <h1>The Next-Action Desk</h1>
          <p className={styles.subtitle}>Clinical operational overview. Prioritize and execute.</p>
        </header>

        {intakePanel}

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

          <aside className={styles.sideCard}>
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

      {intakePanel}

      <div className={styles.topRow}>
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

        <div className={styles.rightColumn}>
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
