"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type {
  PipelineInboxItem,
  PipelineProcessJob,
  PipelineProcessStartResponse,
  ScanRunResult,
} from "@/lib/types";

import styles from "./ScansWorkspace.module.css";

const PROCESS_STALE_MS = 1000 * 60 * 8;

interface ScansWorkspaceProps {
  opportunitiesCount: number;
  pipelineInbox: {
    path: string;
    pending: PipelineInboxItem[];
    processed: PipelineInboxItem[];
  };
}

function normalizePipelineEntries(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatRelativeSeconds(value: string | null) {
  if (!value) {
    return "Waiting for first heartbeat";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffSeconds = Math.max(0, Math.round(diffMs / 1000));

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${minutes}m ${seconds}s ago`;
}

function formatElapsed(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt) {
    return "Not started yet";
  }

  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const diffSeconds = Math.max(0, Math.round((end - start) / 1000));
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export default function ScansWorkspace({
  opportunitiesCount,
  pipelineInbox,
}: ScansWorkspaceProps) {
  const notify = useToast();
  const router = useRouter();
  const [pipelineEntriesInput, setPipelineEntriesInput] = useState("");
  const [queueing, setQueueing] = useState(false);
  const [scanCompany, setScanCompany] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scannerResult, setScannerResult] = useState<ScanRunResult | null>(null);
  const [processLimit, setProcessLimit] = useState("3");
  const [processJob, setProcessJob] = useState<PipelineProcessJob | null>(null);
  const [processLoading, setProcessLoading] = useState(true);
  const [directUrl, setDirectUrl] = useState("");
  const [directEvaluating, setDirectEvaluating] = useState(false);

  async function handleQueueEntries() {
    const entries = normalizePipelineEntries(pipelineEntriesInput);
    if (!entries.length) {
      notify({
        title: "Paste at least one URL",
        description:
          "Use one URL per line, or the backend pipeline format: URL | Company | Role.",
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

  async function handleDirectEvaluate() {
    const url = directUrl.trim();
    if (!url) {
      notify({
        title: "Paste a URL first",
        description: "Enter the job posting URL you want to evaluate directly.",
        tone: "error",
        dismissAfter: 4000,
      });
      return;
    }

    setDirectEvaluating(true);
    setProcessLoading(true);

    try {
      const response = await fetch("/api/pipeline/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directUrl: url }),
      });
      const data = (await response.json()) as PipelineProcessStartResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to start direct evaluation.");
      }

      setDirectUrl("");
      setProcessJob(data.job);
      notify({
        title: "Direct evaluation started",
        description: "Claude is evaluating the URL now. The status card will update live.",
        dismissAfter: 4500,
      });
    } catch (error) {
      notify({
        title: "Direct evaluation failed",
        description: error instanceof Error ? error.message : "Unable to start the evaluation.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setDirectEvaluating(false);
      setProcessLoading(false);
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
        throw new Error(data.error ?? "Unable to run the backend scanner.");
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

  async function refreshProcessJob(jobId?: string) {
    const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : "";
    const response = await fetch(`/api/pipeline/process${query}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as { job?: PipelineProcessJob | null };
    setProcessJob(data.job ?? null);
    return data.job ?? null;
  }

  useEffect(() => {
    void (async () => {
      try {
        await refreshProcessJob();
      } finally {
        setProcessLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!processJob || !["queued", "running"].includes(processJob.status)) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshProcessJob(processJob.id).then((job) => {
        if (job && ["completed", "failed"].includes(job.status)) {
          startTransition(() => {
            router.refresh();
          });
        }
      });
    }, 2500);

    return () => window.clearInterval(interval);
  }, [processJob, router]);

  async function handleProcessPending() {
    setProcessLoading(true);

    try {
      const response = await fetch("/api/pipeline/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: Number(processLimit) || 3 }),
      });
      const data = (await response.json()) as PipelineProcessStartResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to process the pending pipeline items.");
      }

      setProcessJob(data.job);
      notify({
        title: data.started ? "Pipeline processor started" : "Processor already running",
        description: data.started
          ? `Background job started for ${data.job.attemptedCount} pending role${data.job.attemptedCount === 1 ? "" : "s"}.`
          : "A pipeline batch is already running. The status card will keep updating live.",
        dismissAfter: 4500,
      });
    } catch (error) {
      notify({
        title: "Pipeline processing failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to process the pending pipeline items.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setProcessLoading(false);
    }
  }

  async function handleClearStaleProcess() {
    if (!processJob) {
      return;
    }

    setProcessLoading(true);

    try {
      const response = await fetch("/api/pipeline/process", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear-stale",
          jobId: processJob.id,
        }),
      });
      const data = (await response.json()) as { error?: string; job?: PipelineProcessJob | null };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to clear the stuck pipeline processor.");
      }

      setProcessJob(null);
      notify({
        title: "Processor cleared",
        description: "The stuck processor lock was cleared. You can start a fresh batch now.",
        dismissAfter: 4500,
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      notify({
        title: "Unable to clear processor",
        description:
          error instanceof Error ? error.message : "Unable to clear the stuck pipeline processor.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setProcessLoading(false);
    }
  }

  const processHeartbeatLabel = useMemo(
    () => formatRelativeSeconds(processJob?.heartbeatAt ?? processJob?.updatedAt ?? null),
    [processJob],
  );
  const processElapsedLabel = useMemo(
    () => formatElapsed(processJob?.startedAt ?? null, processJob?.finishedAt ?? null),
    [processJob],
  );
  const processIsActive = processJob
    ? ["queued", "running"].includes(processJob.status)
    : false;
  const processLastSignalAt = processJob
    ? processJob.heartbeatAt ?? processJob.updatedAt ?? processJob.startedAt ?? processJob.createdAt
    : null;
  const processLastSignalMs = processLastSignalAt
    ? new Date(processLastSignalAt).getTime()
    : 0;
  const processIsStale = Boolean(
    processJob &&
    processIsActive &&
    (
      // Broken state: finishedAt is set but status is still active. Show the
      // clear button unconditionally.
      processJob.finishedAt ||
      Date.now() - processLastSignalMs > PROCESS_STALE_MS
    ),
  );

  function renderInboxRows(items: PipelineInboxItem[], emptyTitle: string, emptyBody: string) {
    if (!items.length) {
      return (
        <div className={styles.emptyState}>
          <p>{emptyTitle}</p>
          <p>{emptyBody}</p>
        </div>
      );
    }

    return items.map((item) => (
      <div className={styles.row} key={`${item.state}-${item.url}-${item.raw}`}>
        <div className={styles.primaryCell}>
          <strong>{item.roleHint ?? item.url}</strong>
          <span>{item.companyHint ?? item.url}</span>
        </div>
        <div className={styles.metaCell}>
          <span className={styles.badge}>{item.state}</span>
          {item.score ? <span>Score {item.score}</span> : null}
          {item.reportNumber ? <span>Report {item.reportNumber}</span> : null}
        </div>
      </div>
    ));
  }

  return (
    <section className={styles.workspace}>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <p className={styles.eyebrow}>Pipeline Inbox</p>
          <strong>{pipelineInbox.pending.length}</strong>
          <span>Pending items waiting for backend evaluation</span>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.eyebrow}>Processed</p>
          <strong>{pipelineInbox.processed.length}</strong>
          <span>Entries already consumed by the backend pipeline</span>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.eyebrow}>Tracked Roles</p>
          <strong>{opportunitiesCount}</strong>
          <span>Opportunities already visible elsewhere in the UI</span>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.eyebrow}>Manual Intake</p>
              <h2>Paste roles exactly the way the backend expects them.</h2>
            </div>
            <span className={styles.pathBadge}>{pipelineInbox.path}</span>
          </div>

          <p className={styles.copy}>
            Use one URL per line, or include hints with <code>URL | Company | Role</code>.
            This writes directly into the backend pipeline inbox so the rest of the system
            can process it without any terminal work.
          </p>

          <label className={styles.label} htmlFor="pipeline-intake-console">
            Intake payload
          </label>
          <textarea
            className={styles.textarea}
            id="pipeline-intake-console"
            onChange={(event) => setPipelineEntriesInput(event.target.value)}
            placeholder={"https://jobs.example.com/role\nhttps://boards.greenhouse.io/company/jobs/123 | Company | Role"}
            rows={8}
            value={pipelineEntriesInput}
          />

          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              disabled={queueing}
              onClick={() => void handleQueueEntries()}
              type="button"
            >
              {queueing ? "Queueing…" : "Queue for Backend Pipeline"}
            </button>
            <Link className={styles.secondaryLink} href="/pipeline">
              Open live pipeline
            </Link>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.eyebrow}>Direct Evaluate</p>
              <h2>Evaluate a URL immediately without touching the queue.</h2>
            </div>
          </div>

          <p className={styles.copy}>
            Paste any job posting URL and Claude will run the full A–F evaluation, write the
            report, generate the PDF, and update the tracker — without adding it to or consuming
            anything from the pending queue.
          </p>

          <label className={styles.label} htmlFor="direct-eval-url">
            Job posting URL
          </label>
          <input
            className={styles.input}
            id="direct-eval-url"
            onChange={(e) => setDirectUrl(e.target.value)}
            placeholder="https://boards.greenhouse.io/company/jobs/123"
            type="url"
            value={directUrl}
          />

          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              disabled={directEvaluating || (processIsActive && !processIsStale) || !directUrl.trim()}
              onClick={() => void handleDirectEvaluate()}
              type="button"
            >
              {directEvaluating ? "Starting…" : "Evaluate Now"}
            </button>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.eyebrow}>Scanner Trigger</p>
              <h2>Run the real portal scanner from the browser.</h2>
            </div>
          </div>

          <p className={styles.copy}>
            This calls the backend <code>scan.mjs</code> script and then refreshes the inbox
            so any newly discovered roles become visible in the UI immediately.
          </p>

          <label className={styles.label} htmlFor="scan-company-console">
            Optional company filter
          </label>
          <input
            className={styles.input}
            id="scan-company-console"
            onChange={(event) => setScanCompany(event.target.value)}
            placeholder="Optional company filter, e.g. Cohere"
            type="text"
            value={scanCompany}
          />

          <div className={styles.actions}>
            <button
              className={styles.secondaryButton}
              disabled={scanning}
              onClick={() => void handleRunScan()}
              type="button"
            >
              {scanning ? "Scanning…" : "Run Backend Scan"}
            </button>
            <Link className={styles.secondaryLink} href="/">
              Return to dashboard
            </Link>
          </div>

          <div className={styles.processBlock}>
            <div className={styles.processHead}>
              <div>
                <p className={styles.eyebrow}>Pipeline Processor</p>
                <h3>Move the oldest pending roles through the full backend workflow.</h3>
              </div>
              <span className={styles.processBadge}>
                {pipelineInbox.pending.length} waiting
              </span>
            </div>

            <p className={styles.copy}>
              This launches the backend pipeline mode through your configured
              local worker. Start with small batches so you can verify report quality,
              tracker writes, and PDF output before scaling up.
            </p>

            <div className={styles.processControls}>
              <div className={styles.processField}>
                <label className={styles.label} htmlFor="pipeline-process-limit">
                  Batch size
                </label>
                <select
                  className={styles.select}
                  id="pipeline-process-limit"
                  onChange={(event) => setProcessLimit(event.target.value)}
                  value={processLimit}
                >
                  <option value="1">1 pending role</option>
                  <option value="3">3 pending roles</option>
                  <option value="5">5 pending roles</option>
                  <option value="10">10 pending roles</option>
                </select>
              </div>

              <button
                className={styles.primaryButton}
                disabled={(processIsActive && !processIsStale) || processLoading || pipelineInbox.pending.length === 0}
                onClick={() => void handleProcessPending()}
                type="button"
              >
                {processIsStale
                  ? "Clear & Process Pending"
                  : processIsActive
                    ? "Processing…"
                    : "Process Pending Roles"}
              </button>

              {processIsStale ? (
                <button
                  className={styles.secondaryButton}
                  disabled={processLoading}
                  onClick={() => void handleClearStaleProcess()}
                  type="button"
                >
                  Clear Stuck Run
                </button>
              ) : null}
            </div>

            {processJob ? (
              <div className={styles.processCard}>
                <div className={styles.processStatusRow}>
                  <span
                    className={styles.processStatusBadge}
                    data-status={processJob.status}
                  >
                    {processJob.status}
                  </span>
                  <div className={styles.processStage}>
                    <strong>{processJob.progressLabel}</strong>
                    <span>
                      {processJob.stage} · {processJob.progressPercent}%
                    </span>
                  </div>
                </div>

                <div
                  aria-hidden="true"
                  className={styles.processMeter}
                  data-active={processIsActive}
                >
                  <span
                    className={styles.processMeterFill}
                    style={{ width: `${processJob.progressPercent}%` }}
                  />
                </div>

                <div className={styles.processStats}>
                  <span>
                    Attempted: <strong>{processJob.attemptedCount}</strong>
                  </span>
                  <span>
                    Elapsed: <strong>{processElapsedLabel}</strong>
                  </span>
                  <span>
                    Heartbeat: <strong>{processHeartbeatLabel}</strong>
                  </span>
                </div>

                {processIsStale ? (
                  <p className={styles.processWarning}>
                    This run has stopped sending heartbeats. Clear it and retry with one
                    item if needed; starting a fresh run will also clear stale processor
                    locks automatically.
                  </p>
                ) : null}

                <p className={styles.processSummary}>
                  {processJob.summary ??
                    "The batch is running in the background. This card will refresh automatically."}
                </p>

                <div className={styles.processStats}>
                  <span>
                    Pending before: <strong>{processJob.pendingBefore}</strong>
                  </span>
                  <span>
                    Pending after: <strong>{processJob.pendingAfter ?? "—"}</strong>
                  </span>
                  <span>
                    Resolved: <strong>{processJob.resolvedCount ?? "—"}</strong>
                  </span>
                </div>

                {processJob.output ? <pre className={styles.output}>{processJob.output}</pre> : null}
              </div>
            ) : (
              <div className={styles.processNote}>
                <p>
                  The current browser scan only fills <code>data/pipeline.md</code>.
                  This processor is the step that evaluates those queued roles and
                  moves them into the tracked pipeline.
                </p>
                {processLoading ? <p>Checking the latest processor state…</p> : null}
              </div>
            )}
          </div>

          {scannerResult ? (
            <div className={styles.scanCard}>
              <div className={styles.scanStats}>
                <span>Scanned: <strong>{scannerResult.summary.companiesScanned ?? "—"}</strong></span>
                <span>Found: <strong>{scannerResult.summary.totalJobsFound ?? "—"}</strong></span>
                <span>Added: <strong>{scannerResult.summary.newOffersAdded ?? "—"}</strong></span>
                <span>Errors: <strong>{scannerResult.summary.errorsCount}</strong></span>
              </div>
              <pre className={styles.output}>{scannerResult.output}</pre>
            </div>
          ) : (
            <div className={styles.helpCard}>
              <p>Scanner runs are recorded live here once triggered.</p>
              <p>
                Start broad, then use a company filter when you want to target one portal or
                debug a specific source.
              </p>
            </div>
          )}
        </section>
      </div>

      <div className={styles.ledger}>
        <section className={styles.ledgerColumn}>
          <div className={styles.ledgerHead}>
            <div>
              <p className={styles.eyebrow}>Pending Queue</p>
              <h2>What the backend still needs to evaluate.</h2>
            </div>
            <span>{pipelineInbox.pending.length} waiting</span>
          </div>
          <div className={styles.rows}>
            {renderInboxRows(
              pipelineInbox.pending,
              "No pending pipeline entries yet.",
              "Paste URLs above or run the scanner to feed the backend queue.",
            )}
          </div>
        </section>

        <section className={styles.ledgerColumn}>
          <div className={styles.ledgerHead}>
            <div>
              <p className={styles.eyebrow}>Processed Trail</p>
              <h2>What already moved through the backend inbox.</h2>
            </div>
            <span>{pipelineInbox.processed.length} processed</span>
          </div>
          <div className={styles.rows}>
            {renderInboxRows(
              pipelineInbox.processed.slice(0, 12),
              "No processed entries recorded yet.",
              "Once the backend consumes pipeline links, they will show up here.",
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
