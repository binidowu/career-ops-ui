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
    case "company":
      return left.company.localeCompare(right.company);
    case "role":
      return left.role.localeCompare(right.role);
    case "status":
      return left.status.localeCompare(right.status);
    case "date":
      return left.date.localeCompare(right.date);
    case "score":
      return (left.score ?? -1) - (right.score ?? -1);
    default:
      return 0;
  }
}

export default function PipelineWorkspace({
  opportunities,
  statusOptions,
}: PipelineWorkspaceProps) {
  const notify = useToast();
  const router = useRouter();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All statuses");
  const [selectedArchetype, setSelectedArchetype] = useState("All archetypes");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query);

  const archetypeOptions = useMemo(
    () =>
      [
        "All archetypes",
        ...new Set(
          opportunities
            .map((opportunity) => opportunity.archetype)
            .filter((value): value is string => Boolean(value)),
        ),
      ],
    [opportunities],
  );

  const filteredOpportunities = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return [...opportunities]
      .filter((opportunity) => {
        if (
          selectedStatus !== "All statuses" &&
          opportunity.status !== selectedStatus
        ) {
          return false;
        }

        if (
          selectedArchetype !== "All archetypes" &&
          opportunity.archetype !== selectedArchetype
        ) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          opportunity.company,
          opportunity.role,
          opportunity.status,
          opportunity.summary ?? "",
          opportunity.notes,
          opportunity.archetype ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return normalizedQuery
          .split(/\s+/)
          .every((token) => haystack.includes(token));
      })
      .sort((left, right) => {
        const result = compareValues(left, right, sortKey);
        return sortDirection === "asc" ? result : result * -1;
      });
  }, [
    deferredQuery,
    opportunities,
    selectedArchetype,
    selectedStatus,
    sortDirection,
    sortKey,
  ]);

  const selectedCount = selectedIds.length;

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }

  function toggleSelectAll() {
    if (
      filteredOpportunities.length > 0 &&
      filteredOpportunities.every((opportunity) =>
        selectedIds.includes(opportunity.id),
      )
    ) {
      setSelectedIds((current) =>
        current.filter(
          (id) =>
            !filteredOpportunities.some((opportunity) => opportunity.id === id),
        ),
      );
      return;
    }

    setSelectedIds((current) => [
      ...new Set([
        ...current,
        ...filteredOpportunities.map((opportunity) => opportunity.id),
      ]),
    ]);
  }

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "score" || nextKey === "date" ? "desc" : "asc");
  }

  return (
    <>
      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <span className="visually-hidden">Search opportunities</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search company, role, archetype, or note"
              value={query}
            />
          </label>

          <div className={styles.filters}>
            <label className={styles.filter}>
              <span>Status</span>
              <select
                onChange={(event) => setSelectedStatus(event.target.value)}
                value={selectedStatus}
              >
                <option>All statuses</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.filter}>
              <span>Archetype</span>
              <select
                onChange={(event) => setSelectedArchetype(event.target.value)}
                value={selectedArchetype}
              >
                {archetypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.summary}>
            <span className={styles.summaryStat}>
              <span>Visible</span>
              <strong className="tabular-nums">{filteredOpportunities.length}</strong>
            </span>
            <span className={styles.summaryStat}>
              <span>Selected</span>
              <strong className="tabular-nums">{selectedCount}</strong>
            </span>
          </div>
        </div>

        {filteredOpportunities.length ? (
          <div className={styles.tableFrame}>
            <div className={styles.tableHead}>
              <label className={styles.checkboxLabel}>
                <input
                  checked={
                    filteredOpportunities.length > 0 &&
                    filteredOpportunities.every((opportunity) =>
                      selectedIds.includes(opportunity.id),
                    )
                  }
                  onChange={() => toggleSelectAll()}
                  type="checkbox"
                />
                <span className="visually-hidden">Select all visible rows</span>
              </label>

              <button
                className={styles.sortButton}
                onClick={() => changeSort("role")}
                type="button"
              >
                Role
              </button>

              <button
                className={styles.sortButton}
                onClick={() => changeSort("score")}
                type="button"
              >
                Score
              </button>

              <button
                className={styles.sortButton}
                onClick={() => changeSort("status")}
                type="button"
              >
                Status
              </button>

              <button
                className={styles.sortButton}
                onClick={() => changeSort("date")}
                type="button"
              >
                Date
              </button>
            </div>

            <div className={styles.tableBody}>
              {filteredOpportunities.map((opportunity) => (
                <div
                  className={styles.row}
                  data-active={opportunity.id === activeId}
                  key={opportunity.id}
                  onClick={() => setActiveId(opportunity.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActiveId(opportunity.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <label
                    className={styles.checkboxLabel}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      checked={selectedIds.includes(opportunity.id)}
                      onChange={() => toggleSelection(opportunity.id)}
                      type="checkbox"
                    />
                    <span className="visually-hidden">
                      Select {opportunity.company} {opportunity.role}
                    </span>
                  </label>

                  <div className={styles.roleBlock}>
                    <strong>
                      {opportunity.company} · {opportunity.role}
                    </strong>
                    <small>
                      {opportunity.archetype ?? "Archetype pending"} ·{" "}
                      {opportunity.remote ?? "Location pending"}
                    </small>
                  </div>

                  <p className={`${styles.score} tabular-nums`}>
                    <span className={styles.scorePill}>
                      {typeof opportunity.score === "number"
                        ? opportunity.score.toFixed(1)
                        : opportunity.scoreRaw || "N/A"}
                    </span>
                  </p>

                  <p className={styles.status}>
                    <span className={styles.statusPill}>{opportunity.status}</span>
                  </p>

                  <div className={styles.metaBlock}>
                    <small>{opportunity.date || "Unknown date"}</small>
                    <p>{opportunity.notes || opportunity.summary || "No note captured yet."}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <section className="empty-state">
            <p className="section-label">No roles match the current filters</p>
            <h2>The pipeline is populated, but this view has been narrowed to zero.</h2>
            <p>Clear the search or reset one of the filters to bring rows back.</p>
          </section>
        )}
      </section>

      {selectedCount ? (
        <div className={styles.selectionBar}>
          <p>
            <strong>{selectedCount}</strong> selected
          </p>

          <div className={styles.selectionActions}>
            <button
              onClick={() =>
                selectedCount >= 2
                  ? startTransition(() => {
                      router.push(
                        `/compare?ids=${selectedIds.slice(0, 5).join(",")}`,
                      );
                    })
                  : notify({
                      title: "Select at least two roles",
                      description:
                        "Comparison becomes useful once there are at least two dossiers on the board.",
                      dismissAfter: 4000,
                    })
              }
              type="button"
            >
              Compare
            </button>

            <button onClick={() => setSelectedIds([])} type="button">
              Clear selection
            </button>
          </div>
        </div>
      ) : null}

      <OpportunityDrawer
        opportunity={
          activeId
            ? opportunities.find((opportunity) => opportunity.id === activeId) ?? null
            : null
        }
        onClose={() => setActiveId(null)}
        statusOptions={statusOptions}
      />
    </>
  );
}
