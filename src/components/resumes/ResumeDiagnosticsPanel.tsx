"use client";

import type { ResumeDocument, ResumeRewriteResult } from "@/lib/types";

import styles from "./ResumeRightRail.module.css";

interface Props {
  document: ResumeDocument | undefined;
  rewrite: ResumeRewriteResult | undefined;
}

const SEVERITY_LABELS: Record<string, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
};

export function ResumeDiagnosticsPanel({ document, rewrite }: Props) {
  const docDiagnostics = document?.diagnostics ?? [];
  const hasDiagnostics = docDiagnostics.length > 0 || rewrite !== undefined;

  if (!hasDiagnostics) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyLabel}>No diagnostics</p>
        <p className={styles.emptyHint}>
          Document quality signals, export overflow warnings, and AI rewrite results will appear
          here.
        </p>
      </div>
    );
  }

  const errors = docDiagnostics.filter((d) => d.severity === "error");
  const warnings = docDiagnostics.filter((d) => d.severity === "warning");
  const infos = docDiagnostics.filter((d) => d.severity === "info");

  return (
    <div className={styles.panelBody}>
      {/* AI rewrite status */}
      {rewrite && (
        <div className={styles.panelBlock}>
          <p className={styles.blockLabel}>AI Rewrite</p>
          <div className={styles.rewriteStatus}>
            <span
              className={styles.rewriteBadge}
              data-status={rewrite.status}
            >
              {rewrite.status}
            </span>
            {rewrite.model && (
              <span className={styles.rewriteMeta}>{rewrite.model}</span>
            )}
          </div>
          {rewrite.diagnostics?.length > 0 && (
            <ul className={styles.diagList}>
              {rewrite.diagnostics.map((d, i) => (
                <li className={styles.diagItem} data-severity={d.severity} key={i}>
                  {d.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Document diagnostics by severity */}
      {[
        { items: errors, label: "Errors" },
        { items: warnings, label: "Warnings" },
        { items: infos, label: "Info" },
      ].map(({ items, label }) =>
        items.length > 0 ? (
          <div className={styles.panelBlock} key={label}>
            <p className={styles.blockLabel}>{label}</p>
            <ul className={styles.diagList}>
              {items.map((d, i) => (
                <li
                  className={styles.diagItem}
                  data-severity={d.severity}
                  key={i}
                  title={d.code}
                >
                  {d.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}

      {docDiagnostics.length === 0 && (
        <div className={styles.panelBlock}>
          <p className={styles.emptyHint}>No document diagnostics.</p>
        </div>
      )}
    </div>
  );
}

export { SEVERITY_LABELS };
