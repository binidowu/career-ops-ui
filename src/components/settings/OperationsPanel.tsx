"use client";

import { useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type { SystemCheckId, SystemCheckResult } from "@/lib/types";

import styles from "./OperationsPanel.module.css";

interface OperationsPanelProps {
  snapshot: {
    pendingQueue: number;
    reportCount: number;
    resumeSourceCount: number;
    trackedRoles: number;
    urlsAvailableForLiveness: number;
    workspacePath: string;
  };
}

interface CheckDefinition {
  description: string;
  id: SystemCheckId;
  title: string;
}

const CHECKS: CheckDefinition[] = [
  {
    id: "doctor",
    title: "Workspace doctor",
    description: "Validate prerequisites like profile, resumes, fonts, and required directories.",
  },
  {
    id: "verify",
    title: "Pipeline verify",
    description: "Check tracker integrity, duplicates, broken report links, and score formatting.",
  },
  {
    id: "sync-check",
    title: "Resume sync check",
    description: "Verify that profile, resume sources, and prompt inputs stay consistent.",
  },
  {
    id: "liveness",
    title: "Job link liveness",
    description: "Test tracked opportunity URLs to see whether postings are still active.",
  },
];

function statusLabel(status?: SystemCheckResult["status"]) {
  if (status === "fail") return "Needs work";
  if (status === "warn") return "Review";
  if (status === "pass") return "Healthy";
  return "Idle";
}

function renderMetric(result: SystemCheckResult | null) {
  if (!result) return null;

  switch (result.checkId) {
    case "doctor":
      return `${result.counts.passes ?? 0} pass / ${result.counts.failures ?? 0} fail`;
    case "verify":
    case "sync-check":
      return `${result.counts.errors ?? 0} errors / ${result.counts.warnings ?? 0} warnings`;
    case "liveness":
      return `${result.counts.active ?? 0} active / ${result.counts.expired ?? 0} expired / ${result.counts.uncertain ?? 0} uncertain`;
    default:
      return null;
  }
}

export default function OperationsPanel({ snapshot }: OperationsPanelProps) {
  const notify = useToast();
  const [runningCheck, setRunningCheck] = useState<SystemCheckId | null>(null);
  const [results, setResults] = useState<Partial<Record<SystemCheckId, SystemCheckResult>>>({});

  async function handleRunCheck(checkId: SystemCheckId) {
    setRunningCheck(checkId);

    try {
      const response = await fetch("/api/system/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkId }),
      });

      const data = (await response.json()) as SystemCheckResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to run the backend check.");
      }

      setResults((current) => ({
        ...current,
        [checkId]: data,
      }));

      notify({
        title: `${data.title} completed`,
        description: data.summary,
        tone: data.status === "fail" ? "error" : "neutral",
        dismissAfter: data.status === "fail" ? null : 5000,
      });
    } catch (error) {
      notify({
        title: "System check failed to run",
        description:
          error instanceof Error ? error.message : "Unable to run the backend check.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setRunningCheck(null);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div>
          <p className={styles.eyebrow}>Operations</p>
          <h2>Run backend health checks without dropping to the terminal.</h2>
        </div>
        <span className={styles.workspacePath}>{snapshot.workspacePath}</span>
      </div>

      <div className={styles.snapshotGrid}>
        <div className={styles.snapshotCard}>
          <strong>{snapshot.trackedRoles}</strong>
          <span>Tracked roles</span>
        </div>
        <div className={styles.snapshotCard}>
          <strong>{snapshot.reportCount}</strong>
          <span>Reports available</span>
        </div>
        <div className={styles.snapshotCard}>
          <strong>{snapshot.pendingQueue}</strong>
          <span>Pending inbox entries</span>
        </div>
        <div className={styles.snapshotCard}>
          <strong>{snapshot.urlsAvailableForLiveness}</strong>
          <span>URLs available for liveness</span>
        </div>
      </div>

      <div className={styles.checkList}>
        {CHECKS.map((check) => {
          const result = results[check.id] ?? null;
          const isRunning = runningCheck === check.id;

          return (
            <article className={styles.checkCard} key={check.id}>
              <div className={styles.checkHead}>
                <div>
                  <p className={styles.checkTitle}>{check.title}</p>
                  <p className={styles.checkDescription}>{check.description}</p>
                </div>
                <span className={styles.statusBadge} data-status={result?.status ?? "idle"}>
                  {statusLabel(result?.status)}
                </span>
              </div>

              <div className={styles.checkMeta}>
                <span>
                  {result ? result.summary : "Not run yet in this session."}
                </span>
                {result ? <span>{renderMetric(result)}</span> : null}
              </div>

              {result?.details.length ? (
                <ul className={styles.details}>
                  {result.details.slice(0, 4).map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}

              <div className={styles.actions}>
                <button
                  className={styles.runButton}
                  disabled={Boolean(runningCheck)}
                  onClick={() => void handleRunCheck(check.id)}
                  type="button"
                >
                  {isRunning ? "Running…" : "Run check"}
                </button>
              </div>

              {result ? (
                <details className={styles.outputWrap}>
                  <summary>Raw output</summary>
                  <pre className={styles.output}>{result.output}</pre>
                </details>
              ) : null}
            </article>
          );
        })}
      </div>

      <p className={styles.panelHint}>
        Resume sources configured: {snapshot.resumeSourceCount}.
      </p>
    </section>
  );
}
