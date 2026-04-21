"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useState, type CSSProperties, Fragment } from "react";

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

function formatScore(opportunity: Opportunity) {
  return typeof opportunity.score === "number"
    ? opportunity.score.toFixed(1)
    : opportunity.scoreRaw || "N/A";
}

function summarizeCompensation(value: string | null) {
  return value || "No comp signal";
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

function summarizeKeywords(evaluation: Evaluation | null) {
  if (!evaluation?.keywords.length) {
    return "Keywords unavailable";
  }

  return evaluation.keywords.slice(0, 6).join(" · ");
}

function summarizeStrategy(evaluation: Evaluation | null) {
  if (!evaluation?.seniorityStrategy) {
    return "Strategy details pending";
  }

  return evaluation.seniorityStrategy
    .replace(/\|.*\|/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeNextContext(entry: CompareEntry) {
  return (
    entry.opportunity.summary ||
    entry.opportunity.notes ||
    entry.evaluation?.summary ||
    "No note captured yet."
  );
}

function summarizeLocation(entry: CompareEntry) {
  return entry.opportunity.remote || "Location pending";
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
  if (entry.opportunity.status === "Offer") {
    return "Decide whether to take the offer or negotiate.";
  }

  if (entry.opportunity.status === "Interview") {
    return "Prep stories and tighten the interview narrative.";
  }

  if (entry.opportunity.status === "Applied" || entry.opportunity.status === "Responded") {
    return "Keep this warm with follow-up timing and research.";
  }

  if ((entry.opportunity.score ?? 0) >= 4) {
    return "Tailor the resume and prepare a focused application push.";
  }

  if ((entry.evaluation?.gapItems.length ?? 0) >= 3) {
    return "Only pursue this if the upside is worth closing the gaps.";
  }

  return "Keep this as a secondary option while higher-fit roles move first.";
}

function getBadgeWinners(entries: CompareEntry[]) {
  const winners: BadgeWinner[] = [];

  const byScore = [...entries]
    .filter((entry) => typeof entry.opportunity.score === "number")
    .sort((left, right) => (right.opportunity.score ?? 0) - (left.opportunity.score ?? 0))[0];

  if (byScore) {
    winners.push({ id: byScore.opportunity.id, label: "Best fit" });
  }

  const byCompensation = [...entries]
    .map((entry) => ({
      id: entry.opportunity.id,
      peak: extractCompensationPeak(entry.opportunity.compensation),
    }))
    .filter((entry): entry is { id: string; peak: number } => entry.peak !== null)
    .sort((left, right) => right.peak - left.peak)[0];

  if (byCompensation) {
    winners.push({ id: byCompensation.id, label: "Best pay" });
  }

  const byStretch = [...entries]
    .map((entry) => ({
      id: entry.opportunity.id,
      gapCount: entry.evaluation?.gapItems.length ?? -1,
      score: entry.opportunity.score ?? 0,
    }))
    .filter((entry) => entry.gapCount >= 0 && entry.score >= 3)
    .sort((left, right) => {
      if (right.gapCount !== left.gapCount) {
        return right.gapCount - left.gapCount;
      }

      return right.score - left.score;
    })[0];

  if (byStretch) {
    winners.push({ id: byStretch.id, label: "Stretch pick" });
  }

  const byProcess = [...entries]
    .sort(
      (left, right) =>
        STATUS_ORDER[right.opportunity.status] - STATUS_ORDER[left.opportunity.status],
    )[0];

  if (byProcess) {
    winners.push({ id: byProcess.opportunity.id, label: "Furthest along" });
  }

  return winners;
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
    Object.fromEntries(
      initialEntries.map((entry) => [entry.opportunity.id, entry]),
    ),
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
  const totalGapCount = selectedEntries.reduce(
    (total, entry) => total + (entry.evaluation?.gapItems.length ?? 0),
    0,
  );
  const comparedCompensation = selectedEntries.filter((entry) => entry.opportunity.compensation);

  async function ensureEntry(id: string) {
    if (entriesById[id]) {
      return entriesById[id];
    }

    setPendingId(id);

    try {
      const response = await fetch(`/api/opportunities/${id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Could not load comparison details.");
      }

      const payload = (await response.json()) as CompareEntry;
      setEntriesById((current) => ({
        ...current,
        [id]: payload,
      }));

      return payload;
    } finally {
      setPendingId((current) => (current === id ? null : current));
    }
  }

  async function toggleSelection(id: string) {
    const alreadySelected = selectedIds.includes(id);

    if (alreadySelected) {
      const nextIds = selectedIds.filter((entry) => entry !== id);
      setSelectedIds(nextIds);
      startTransition(() => {
        router.replace(buildComparisonUrl(pathname, nextIds), {
          scroll: false,
        });
      });
      return;
    }

    if (selectedIds.length >= 5) {
      notify({
        title: "Comparison caps at five roles",
        description:
          "Remove one of the current selections before adding another role to the board.",
        dismissAfter: 4000,
      });
      return;
    }

    try {
      await ensureEntry(id);
      const nextIds = [...selectedIds, id];
      setSelectedIds(nextIds);
      startTransition(() => {
        router.replace(buildComparisonUrl(pathname, nextIds), {
          scroll: false,
        });
      });
    } catch {
      notify({
        title: "Could not load that role",
        description:
          "The comparison board could not load the selected role details.",
      });
    }
  }

  const matrixStyle: CSSProperties = {
    gridTemplateColumns: `minmax(12rem, 13rem) repeat(${Math.max(selectedEntries.length, 1)}, minmax(16rem, 18rem))`,
  };

  const comparisonGroups = [
    {
      label: "Core fit",
      description: "How naturally the role fits the current search thesis.",
      rows: [
        {
          label: "Overall fit",
          render: (entry: CompareEntry) => (
            <strong className={`${styles.metricValue} tabular-nums`}>
              {formatScore(entry.opportunity)}
            </strong>
          ),
        },
        {
          label: "Status",
          render: (entry: CompareEntry) => entry.opportunity.status,
        },
        {
          label: "Archetype",
          render: (entry: CompareEntry) =>
            entry.opportunity.archetype ?? "Pending report detail",
        },
        {
          label: "Candidate level",
          render: (entry: CompareEntry) =>
            entry.evaluation?.candidateLevel ?? "Unavailable",
        },
        {
          label: "Detected level",
          render: (entry: CompareEntry) =>
            entry.evaluation?.detectedLevel ?? "Unavailable",
        },
      ],
    },
    {
      label: "Role conditions",
      description: "The practical shape of the job and the tradeoffs it brings.",
      rows: [
        {
          label: "Remote signal",
          render: (entry: CompareEntry) => entry.opportunity.remote ?? "No signal yet",
        },
        {
          label: "Compensation",
          render: (entry: CompareEntry) =>
            summarizeCompensation(entry.opportunity.compensation),
        },
        {
          label: "Keywords",
          render: (entry: CompareEntry) => summarizeKeywords(entry.evaluation),
        },
      ],
    },
    {
      label: "Evidence stack",
      description: "What the parsed report gives you to work with right now.",
      rows: [
        {
          label: "CV alignment",
          render: (entry: CompareEntry) =>
            entry.evaluation
              ? `${entry.evaluation.cvMatchItems.length} matched rows`
              : "Report pending",
        },
        {
          label: "Gap count",
          render: (entry: CompareEntry) =>
            entry.evaluation
              ? `${entry.evaluation.gapItems.length} gaps`
              : "Report pending",
        },
        {
          label: "Interview stories",
          render: (entry: CompareEntry) =>
            entry.evaluation
              ? `${entry.evaluation.interviewItems.length} stories`
              : "Report pending",
        },
      ],
    },
    {
      label: "Decision read",
      description: "The operating view: what to do next and why.",
      rows: [
        {
          label: "Strategy",
          render: (entry: CompareEntry) => summarizeStrategy(entry.evaluation),
        },
        {
          label: "Current note",
          render: (entry: CompareEntry) => summarizeNextContext(entry),
        },
      ],
    },
  ];

  return (
    <section className={styles.workspace}>
      <section className={styles.selectionDock}>
        <div className={styles.selectionHeader}>
          <div>
            <p className="section-label">Role set</p>
            <h2>Pick the shortlist, then read the matrix below.</h2>
          </div>
          <p className={styles.selectionMeta}>{selectedEntries.length} selected</p>
        </div>

        <div className={styles.contextStrip}>
          <span>{selectedEntries.length} roles in play</span>
          {badgeWinners.find((badge) => badge.label === "Best fit") ? (
            <span>
              Best fit:{" "}
              {selectedEntries.find(
                (entry) =>
                  entry.opportunity.id ===
                  badgeWinners.find((badge) => badge.label === "Best fit")?.id,
              )?.opportunity.company ?? "Unavailable"}
            </span>
          ) : null}
          {badgeWinners.find((badge) => badge.label === "Furthest along") ? (
            <span>
              Furthest along:{" "}
              {selectedEntries.find(
                (entry) =>
                  entry.opportunity.id ===
                  badgeWinners.find((badge) => badge.label === "Furthest along")?.id,
              )?.opportunity.company ?? "Unavailable"}
            </span>
          ) : null}
        </div>

        <div className={styles.selectorGrid}>
          {opportunities.map((opportunity) => {
            const isSelected = selectedIds.includes(opportunity.id);

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
                <div className={styles.selectorTop}>
                  <strong>
                    {opportunity.company} · {opportunity.role}
                  </strong>
                  <span className={styles.selectorScore}>
                    {formatScore(opportunity)}
                  </span>
                </div>
                <p>
                  {opportunity.status}
                  {opportunity.archetype ? ` · ${opportunity.archetype}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {selectedEntries.length >= 2 ? (
        <section className={styles.boardFrame}>
          <div className={styles.boardTop}>
            <div className={styles.boardHead}>
              <p className="section-label">Comparison matrix</p>
              <h2>Decision matrix</h2>
              <p>
                Hold the criteria fixed, scan the strongest signals, and decide
                which role earns the next move.
              </p>
            </div>

            <div className={styles.boardActions}>
              <Link href="/pipeline">Open pipeline</Link>
              <Link href="/resumes">Tailor resume</Link>
            </div>
          </div>

          <div className={styles.boardScroller}>
            <div className={styles.matrix} style={matrixStyle}>
              <div className={`${styles.matrixCell} ${styles.matrixIntro}`}>
                <p className="section-label">Criteria</p>
                <h2>Decision lens</h2>
                <p>
                  Compare the signals that change whether a role is worth
                  advancing.
                </p>
              </div>

              {selectedEntries.map((entry) => {
                const badges = badgeWinners
                  .filter((badge) => badge.id === entry.opportunity.id)
                  .map((badge) => badge.label);

                return (
                  <div className={`${styles.matrixCell} ${styles.recordHead}`} key={entry.opportunity.id}>
                    <div className={styles.recordMeta}>
                      <span className={styles.recordScore}>{formatScore(entry.opportunity)}</span>
                      <span className={styles.recordStatus}>{entry.opportunity.status}</span>
                    </div>

                    <div className={styles.recordTitle}>
                      <strong>
                        {entry.opportunity.company} · {entry.opportunity.role}
                      </strong>
                      <p>{entry.opportunity.date}</p>
                    </div>

                    <div className={styles.recordTags}>
                      <span>{summarizeLocation(entry)}</span>
                      {entry.opportunity.archetype ? (
                        <span>{entry.opportunity.archetype}</span>
                      ) : null}
                    </div>

                    {badges.length ? (
                      <div className={styles.badgeStack}>
                        {badges.map((badge) => (
                          <span
                            className={styles.badge}
                            data-kind={badge.toLowerCase().replace(/\s+/g, "-")}
                            key={badge}
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <Link href={`/pipeline/${entry.opportunity.id}`}>
                      Open full record
                    </Link>
                  </div>
                );
              })}

              {comparisonGroups.map((group) => (
                <Fragment key={group.label}>
                  <div className={`${styles.matrixCell} ${styles.groupIntroCell}`}>
                    <p className={styles.groupLabel}>{group.label}</p>
                    <p>{group.description}</p>
                  </div>
                  <div
                    className={`${styles.matrixCell} ${styles.groupBand}`}
                    style={{ gridColumn: `span ${selectedEntries.length}` }}
                  >
                    {group.description}
                  </div>

                  {group.rows.map((row) => (
                    <Fragment key={`${group.label}-${row.label}`}>
                      <div className={`${styles.matrixCell} ${styles.criteriaCell}`}>
                        {row.label}
                      </div>
                      {selectedEntries.map((entry) => (
                        <div
                          className={`${styles.matrixCell} ${styles.valueCell}`}
                          key={`${group.label}-${row.label}-${entry.opportunity.id}`}
                        >
                          {row.render(entry)}
                        </div>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>

          <div className={styles.insightGrid}>
            <section className={styles.insightCard}>
              <p className="section-label">Recommended next move</p>
              {leadEntry ? (
                <>
                  <h3>
                    {leadEntry.opportunity.company} · {leadEntry.opportunity.role}
                  </h3>
                  <p>{getNextStep(leadEntry)}</p>
                  <Link href={`/pipeline/${leadEntry.opportunity.id}`}>
                    Open full record
                  </Link>
                </>
              ) : null}
            </section>

            <section className={styles.insightCard}>
              <p className="section-label">Comp and risk</p>
              <h3>
                {comparedCompensation.length
                  ? `${comparedCompensation.length} roles expose real comp data`
                  : "Compensation is still fuzzy across this set"}
              </h3>
              <p>
                Total reported gap count across this selection:{" "}
                <strong>{totalGapCount}</strong>
              </p>
            </section>

            <section className={styles.insightCard}>
              <p className="section-label">Action queue</p>
              <ol className={styles.actionList}>
                {nextMoveQueue.slice(0, 3).map((entry, index) => (
                  <li key={entry.opportunity.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>
                        {entry.opportunity.company} · {entry.opportunity.role}
                      </strong>
                      <p>{getNextStep(entry)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </section>
      ) : (
        <section className="empty-state">
          <p className="section-label">Choose roles to compare</p>
          <h2>Select at least two scored opportunities to activate the board.</h2>
          <p>
            Start from the selector above or jump back to the pipeline and send
            a small batch over in one move.
          </p>
          <p>
            <Link href="/pipeline">Return to pipeline</Link>
          </p>
        </section>
      )}
    </section>
  );
}
