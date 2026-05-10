"use client";

import type { ResumeStrategy } from "@/lib/types";

import styles from "./ResumeRightRail.module.css";

interface Props {
  strategy: ResumeStrategy | undefined;
}

const JOB_FAMILY_LABELS: Record<string, string> = {
  "software": "Software",
  "data/analytics": "Data / Analytics",
  "IT/support": "IT / Support",
  "product/design": "Product / Design",
  "finance": "Finance",
  "teaching": "Teaching",
  "healthcare/medical": "Healthcare",
  "operations/admin": "Operations",
  "general": "General",
};

export function ResumeStrategyPanel({ strategy }: Props) {
  if (!strategy) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyLabel}>No strategy yet</p>
        <p className={styles.emptyHint}>
          Generate a draft to see the AI strategy — job family, narrative angle, and recommended
          section order.
        </p>
      </div>
    );
  }

  const sectionOrder = strategy.sectionOrder ?? [];
  const keywords = (strategy.keywordPlan ?? []).slice(0, 10);
  const warnings = strategy.warnings ?? [];
  const familyLabel = JOB_FAMILY_LABELS[strategy.jobFamily] ?? strategy.jobFamily;

  return (
    <div className={styles.panelBody}>
      {/* Job family + narrative angle */}
      <div className={styles.panelBlock}>
        <p className={styles.blockLabel}>Job Family</p>
        <span className={styles.familyBadge}>{familyLabel}</span>
      </div>

      {strategy.narrativeAngle && (
        <div className={styles.panelBlock}>
          <p className={styles.blockLabel}>Narrative Angle</p>
          <p className={styles.narrativeText}>{strategy.narrativeAngle}</p>
        </div>
      )}

      {/* Section order */}
      {sectionOrder.length > 0 && (
        <div className={styles.panelBlock}>
          <p className={styles.blockLabel}>Section Order</p>
          <ol className={styles.sectionOrderList}>
            {sectionOrder.map((sectionType) => {
              const policy = strategy.sectionPolicies?.[sectionType];
              const label = policy?.label ?? sectionType;
              const enabled = policy?.enabled ?? true;
              return (
                <li
                  className={styles.sectionOrderItem}
                  data-disabled={!enabled}
                  key={sectionType}
                >
                  <span className={styles.sectionOrderLabel}>{label}</span>
                  {policy?.prominence === "primary" && (
                    <span className={styles.prominenceBadge}>primary</span>
                  )}
                  {!enabled && <span className={styles.disabledBadge}>hidden</span>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Keywords */}
      {keywords.length > 0 && (
        <div className={styles.panelBlock}>
          <p className={styles.blockLabel}>Keyword Plan</p>
          <div className={styles.keywordList}>
            {keywords.map((kw) => (
              <span className={styles.keywordChip} key={kw}>{kw}</span>
            ))}
          </div>
        </div>
      )}

      {/* Strategy warnings */}
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
    </div>
  );
}
