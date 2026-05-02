"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Fragment,
  startTransition,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { useToast } from "@/components/common/ToastContext";
import type { Evaluation, Opportunity, OpportunityStatus } from "@/lib/types";

import styles from "./CompareWorkspace.module.css";

interface CompareEntry {
  evaluation: Evaluation | null;
  opportunity: Opportunity;
}

interface CompareWorkspaceProps {
  initialEntries: CompareEntry[];
  opportunities: Opportunity[];
}

interface BadgeWinner {
  id: string;
  label: string;
}

type SignalTone = "positive" | "warning" | "critical";
type WinnerLabel = "Best fit" | "Best pay" | "Stable" | "Momentum" | "Candidate";

const STATUS_ORDER: Record<OpportunityStatus, number> = {
  Unknown: 0,
  Evaluated: 1,
  Applied: 2,
  Responded: 3,
  Interview: 4,
  Offer: 5,
  Rejected: 0,
  Discarded: 0,
  SKIP: 0,
};

function buildComparisonUrl(pathname: string, ids: string[]) {
  if (!ids.length) {
    return pathname;
  }

  return `${pathname}?ids=${ids.join(",")}`;
}

function formatScoreRaw(opportunity: Opportunity) {
  return typeof opportunity.score === "number"
    ? String(Math.round(opportunity.score * 20))
    : opportunity.scoreRaw || "N/A";
}

function extractCompensationPeak(value: string | null) {
  if (!value) {
    return null;
  }

  const matches = [...value.matchAll(/(\d+(?:,\d{3})*(?:\.\d+)?)(k)?/gi)];
  if (!matches.length) {
    return null;
  }

  return matches.reduce<number>((highest, match) => {
    const base = Number(match[1].replaceAll(",", ""));
    const normalized = match[2] ? base * 1000 : base;
    return normalized > highest ? normalized : highest;
  }, 0);
}

function summarizeStrategy(evaluation: Evaluation | null) {
  if (!evaluation?.seniorityStrategy) {
    return "Strategy signal pending.";
  }

  return evaluation.seniorityStrategy
    .replace(/\|.*\|/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeLocation(entry: CompareEntry) {
  return entry.opportunity.remote ?? "Location pending";
}

function splitCompensation(value: string | null) {
  if (!value) {
    return {
      primary: "No comp signal",
      details: [] as string[],
    };
  }

  const parts = value
    .split(/\s+\+\s+|\s*[|;]\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    primary: parts[0] ?? value,
    details: parts.slice(1, 3),
  };
}

function getTopGap(evaluation: Evaluation | null) {
  if (!evaluation?.gapItems.length) {
    return null;
  }

  const severityOrder: Record<"critical" | "moderate" | "minor", number> = {
    critical: 3,
    moderate: 2,
    minor: 1,
  };

  return [...evaluation.gapItems].sort(
    (left, right) => severityOrder[right.severity] - severityOrder[left.severity],
  )[0];
}

function buildAlignmentSignals(entry: CompareEntry) {
  const evaluation = entry.evaluation;
  if (!evaluation) {
    return [];
  }

  const positiveSignals = evaluation.cvMatchItems.slice(0, 2).map((item) => ({
    label: item.requirement,
    tone: "positive" as SignalTone,
  }));

  const topGap = getTopGap(evaluation);
  const cautionSignal = topGap
    ? {
        label: topGap.gap,
        tone: topGap.severity === "critical" ? "critical" : "warning",
      }
    : null;

  return cautionSignal ? [...positiveSignals, cautionSignal] : positiveSignals;
}

function rankForNextMove(entry: CompareEntry) {
  let rank = entry.opportunity.score ?? 0;
  rank += STATUS_ORDER[entry.opportunity.status] * 0.65;

  if (entry.evaluation?.cvMatchItems.length) {
    rank += Math.min(entry.evaluation.cvMatchItems.length / 4, 1);
  }

  if (entry.evaluation?.gapItems.length) {
    rank -= Math.min(entry.evaluation.gapItems.length / 5, 1.25);
  }

  return rank;
}

function getNextStep(entry: CompareEntry) {
  const { company } = entry.opportunity;

  if (entry.opportunity.status === "Offer") {
    return `Pressure-test the ${company} offer terms and decide whether to negotiate or close.`;
  }

  if (entry.opportunity.status === "Interview") {
    return `${company} is live — prep stories, sharpen proof points, and treat this as the current priority.`;
  }

  if (
    entry.opportunity.status === "Applied" ||
    entry.opportunity.status === "Responded"
  ) {
    return `${company} is in progress — follow up with deliberate timing and a tighter research brief.`;
  }

  if ((entry.opportunity.score ?? 0) >= 4) {
    return `High fit — tailor the resume and make ${company} the first outbound push in this batch.`;
  }

  if ((entry.evaluation?.gapItems.length ?? 0) >= 3) {
    return `Only keep ${company} in play if the upside justifies a focused upskilling sprint.`;
  }

  return `Treat ${company} as a secondary option while higher-fit roles move through the funnel.`;
}

function getStatusAccent(status: OpportunityStatus) {
  switch (status) {
    case "Offer":
      return "offer";
    case "Interview":
      return "interview";
    case "Evaluated":
      return "evaluated";
    case "Applied":
    case "Responded":
      return "active";
    case "Rejected":
    case "Discarded":
    case "SKIP":
      return "inactive";
    default:
      return "neutral";
  }
}

function getBadgeWinners(entries: CompareEntry[]) {
  const winners: BadgeWinner[] = [];

  const byScore = [...entries]
    .filter((entry) => typeof entry.opportunity.score === "number")
    .sort((left, right) => (right.opportunity.score ?? 0) - (left.opportunity.score ?? 0))[0];
  if (byScore) {
    winners.push({ id: byScore.opportunity.id, label: "Best fit" });
  }

  const byComp = [...entries]
    .map((entry) => ({
      id: entry.opportunity.id,
      peak: extractCompensationPeak(entry.opportunity.compensation),
    }))
    .filter((entry): entry is { id: string; peak: number } => entry.peak !== null)
    .sort((left, right) => right.peak - left.peak)[0];
  if (byComp) {
    winners.push({ id: byComp.id, label: "Best pay" });
  }

  const byMomentum = [...entries].sort(
    (left, right) =>
      STATUS_ORDER[right.opportunity.status] - STATUS_ORDER[left.opportunity.status],
  )[0];
  if (byMomentum) {
    winners.push({ id: byMomentum.opportunity.id, label: "Momentum" });
  }

  const byStability = [...entries].sort(
    (left, right) =>
      (left.evaluation?.gapItems.length ?? 99) - (right.evaluation?.gapItems.length ?? 99),
  )[0];
  if (byStability) {
    winners.push({ id: byStability.opportunity.id, label: "Stable" });
  }

  return winners;
}

function getPrimaryWinnerLabel(badges: string[]): WinnerLabel {
  if (badges.includes("Best fit")) {
    return "Best fit";
  }

  if (badges.includes("Best pay")) {
    return "Best pay";
  }

  if (badges.includes("Stable")) {
    return "Stable";
  }

  if (badges.includes("Momentum")) {
    return "Momentum";
  }

  return "Candidate";
}

function formatCurrencyLead(entry: CompareEntry | null | undefined) {
  if (!entry?.opportunity.compensation) {
    return "No clear comp signal";
  }

  return splitCompensation(entry.opportunity.compensation).primary;
}

function getRiskNarrative(entry: CompareEntry) {
  if (!entry.evaluation) {
    return "Report pending. Risk cannot be assessed until the evaluation data finishes loading.";
  }

  const topGap = getTopGap(entry.evaluation);
  if (!topGap) {
    return "Low immediate risk. Core requirements already overlap with the current profile and no major blockers stand out.";
  }

  const severityLead =
    topGap.severity === "critical"
      ? "High execution risk."
      : topGap.severity === "moderate"
        ? "Moderate execution risk."
        : "Low immediate risk.";

  return `${severityLead} ${topGap.gap}. ${topGap.mitigation}`;
}

export default function CompareWorkspace({
  initialEntries,
  opportunities,
}: CompareWorkspaceProps) {
  const notify = useToast();
  const pathname = usePathname();
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState(
    initialEntries.map((entry) => entry.opportunity.id),
  );
  const [entriesById, setEntriesById] = useState<Record<string, CompareEntry>>(
    Object.fromEntries(initialEntries.map((entry) => [entry.opportunity.id, entry])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);

  const selectedEntries = selectedIds
    .map((id) => entriesById[id])
    .filter((entry): entry is CompareEntry => Boolean(entry));

  const badgeWinners = getBadgeWinners(selectedEntries);
  const nextMoveQueue = [...selectedEntries].sort(
    (left, right) => rankForNextMove(right) - rankForNextMove(left),
  );
  const leadEntry = nextMoveQueue[0] ?? null;

  const bestScoreEntry = selectedEntries.find(
    (entry) =>
      entry.opportunity.id === badgeWinners.find((badge) => badge.label === "Best fit")?.id,
  );
  const bestPayEntry = selectedEntries.find(
    (entry) =>
      entry.opportunity.id === badgeWinners.find((badge) => badge.label === "Best pay")?.id,
  );
  const stabilityEntry = selectedEntries.find(
    (entry) =>
      entry.opportunity.id === badgeWinners.find((badge) => badge.label === "Stable")?.id,
  );
  const criticalVulnerability =
    selectedEntries.flatMap((entry) =>
      (entry.evaluation?.gapItems ?? [])
        .filter((gap) => gap.severity === "critical")
        .map((gap) => ({ entry, gap })),
    )[0] ?? null;

  async function ensureEntry(id: string) {
    if (entriesById[id]) {
      return entriesById[id];
    }

    setPendingId(id);

    try {
      const response = await fetch(`/api/opportunities/${id}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load comparison details.");
      }

      const payload = (await response.json()) as CompareEntry;
      setEntriesById((current) => ({ ...current, [id]: payload }));
      return payload;
    } finally {
      setPendingId((current) => (current === id ? null : current));
    }
  }

  async function toggleSelection(id: string) {
    const alreadySelected = selectedIds.includes(id);

    if (alreadySelected) {
      const nextIds = selectedIds.filter((entryId) => entryId !== id);
      setSelectedIds(nextIds);
      startTransition(() => {
        router.replace(buildComparisonUrl(pathname, nextIds), { scroll: false });
      });
      return;
    }

    if (selectedIds.length >= 5) {
      notify({
        title: "Comparison caps at five roles",
        description:
          "Remove one of the current selections before adding another role.",
        dismissAfter: 4000,
      });
      return;
    }

    try {
      await ensureEntry(id);
      const nextIds = [...selectedIds, id];
      setSelectedIds(nextIds);
      startTransition(() => {
        router.replace(buildComparisonUrl(pathname, nextIds), { scroll: false });
      });
    } catch {
      notify({
        title: "Could not load that role",
        description:
          "The comparison board could not load the selected role.",
      });
    }
  }

  const matrixStyle: CSSProperties = {
    gridTemplateColumns: `10rem repeat(${Math.max(selectedEntries.length, 1)}, 1fr)`,
  };

  const comparisonRows: Array<{
    label: string;
    render: (entry: CompareEntry) => ReactNode;
  }> = [
    {
      label: "Score",
      render: (entry) => {
        const raw =
          typeof entry.opportunity.score === "number"
            ? String(Math.round(entry.opportunity.score * 20))
            : entry.opportunity.scoreRaw ?? null;

        return (
          <div className={styles.scoreDisplay}>
            <span className={styles.scoreNum}>{raw ?? "N/A"}</span>
            {raw !== null ? <span className={styles.scoreUnit}>/100</span> : null}
          </div>
        );
      },
    },
    {
      label: "CV Alignment",
      render: (entry) => {
        const signals = buildAlignmentSignals(entry);

        if (!signals.length) {
          return <span className={styles.pendingText}>Report pending</span>;
        }

        return (
          <div className={styles.alignmentList}>
            {signals.map((signal) => (
              <div
                className={styles.alignmentItem}
                data-tone={signal.tone}
                key={`${entry.opportunity.id}-${signal.label}`}
              >
                <span className={styles.alignmentText}>{signal.label}</span>
                <span className={styles.alignmentMark} aria-hidden="true">
                  {signal.tone === "positive" ? "✓" : "×"}
                </span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      label: "Compensation",
      render: (entry) => {
        const compensation = splitCompensation(entry.opportunity.compensation);

        return (
          <div className={styles.compStack}>
            <span className={styles.compPrimary}>{compensation.primary}</span>
            {compensation.details.length ? (
              <div className={styles.compDetails}>
                {compensation.details.map((detail) => (
                  <span className={styles.compDetail} key={detail}>
                    {detail}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      label: "Risk",
      render: (entry) => (
        <p className={styles.riskCopy}>{getRiskNarrative(entry)}</p>
      ),
    },
    {
      label: "Next Action",
      render: (entry) => (
        <p className={styles.nextActionCopy}>{getNextStep(entry)}</p>
      ),
    },
  ];

  return (
    <section className={styles.workspace}>
      <section className={styles.selectionPanel}>
        <div className={styles.selectionHead}>
          <div>
            <p className={styles.selectionLabel}>Role Selector</p>
            <h2>Choose up to five scored roles, then read the board below.</h2>
          </div>
          <p className={styles.selectionCount}>
            {selectedEntries.length} of 5 selected
            {pendingId ? " — loading…" : ""}
          </p>
        </div>

        <div className={styles.selectionMeta}>
          <span className={styles.selectionMetaItem}>
            Best fit: {bestScoreEntry?.opportunity.role ?? "Awaiting signal"}
          </span>
          <span className={styles.selectionMetaItem}>
            Best pay: {formatCurrencyLead(bestPayEntry)}
          </span>
          <span className={styles.selectionMetaItem}>
            Lowest risk: {stabilityEntry?.opportunity.company ?? "Awaiting signal"}
          </span>
        </div>

        <div className={styles.selectorGrid}>
          {opportunities.map((opportunity) => {
            const isSelected = selectedIds.includes(opportunity.id);
            const cardBadges = badgeWinners
              .filter((b) => b.id === opportunity.id)
              .map((b) => b.label);
            const primaryBadge = isSelected && cardBadges.length > 0
              ? cardBadges[0]
              : null;

            return (
              <button
                aria-pressed={isSelected}
                className={styles.selectorCard}
                data-selected={isSelected}
                disabled={pendingId === opportunity.id}
                key={opportunity.id}
                onClick={() => void toggleSelection(opportunity.id)}
                type="button"
              >
                {primaryBadge ? (
                  <span className={styles.selectorBadge}>{primaryBadge}</span>
                ) : null}
                <span className={styles.selectorMeta}>
                  {opportunity.status} · {formatScoreRaw(opportunity)}
                </span>
                <div className={styles.selectorBody}>
                  <strong className={styles.selectorTitle}>{opportunity.role}</strong>
                  <p className={styles.selectorSubline}>
                    {opportunity.company}
                    {opportunity.archetype ? ` · ${opportunity.archetype}` : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selectedEntries.length >= 2 ? (
        <section className={styles.boardFrame}>
          <div className={styles.boardScroller}>
            <div className={styles.matrix} style={matrixStyle}>
              <div className={`${styles.matrixCell} ${styles.matrixIntro}`}>
                <h2>Comparison</h2>
                <p>
                  Shared criteria across all selected roles.
                </p>
              </div>

              {selectedEntries.map((entry, colIdx) => {
                const badges = badgeWinners
                  .filter((badge) => badge.id === entry.opportunity.id)
                  .map((badge) => badge.label);
                const primaryBadge = getPrimaryWinnerLabel(badges);
                const idTag = `ID: ${String(entry.opportunity.id).slice(-3).toUpperCase().padStart(3, "0")}`;

                return (
                  <div
                    className={`${styles.matrixCell} ${styles.recordHead}`}
                    data-highlight={colIdx === 0 ? "best-fit" : undefined}
                    key={entry.opportunity.id}
                  >
                    <div className={styles.recordPills}>
                      <span
                        className={styles.statusPill}
                        data-state={getStatusAccent(entry.opportunity.status)}
                      >
                        {entry.opportunity.status}
                      </span>
                      <span className={styles.idTag}>{idTag}</span>
                    </div>

                    <div className={styles.recordHeadline}>
                      <h3>{entry.opportunity.role}</h3>
                      <p className={styles.recordCompany}>{entry.opportunity.company}</p>
                    </div>

                    <div className={styles.recordActions}>
                      <Link
                        className={styles.recordLink}
                        href={`/pipeline/${entry.opportunity.id}`}
                      >
                        Detail
                      </Link>
                      {entry.opportunity.status !== "Rejected" &&
                        entry.opportunity.status !== "Discarded" &&
                        entry.opportunity.status !== "SKIP" ? (
                        <Link
                          className={`${styles.recordLink} ${styles.recordLinkAccent}`}
                          href={`/pipeline/${entry.opportunity.id}/apply`}
                        >
                          Apply
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {comparisonRows.map((row) => (
                <Fragment key={row.label}>
                  <div className={`${styles.matrixCell} ${styles.criteriaCell}`}>
                    <span className={styles.criteriaLabel}>{row.label}</span>
                  </div>
                  {selectedEntries.map((entry) => (
                    <div
                      className={`${styles.matrixCell} ${styles.valueCell}`}
                      key={`${row.label}-${entry.opportunity.id}`}
                    >
                      {row.render(entry)}
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>

          <div className={styles.boardUtilityRow}>
            <Link className={styles.boardLink} href="/pipeline">
              Open Pipeline
            </Link>
            <Link className={`${styles.boardLink} ${styles.boardLinkAccent}`} href="/resumes">
              Tailor Resume
            </Link>
          </div>

          <div className={styles.insightGrid}>
            <section className={styles.insightCard}>
              <div className={styles.insightHead}>
                <p className={styles.insightLabel}>Decision Brief</p>
              </div>

              {leadEntry ? (
                <div className={styles.recommendedFocus}>
                  <p className={styles.recommendedFocusLabel}>Recommended focus</p>
                  <p className={styles.recommendedFocusRole}>
                    {leadEntry.opportunity.company} — {leadEntry.opportunity.role}
                  </p>
                  <p className={styles.analysisBody}>{getNextStep(leadEntry)}</p>
                </div>
              ) : null}

              <div className={styles.analysisBlock}>
                <p className={styles.analysisLabel}>Trajectory signal</p>
                <p className={styles.analysisBody}>
                  {leadEntry
                    ? summarizeStrategy(leadEntry.evaluation)
                    : "Select roles to generate a directional signal."}
                </p>
              </div>

              {criticalVulnerability ? (
                <div className={styles.analysisBlock}>
                  <p className={styles.analysisLabel} data-tone="critical">Critical gap</p>
                  <p className={styles.analysisBody}>
                    {criticalVulnerability.entry.opportunity.company}: {criticalVulnerability.gap.gap}. {criticalVulnerability.gap.mitigation}
                  </p>
                </div>
              ) : null}
            </section>

            <section className={styles.insightCard}>
              <div className={styles.insightHead}>
                <p className={styles.insightLabel}>Recommended Moves</p>
              </div>

              <ol className={styles.moveList}>
                {nextMoveQueue.map((entry, index) => (
                  <li className={styles.moveItem} key={entry.opportunity.id}>
                    <span className={styles.moveRank}>{index + 1}</span>
                    <div className={styles.moveBody}>
                      <p className={styles.moveRole}>
                        {entry.opportunity.company}
                        <span className={styles.moveRoleTitle}> — {entry.opportunity.role}</span>
                      </p>
                      <p className={styles.moveAction}>{getNextStep(entry)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </section>
      ) : (
        <section className={styles.emptyState}>
          <p className={styles.selectionLabel}>Choose roles to compare</p>
          <h2>Select at least two scored opportunities to activate the board.</h2>
          <p>
            Start from the shortlist console above, then use the board to decide
            what deserves the next move.
          </p>
          <Link className={styles.boardLink} href="/pipeline">
            Return to pipeline
          </Link>
        </section>
      )}
    </section>
  );
}
