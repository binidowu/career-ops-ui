"use client";

import type { ResumeEvidenceDiagnostic, ResumeEvidenceSummary } from "@/lib/types";

import styles from "./ResumeRightRail.module.css";

interface Props {
  evidenceSummary: ResumeEvidenceSummary | undefined;
  evidenceDiagnostics?: ResumeEvidenceDiagnostic[];
}

export function ResumeEvidencePanel({ evidenceSummary, evidenceDiagnostics = [] }: Props) {
  if (!evidenceSummary) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyLabel}>No evidence data yet</p>
        <p className={styles.emptyHint}>
          Evidence is extracted from your resume source during draft generation.
        </p>
      </div>
    );
  }

  const { totalEvidenceItems, usedEvidenceItems, warnings } = evidenceSummary;
  const pct = totalEvidenceItems > 0
    ? Math.round((usedEvidenceItems / totalEvidenceItems) * 100)
    : 0;

  const errors = evidenceDiagnostics.filter((d) => d.severity === "error");
  const warningDiags = evidenceDiagnostics.filter((d) => d.severity === "warning");

  return (
    <div className={styles.panelBody}>
      {/* Usage meter */}
      <div className={styles.panelBlock}>
        <p className={styles.blockLabel}>Evidence Usage</p>
        <div className={styles.usageMeter}>
          <div
            className={styles.usageMeterFill}
            style={{ width: `${pct}%` }}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
        <p className={styles.usageText}>
          <strong>{usedEvidenceItems}</strong> of {totalEvidenceItems} evidence items used in this
          draft ({pct}%)
        </p>
      </div>

      {/* Backend warnings */}
      {warnings.length > 0 && (
        <div className={styles.panelBlock}>
          <p className={styles.blockLabel}>Warnings</p>
          <ul className={styles.warningList}>
            {warnings.map((w, i) => (
              <li className={styles.warningItem} key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Evidence diagnostics */}
      {errors.length > 0 && (
        <div className={styles.panelBlock}>
          <p className={styles.blockLabel}>Extraction Errors</p>
          <ul className={styles.diagList}>
            {errors.map((d, i) => (
              <li className={styles.diagItem} data-severity="error" key={i}>{d.message}</li>
            ))}
          </ul>
        </div>
      )}

      {warningDiags.length > 0 && (
        <div className={styles.panelBlock}>
          <p className={styles.blockLabel}>Extraction Warnings</p>
          <ul className={styles.diagList}>
            {warningDiags.map((d, i) => (
              <li className={styles.diagItem} data-severity="warning" key={i}>{d.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
