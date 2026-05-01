"use client";

import { useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type { MaintenanceCommandId, MaintenanceMode, MaintenanceResult } from "@/lib/types";

import styles from "./MaintenancePanel.module.css";

interface CommandDef {
  description: string;
  hasDryRun: boolean;
  id: MaintenanceCommandId;
  title: string;
  warning?: string;
}

const TRACKER_COMMANDS: CommandDef[] = [
  {
    id: "normalize",
    title: "Normalize statuses",
    description:
      "Map non-canonical status values to their canonical equivalents and strip formatting artefacts from the tracker.",
    hasDryRun: true,
  },
  {
    id: "dedup",
    title: "Deduplicate tracker",
    description:
      "Detect duplicate entries by company and role. Keeps the highest-scored row and merges notes from discarded duplicates.",
    hasDryRun: true,
    warning:
      "Duplicate rows are permanently deleted from applications.md. Always preview first and verify the diff before applying.",
  },
  {
    id: "merge",
    title: "Merge batch additions",
    description:
      "Merge pending TSV additions from the batch folder into applications.md. Skips entries that are already tracked.",
    hasDryRun: true,
  },
];

type CommandState = "idle" | "running-preview" | "previewed" | "running-apply" | "applied";

interface CommandCardProps {
  def: CommandDef;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}

function CommandCard({ def, disabled, onBusy }: CommandCardProps) {
  const notify = useToast();
  const [state, setState] = useState<CommandState>("idle");
  const [result, setResult] = useState<MaintenanceResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function run(mode: MaintenanceMode) {
    const isPreview = mode === "preview";
    setState(isPreview ? "running-preview" : "running-apply");
    onBusy(true);

    try {
      const response = await fetch("/api/system/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandId: def.id, mode }),
      });

      const data = (await response.json()) as MaintenanceResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "The maintenance command failed.");
      }

      setResult(data);
      setConfirming(false);

      if (isPreview) {
        setState("previewed");
      } else {
        setState("applied");
        notify({
          title: `${def.title} complete`,
          description: data.summary,
          tone: data.status === "error" ? "error" : "neutral",
          dismissAfter: data.status === "error" ? null : 5000,
        });
      }
    } catch (error) {
      setState(def.hasDryRun ? "idle" : "idle");
      setConfirming(false);
      notify({
        title: `${def.title} failed`,
        description: error instanceof Error ? error.message : "Unable to run the command.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      onBusy(false);
    }
  }

  function reset() {
    setState("idle");
    setResult(null);
    setConfirming(false);
  }

  const isRunning = state === "running-preview" || state === "running-apply";

  return (
    <article className={styles.commandCard}>
      <div className={styles.commandHead}>
        <div>
          <p className={styles.commandTitle}>{def.title}</p>
          <p className={styles.commandDesc}>{def.description}</p>
        </div>
        {result ? (
          <span className={styles.statusBadge} data-status={result.status}>
            {result.status === "ok" ? "Clean" : result.status === "warn" ? "Changes" : "Error"}
          </span>
        ) : (
          <span className={styles.statusBadge} data-status="idle">Idle</span>
        )}
      </div>

      {def.warning && state === "idle" ? (
        <p className={styles.commandWarning}>{def.warning}</p>
      ) : null}

      {result ? (
        <p className={styles.commandSummary}>{result.summary}</p>
      ) : null}

      {result?.output ? (
        <details className={styles.outputWrap}>
          <summary>Raw output</summary>
          <pre className={styles.output}>{result.output}</pre>
        </details>
      ) : null}

      <div className={styles.commandActions}>
        {state === "idle" && (
          <button
            className={styles.previewBtn}
            disabled={disabled}
            onClick={() => void run("preview")}
            type="button"
          >
            Preview changes
          </button>
        )}

        {state === "running-preview" && (
          <button className={styles.previewBtn} disabled type="button">
            Previewing…
          </button>
        )}

        {state === "previewed" && (
          <>
            {result?.changesFound === 0 ? (
              <button className={styles.ghostBtn} onClick={reset} type="button">
                Dismiss
              </button>
            ) : confirming ? (
              <>
                <span
                  className={styles.confirmPrompt}
                  data-destructive={def.id === "dedup"}
                >
                  {def.id === "dedup"
                    ? `Permanently delete ${result?.changesFound} duplicate row${result?.changesFound !== 1 ? "s" : ""} from applications.md?`
                    : def.id === "normalize"
                      ? `Apply ${result?.changesFound} status correction${result?.changesFound !== 1 ? "s" : ""} to applications.md?`
                      : `Merge ${result?.changesFound} entr${result?.changesFound !== 1 ? "ies" : "y"} into applications.md?`}
                </span>
                <button
                  className={def.id === "dedup" ? styles.destructiveBtn : styles.applyBtn}
                  disabled={disabled}
                  onClick={() => void run("apply")}
                  type="button"
                >
                  {def.id === "dedup" ? "Yes, delete duplicates" : "Yes, apply"}
                </button>
                <button
                  className={styles.ghostBtn}
                  onClick={() => setConfirming(false)}
                  type="button"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className={styles.applyBtn}
                  disabled={disabled}
                  onClick={() => setConfirming(true)}
                  type="button"
                >
                  Apply {result?.changesFound} change{result?.changesFound !== 1 ? "s" : ""}
                </button>
                <button className={styles.ghostBtn} onClick={reset} type="button">
                  Dismiss
                </button>
              </>
            )}
          </>
        )}

        {state === "running-apply" && (
          <button className={styles.applyBtn} disabled type="button">
            Applying…
          </button>
        )}

        {state === "applied" && (
          <button className={styles.ghostBtn} onClick={reset} type="button">
            Run again
          </button>
        )}
      </div>
    </article>
  );
}

interface UpdateCardProps {
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}

function UpdateCard({ disabled, onBusy }: UpdateCardProps) {
  const notify = useToast();
  const [running, setRunning] = useState<MaintenanceCommandId | null>(null);
  const [checkResult, setCheckResult] = useState<MaintenanceResult | null>(null);
  const [updateApplied, setUpdateApplied] = useState(false);
  const [confirming, setConfirming] = useState<"update-apply" | "rollback" | null>(null);

  async function run(commandId: MaintenanceCommandId) {
    setRunning(commandId);
    onBusy(true);
    setConfirming(null);

    try {
      const response = await fetch("/api/system/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandId, mode: "apply" }),
      });

      const data = (await response.json()) as MaintenanceResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "The command failed.");
      }

      if (commandId === "update-check") {
        setCheckResult(data);
      } else {
        if (commandId === "update-apply" && data.status !== "error") {
          setUpdateApplied(true);
        }
        notify({
          title: commandId === "rollback" ? "Rollback complete" : "Update applied",
          description: data.summary,
          tone: data.status === "error" ? "error" : "neutral",
          dismissAfter: data.status === "error" ? null : 5000,
        });
      }
    } catch (error) {
      notify({
        title: "Command failed",
        description: error instanceof Error ? error.message : "Unable to run the command.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setRunning(null);
      onBusy(false);
    }
  }

  const isRunning = running !== null;
  const updateAvailable = checkResult !== null && checkResult.changesFound > 0;
  const checkedAndCurrent = checkResult !== null && checkResult.changesFound === 0;

  return (
    <article className={styles.commandCard}>
      <div className={styles.commandHead}>
        <div>
          <p className={styles.commandTitle}>System updates</p>
          <p className={styles.commandDesc}>
            Check for and apply career-ops system layer updates. Only system files are
            touched — your data, reports, and profile are never modified.
          </p>
        </div>
        {checkResult ? (
          <span className={styles.statusBadge} data-status={checkResult.status}>
            {updateAvailable ? "Update available" : "Up to date"}
          </span>
        ) : (
          <span className={styles.statusBadge} data-status="idle">Idle</span>
        )}
      </div>

      {checkResult ? (
        <p className={styles.commandSummary}>{checkResult.summary}</p>
      ) : null}

      {confirming ? (
        <div className={styles.confirmRow}>
          <span
            className={styles.confirmPrompt}
            data-destructive={confirming === "rollback"}
          >
            {confirming === "rollback"
              ? "Revert the last system update? System scripts will return to the previous version."
              : "Apply the available system update to career-ops system files?"}
          </span>
          <button
            className={confirming === "rollback" ? styles.destructiveBtn : styles.applyBtn}
            disabled={isRunning || disabled}
            onClick={() => void run(confirming)}
            type="button"
          >
            {running === confirming
              ? "Running…"
              : confirming === "rollback"
                ? "Yes, rollback"
                : "Yes, apply update"}
          </button>
          <button
            className={styles.ghostBtn}
            onClick={() => setConfirming(null)}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className={styles.commandActions}>
          <button
            className={styles.previewBtn}
            disabled={isRunning || disabled}
            onClick={() => void run("update-check")}
            type="button"
          >
            {running === "update-check" ? "Checking…" : "Check for updates"}
          </button>
          <button
            className={styles.applyBtn}
            disabled={isRunning || disabled || checkedAndCurrent}
            onClick={() => setConfirming("update-apply")}
            title={checkedAndCurrent ? "System is already up to date" : undefined}
            type="button"
          >
            Apply update
          </button>
          {updateApplied ? (
            <button
              className={styles.ghostBtn}
              disabled={isRunning || disabled}
              onClick={() => setConfirming("rollback")}
              type="button"
            >
              Rollback
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
}

export default function MaintenancePanel() {
  const [busyCount, setBusyCount] = useState(0);
  const anyBusy = busyCount > 0;

  function handleBusy(busy: boolean) {
    setBusyCount((c) => Math.max(0, c + (busy ? 1 : -1)));
  }

  return (
    <section className={styles.panel}>
      <div className={styles.cautionHeader}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: "var(--color-warning)", flexShrink: 0 }}>
          <path d="M8 1.5L1.5 13.5h13L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M8 6v3.5M8 11.25v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className={styles.cautionLabel}>Write Operations — Mutates pipeline data</span>
      </div>
      <div className={styles.panelHead}>
        <div>
          <p className={styles.eyebrow}>Maintenance Operations</p>
          <h2>These operations mutate data. Review each action before running.</h2>
        </div>
        <p className={styles.panelSubtitle}>
          Preview before applying — a backup is written automatically before any change is committed to disk.
        </p>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>Tracker operations</p>
        <div className={styles.commandList}>
          {TRACKER_COMMANDS.map((def) => (
            <CommandCard
              def={def}
              disabled={anyBusy}
              key={def.id}
              onBusy={handleBusy}
            />
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>System</p>
        <UpdateCard disabled={anyBusy} onBusy={handleBusy} />
      </div>
    </section>
  );
}
