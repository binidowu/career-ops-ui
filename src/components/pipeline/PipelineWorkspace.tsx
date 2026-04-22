"use client";
import { useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useMemo, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type { Opportunity } from "@/lib/types";

import OpportunityDrawer from "./OpportunityDrawer";
import styles from "./PipelineWorkspace.module.css";

type SortKey = "company" | "date" | "role" | "score" | "status";

interface PipelineWorkspaceProps {
  opportunities: Opportunity[];
  statusOptions: string[];
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
          <div className={styles.tableFrame}>
            <div className={styles.tableHead}>
              <button className={styles.sortBtn} onClick={() => changeSort("role")} type="button">
                Role
              </button>
              <button className={styles.sortBtn} onClick={() => changeSort("company")} type="button">
                Company
              </button>
              <button className={styles.sortBtn} onClick={() => changeSort("score")} type="button">
                Score
              </button>
              <span className={styles.colHeader}>Grade</span>
              <button className={styles.sortBtn} onClick={() => changeSort("status")} type="button">
                Status
              </button>
              <span className={styles.colHeader}>Location</span>
            </div>

            <div className={styles.tableBody}>
              {filteredOpportunities.map((opportunity) => (
                <div
                  className={styles.row}
                  data-active={opportunity.id === activeId}
                  key={opportunity.id}
                  onClick={() => setActiveId(opportunity.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveId(opportunity.id);
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

      <OpportunityDrawer
        opportunity={
          activeId
            ? opportunities.find((o) => o.id === activeId) ?? null
            : null
        }
        onClose={() => setActiveId(null)}
        statusOptions={statusOptions}
      />
    </>
  );
}
