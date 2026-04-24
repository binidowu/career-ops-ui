"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type {
  PipelineInboxItem,
  PipelineProcessResult,
  ScanRunResult,
} from "@/lib/types";

import styles from "./ScansWorkspace.module.css";

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
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<PipelineProcessResult | null>(null);

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

  async function handleProcessPending() {
    setProcessing(true);

    try {
      const response = await fetch("/api/pipeline/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: Number(processLimit) || 3 }),
      });
      const data = (await response.json()) as PipelineProcessResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to process the pending pipeline items.");
      }

      setProcessResult(data);
      notify({
        title: data.resolvedCount
          ? "Pending roles processed"
          : "Processor finished with no resolved items",
        description: data.summary,
        dismissAfter: data.resolvedCount ? 6000 : null,
        tone: data.resolvedCount ? "neutral" : "error",
      });

      startTransition(() => {
        router.refresh();
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
      setProcessing(false);
    }
  }

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
              This launches the backend pipeline mode through your local Codex
              agent. Start with small batches so you can verify report quality,
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
                disabled={processing || pipelineInbox.pending.length === 0}
                onClick={() => void handleProcessPending()}
                type="button"
              >
                {processing ? "Processing…" : "Process Pending Roles"}
              </button>
            </div>

            {processResult ? (
              <div className={styles.processCard}>
                <div className={styles.processStats}>
                  <span>
                    Attempted: <strong>{processResult.attemptedCount}</strong>
                  </span>
                  <span>
                    Resolved: <strong>{processResult.resolvedCount}</strong>
                  </span>
                  <span>
                    Pending after: <strong>{processResult.pendingAfter}</strong>
                  </span>
                </div>
                <p className={styles.processSummary}>{processResult.summary}</p>
                <pre className={styles.output}>{processResult.output}</pre>
              </div>
            ) : (
              <div className={styles.processNote}>
                <p>
                  The current browser scan only fills <code>data/pipeline.md</code>.
                  This processor is the step that evaluates those queued roles and
                  moves them into the tracked pipeline.
                </p>
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
