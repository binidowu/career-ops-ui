"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type { Evaluation, Opportunity } from "@/lib/types";

import OpportunityStatusEditor from "./OpportunityStatusEditor";
import styles from "./PipelineWorkspace.module.css";

type SortKey = "company" | "date" | "role" | "score" | "status";

interface PipelineWorkspaceProps {
  opportunities: Opportunity[];
  statusOptions: string[];
}

interface OpportunityResponse {
  evaluation: Evaluation | null;
  opportunity: Opportunity | null;
}

function compareValues(left: Opportunity, right: Opportunity, sortKey: SortKey) {
  switch (sortKey) {
    case "company": return left.company.localeCompare(right.company);
    case "role": return left.role.localeCompare(right.role);
    case "status": return left.status.localeCompare(right.status);
    case "date": return left.date.localeCompare(right.date);
    case "score": return (left.score ?? -1) - (right.score ?? -1);
    default: return 0;
  }
}

function scoreToGrade(score: number | null | undefined): string {
  if (score == null) return "—";
  const pct = score * 20;
  if (pct >= 90) return "A+";
  if (pct >= 85) return "A";
  if (pct >= 80) return "B+";
  if (pct >= 75) return "B";
  if (pct >= 70) return "C+";
  if (pct >= 60) return "C";
  return "D";
}

function scoreToDisplay(opportunity: Opportunity): string {
  if (typeof opportunity.score === "number") {
    return String(Math.round(opportunity.score * 20));
  }
  return opportunity.scoreRaw || "—";
}

function statusTone(status: string): string {
  if (status === "Offer") return "success";
  if (status === "Interview" || status === "Responded") return "accent";
  if (status === "Applied") return "neutral";
  if (status === "Rejected" || status === "Discarded" || status === "SKIP") return "quiet";
  return "default";
}

function InlineOpportunityPreview({
  onClose,
  opportunity,
  statusOptions,
}: {
  onClose: () => void;
  opportunity: Opportunity | null;
  statusOptions: string[];
}) {
  const [data, setData] = useState<OpportunityResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const activeOpportunity = data?.opportunity ?? opportunity;
  const evaluation = data?.evaluation ?? null;

  useEffect(() => {
    if (!opportunity) {
      setData(null);
      return;
    }

    const controller = new AbortController();
    const currentOpportunity = opportunity;

    async function loadDetails() {
      setLoading(true);
      try {
        const response = await fetch(`/api/opportunities/${currentOpportunity.id}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to load opportunity details.");
        const payload = (await response.json()) as OpportunityResponse;
        setData(payload);
      } catch {
        if (!controller.signal.aborted) {
          setData({ evaluation: null, opportunity: currentOpportunity });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadDetails();
    return () => controller.abort();
  }, [opportunity]);

  if (!activeOpportunity) return null;

  const scoreDisplay = typeof activeOpportunity.score === "number"
    ? `${Math.round(activeOpportunity.score * 20)}/100`
    : activeOpportunity.scoreRaw || "N/A";
  const compBand = activeOpportunity.compensation || "—";
  const timeline = activeOpportunity.date ? `Added ${activeOpportunity.date}` : "—";
  const summary =
    evaluation?.summary ??
    activeOpportunity.summary ??
    (activeOpportunity.notes.trim() || "No report summary has been captured yet.");

  return (
    <aside aria-label="Quick Preview" className={styles.previewPane}>
      <header className={styles.previewHeader}>
        <div className={styles.previewHeaderTop}>
          <span className={styles.previewLabel}>Quick Preview</span>
          <div className={styles.previewActions}>
            <Link
              aria-label={`Open ${activeOpportunity.company} dossier`}
              className={styles.previewIconBtn}
              href={`/pipeline/${activeOpportunity.id}`}
              title="Open full page"
            >
              ↗
            </Link>
            <button
              aria-label="Close preview"
              className={styles.previewIconBtn}
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
        <h2 className={styles.previewTitle}>{activeOpportunity.role}</h2>
        <p className={styles.previewCompany}>{activeOpportunity.company}</p>
        <div className={styles.previewStatusRow}>
          <span
            className={styles.statusPill}
            data-tone={statusTone(activeOpportunity.status)}
          >
            {activeOpportunity.status}
          </span>
          <span className={styles.previewId}>
            ID: {activeOpportunity.id.toUpperCase().slice(0, 8)}
          </span>
        </div>
      </header>

      <div className={styles.previewMetrics}>
        <div>
          <span>Fit Score</span>
          <strong>{scoreDisplay}</strong>
        </div>
        <div>
          <span>Archetype</span>
          <strong>{activeOpportunity.archetype ?? "Pending"}</strong>
        </div>
        <div>
          <span>Comp Band</span>
          <strong>{compBand}</strong>
        </div>
        <div>
          <span>Timeline</span>
          <strong>{timeline}</strong>
        </div>
      </div>

      <div className={styles.previewBody}>
        <section className={styles.previewBlock}>
          <p className={styles.previewLabel}>Latest Intelligence</p>
          <p className={styles.previewText}>
            {loading ? "Loading report…" : summary}
          </p>
          {evaluation ? (
            <p className={styles.previewMeta}>
              {evaluation.cvMatchItems.length} CV matches · {evaluation.gapItems.length} gaps · {evaluation.interviewItems.length} stories
            </p>
          ) : null}
        </section>

        <section className={styles.previewBlock}>
          <p className={styles.previewLabel}>Status &amp; Notes</p>
          <OpportunityStatusEditor
            initialNotes={activeOpportunity.notes}
            initialStatus={activeOpportunity.status}
            opportunityId={activeOpportunity.id}
            statusOptions={statusOptions}
          />
        </section>
      </div>

      <footer className={styles.previewFooter}>
        <Link className={styles.previewPrimary} href={`/pipeline/${activeOpportunity.id}/interview`}>
          Prep Interview
        </Link>
        <Link className={styles.previewSecondary} href={`/pipeline/${activeOpportunity.id}`}>
          Open Dossier
        </Link>
      </footer>
    </aside>
  );
}

export default function PipelineWorkspace({
  opportunities,
  statusOptions,
}: PipelineWorkspaceProps) {
  const notify = useToast();
  const router = useRouter();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("All Active");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [archetypeQuery, setArchetypeQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const deferredArchetype = useDeferredValue(archetypeQuery);

  const filteredOpportunities = useMemo(() => {
    const minScore = scoreMin ? Number(scoreMin) : null;
    const maxScore = scoreMax ? Number(scoreMax) : null;
    const archetypeLower = deferredArchetype.trim().toLowerCase();

    return [...opportunities]
      .filter((o) => {
        if (selectedStatus !== "All Active" && o.status !== selectedStatus) return false;

        if (minScore !== null && typeof o.score === "number") {
          if (o.score * 20 < minScore) return false;
        }
        if (maxScore !== null && typeof o.score === "number") {
          if (o.score * 20 > maxScore) return false;
        }

        if (archetypeLower && !o.archetype?.toLowerCase().includes(archetypeLower)) return false;

        return true;
      })
      .sort((a, b) => {
        const result = compareValues(a, b, sortKey);
        return sortDirection === "asc" ? result : result * -1;
      });
  }, [deferredArchetype, opportunities, selectedStatus, scoreMin, scoreMax, sortDirection, sortKey]);

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((e) => e !== id) : [...current, id],
    );
  }

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "score" || nextKey === "date" ? "desc" : "asc");
  }

  function handleReset() {
    setSelectedStatus("All Active");
    setScoreMin("");
    setScoreMax("");
    setArchetypeQuery("");
  }

  const selectedCount = selectedIds.length;
  const activeOpportunity = activeId
    ? opportunities.find((opportunity) => opportunity.id === activeId) ?? null
    : null;

  return (
    <>
      <section className={styles.workspace}>
        {/* FILTER BAR */}
        <div className={styles.filterBar}>
          <label className={styles.filterGroup}>
            <span className={styles.filterLabel}>Status</span>
            <select
              className={styles.filterSelect}
              onChange={(e) => setSelectedStatus(e.target.value)}
              value={selectedStatus}
            >
              <option value="All Active">All Active</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Score Range</span>
            <div className={styles.rangeInputs}>
              <input
                className={styles.rangeInput}
                max="100"
                min="0"
                onChange={(e) => setScoreMin(e.target.value)}
                placeholder="Min"
                type="number"
                value={scoreMin}
              />
              <span className={styles.rangeSep}>–</span>
              <input
                className={styles.rangeInput}
                max="100"
                min="0"
                onChange={(e) => setScoreMax(e.target.value)}
                placeholder="Max"
                type="number"
                value={scoreMax}
              />
            </div>
          </div>

          <label className={styles.filterGroup}>
            <span className={styles.filterLabel}>Archetype</span>
            <input
              className={styles.filterInput}
              onChange={(e) => setArchetypeQuery(e.target.value)}
              placeholder="e.g. Builder, Scaler"
              type="text"
              value={archetypeQuery}
            />
          </label>

          <button className={styles.resetBtn} onClick={handleReset} type="button">
            Reset
          </button>
        </div>

        {/* TABLE */}
        {filteredOpportunities.length ? (
          <div className={styles.tableFrame} data-preview={Boolean(activeOpportunity)}>
            <div className={styles.tablePanel}>
              <div className={styles.tableHead}>
                <span aria-hidden="true" className={styles.checkboxHeader} />
                <button className={styles.sortBtn} onClick={() => changeSort("role")} type="button">
                  Role
                </button>
                <button className={`${styles.sortBtn} ${styles.companyHeader}`} onClick={() => changeSort("company")} type="button">
                  Company
                </button>
                <button className={styles.sortBtn} onClick={() => changeSort("score")} type="button">
                  Score
                </button>
                <span className={styles.colHeader}>Grade</span>
                <button className={styles.sortBtn} onClick={() => changeSort("status")} type="button">
                  Status
                </button>
                <span className={`${styles.colHeader} ${styles.locationHeader}`}>Location</span>
              </div>

              <div className={styles.tableBody}>
                {filteredOpportunities.map((opportunity) => (
                  <div
                    className={styles.row}
                    data-active={opportunity.id === activeId}
                    key={opportunity.id}
                    onClick={() => setActiveId((current) => current === opportunity.id ? null : opportunity.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveId((current) => current === opportunity.id ? null : opportunity.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <label className={styles.checkboxLabel} onClick={(e) => e.stopPropagation()}>
                      <input
                        checked={selectedIds.includes(opportunity.id)}
                        onChange={() => toggleSelection(opportunity.id)}
                        type="checkbox"
                      />
                      <span className="visually-hidden">
                        Select {opportunity.company} {opportunity.role}
                      </span>
                    </label>

                    <div className={styles.roleCell}>
                      <strong>{opportunity.role}</strong>
                      <span>{opportunity.company}</span>
                    </div>

                    <div className={styles.companyCell}>
                      {opportunity.company}
                    </div>

                    <div className={styles.scoreCell}>
                      {scoreToDisplay(opportunity)}
                    </div>

                    <div className={styles.gradeCell}>
                      <span
                        className={styles.gradeBadge}
                        data-grade={scoreToGrade(opportunity.score)[0]}
                      >
                        {scoreToGrade(opportunity.score)}
                      </span>
                    </div>

                    <div className={styles.statusCell}>
                      <span
                        className={styles.statusPill}
                        data-tone={statusTone(opportunity.status)}
                      >
                        {opportunity.status}
                      </span>
                    </div>

                    <div className={styles.locationCell}>
                      {opportunity.remote ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <InlineOpportunityPreview
              onClose={() => setActiveId(null)}
              opportunity={activeOpportunity}
              statusOptions={statusOptions}
            />
          </div>
        ) : (
          <section className="empty-state">
            <p className="section-label">No roles match the current filters</p>
            <h2>Clear a filter to bring rows back into view.</h2>
            <p>
              <button onClick={handleReset} style={{ textDecoration: "underline", background: "none", border: 0, cursor: "pointer", padding: 0, font: "inherit" }} type="button">
                Reset all filters
              </button>
            </p>
          </section>
        )}
      </section>

      {selectedCount > 0 && (
        <div className={styles.selectionBar}>
          <p><strong>{selectedCount}</strong> selected</p>
          <div className={styles.selectionActions}>
            <button
              onClick={() =>
                selectedCount >= 2
                  ? startTransition(() => {
                      router.push(`/compare?ids=${selectedIds.slice(0, 5).join(",")}`);
                    })
                  : notify({
                      title: "Select at least two roles",
                      description: "Comparison requires at least two dossiers.",
                      dismissAfter: 4000,
                    })
              }
              type="button"
            >
              Compare
            </button>
            <button onClick={() => setSelectedIds([])} type="button">
              Clear
            </button>
          </div>
        </div>
      )}

    </>
  );
}
