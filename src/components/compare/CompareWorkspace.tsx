"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useState } from "react";

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

  return evaluation.keywords.slice(0, 4).join(" · ");
}

function summarizeStrategy(evaluation: Evaluation | null) {
  if (!evaluation?.seniorityStrategy) {
    return "Strategy details pending";
  }

  return evaluation.seniorityStrategy.replace(/\s+/g, " ").trim();
}

function summarizeNextContext(entry: CompareEntry) {
  return (
    entry.opportunity.summary ||
    entry.opportunity.notes ||
    entry.evaluation?.summary ||
    "No note captured yet."
  );
}

function getBadgeWinners(entries: CompareEntry[]) {
  const winners: BadgeWinner[] = [];

  const byScore = [...entries]
    .filter((entry) => typeof entry.opportunity.score === "number")
    .sort((left, right) => (right.opportunity.score ?? 0) - (left.opportunity.score ?? 0))[0];

  if (byScore) {
    winners.push({ id: byScore.opportunity.id, label: "Best Fit" });
  }

  const byCompensation = [...entries]
    .map((entry) => ({
      id: entry.opportunity.id,
      peak: extractCompensationPeak(entry.opportunity.compensation),
    }))
    .filter((entry): entry is { id: string; peak: number } => entry.peak !== null)
    .sort((left, right) => right.peak - left.peak)[0];

  if (byCompensation) {
    winners.push({ id: byCompensation.id, label: "Best Pay" });
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
    winners.push({ id: byStretch.id, label: "Stretch Pick" });
  }

  const byProcess = [...entries]
    .sort(
      (left, right) =>
        STATUS_ORDER[right.opportunity.status] - STATUS_ORDER[left.opportunity.status],
    )[0];

  if (byProcess) {
    winners.push({ id: byProcess.opportunity.id, label: "Fastest Process" });
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
          "Remove one of the current selections before adding another dossier to the board.",
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
          "The comparison board could not fetch dossier details for the selected opportunity.",
      });
    }
  }

  return (
    <section className={styles.workspace}>
      <section className={styles.selectionDock}>
        <div className={styles.selectionHeader}>
          <div>
            <p className="section-label">Selection deck</p>
            <h2>Choose two to five scored roles to compare.</h2>
          </div>
          <p className={styles.selectionMeta}>
            {selectedEntries.length} selected
          </p>
        </div>

        <div className={styles.selectorGrid}>
          {opportunities.map((opportunity) => {
            const isSelected = selectedIds.includes(opportunity.id);

            return (
              <button
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
        <>
          <section className={styles.summaryRow}>
            <div className={styles.summaryCard}>
              <p className="section-label">Board state</p>
              <h2>{selectedEntries.length} roles in play</h2>
              <p>
                The comparison board is reading live tracker rows and report
                detail for the selections below.
              </p>
            </div>

            <div className={styles.summaryCard}>
              <p className="section-label">Highest fit</p>
              <h2>
                {badgeWinners.find((badge) => badge.label === "Best Fit")
                  ? selectedEntries.find(
                      (entry) =>
                        entry.opportunity.id ===
                        badgeWinners.find((badge) => badge.label === "Best Fit")?.id,
                    )?.opportunity.company
                  : "Unavailable"}
              </h2>
              <p>Strongest numerical fit among the currently selected roles.</p>
            </div>

            <div className={styles.summaryCard}>
              <p className="section-label">Furthest along</p>
              <h2>
                {badgeWinners.find((badge) => badge.label === "Fastest Process")
                  ? selectedEntries.find(
                      (entry) =>
                        entry.opportunity.id ===
                        badgeWinners.find((badge) => badge.label === "Fastest Process")?.id,
                    )?.opportunity.company
                  : "Unavailable"}
              </h2>
              <p>The role currently deepest in the application process.</p>
            </div>
          </section>

          <section className={styles.boardFrame}>
            <div className={styles.boardScroller}>
              <div className={styles.board}>
                <div className={`${styles.column} ${styles.labelColumn}`}>
                  <div className={styles.columnHeader}>
                    <p className="section-label">Criteria</p>
                    <h2>Decision lens</h2>
                  </div>
                  <div className={styles.cellLabel}>Overall fit</div>
                  <div className={styles.cellLabel}>Status</div>
                  <div className={styles.cellLabel}>Archetype</div>
                  <div className={styles.cellLabel}>Remote signal</div>
                  <div className={styles.cellLabel}>Compensation</div>
                  <div className={styles.cellLabel}>Detected level</div>
                  <div className={styles.cellLabel}>Natural level</div>
                  <div className={styles.cellLabel}>CV alignment</div>
                  <div className={styles.cellLabel}>Gap count</div>
                  <div className={styles.cellLabel}>Interview stories</div>
                  <div className={styles.cellLabel}>Keywords</div>
                  <div className={styles.cellLabel}>Strategy</div>
                  <div className={styles.cellLabel}>Current note</div>
                </div>

                {selectedEntries.map((entry) => {
                  const badges = badgeWinners
                    .filter((badge) => badge.id === entry.opportunity.id)
                    .map((badge) => badge.label);

                  return (
                    <div className={styles.column} key={entry.opportunity.id}>
                      <div className={styles.columnHeader}>
                        <div className={styles.columnTitle}>
                          <strong>
                            {entry.opportunity.company} · {entry.opportunity.role}
                          </strong>
                          <p>{entry.opportunity.date}</p>
                        </div>

                        <div className={styles.badgeStack}>
                          {badges.map((badge) => (
                            <span className={styles.badge} key={badge}>
                              {badge}
                            </span>
                          ))}
                        </div>

                        <Link href={`/pipeline/${entry.opportunity.id}`}>
                          Open full dossier
                        </Link>
                      </div>

                      <div className={styles.valueCell}>
                        <strong className="tabular-nums">
                          {formatScore(entry.opportunity)}
                        </strong>
                      </div>
                      <div className={styles.valueCell}>{entry.opportunity.status}</div>
                      <div className={styles.valueCell}>
                        {entry.opportunity.archetype ?? "Pending report detail"}
                      </div>
                      <div className={styles.valueCell}>
                        {entry.opportunity.remote ?? "No signal yet"}
                      </div>
                      <div className={styles.valueCell}>
                        {summarizeCompensation(entry.opportunity.compensation)}
                      </div>
                      <div className={styles.valueCell}>
                        {entry.evaluation?.detectedLevel ?? "Unavailable"}
                      </div>
                      <div className={styles.valueCell}>
                        {entry.evaluation?.candidateLevel ?? "Unavailable"}
                      </div>
                      <div className={styles.valueCell}>
                        {entry.evaluation
                          ? `${entry.evaluation.cvMatchItems.length} matched rows`
                          : "Report pending"}
                      </div>
                      <div className={styles.valueCell}>
                        {entry.evaluation
                          ? `${entry.evaluation.gapItems.length} gaps`
                          : "Report pending"}
                      </div>
                      <div className={styles.valueCell}>
                        {entry.evaluation
                          ? `${entry.evaluation.interviewItems.length} stories`
                          : "Report pending"}
                      </div>
                      <div className={styles.valueCell}>
                        {summarizeKeywords(entry.evaluation)}
                      </div>
                      <div className={styles.valueCell}>
                        {summarizeStrategy(entry.evaluation)}
                      </div>
                      <div className={styles.valueCell}>
                        {summarizeNextContext(entry)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
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
