import CompareWorkspace from "@/components/compare/CompareWorkspace";
import { getOpportunities, getOpportunity } from "@/lib/api/career-ops";

import styles from "./page.module.css";

function normalizeSelectedIds(
  rawValue: string | string[] | undefined,
  validIds: Set<string>,
) {
  const parts = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];

  return [...new Set(
    parts
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter((value) => validIds.has(value)),
  )].slice(0, 5);
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>;
}) {
  const opportunities = (await getOpportunities())
    .filter((opportunity) => typeof opportunity.score === "number")
    .sort((left, right) => {
      const scoreDifference = (right.score ?? 0) - (left.score ?? 0);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return right.date.localeCompare(left.date);
    });

  const validIds = new Set(opportunities.map((opportunity) => opportunity.id));
  const requestedIds = normalizeSelectedIds((await searchParams).ids, validIds);
  const selectedIds =
    requestedIds.length > 0
      ? requestedIds
      : opportunities.slice(0, 3).map((opportunity) => opportunity.id);

  const selectedEntries = (
    await Promise.all(
      selectedIds.map(async (id) => {
        const detail = await getOpportunity(id);

        if (!detail.opportunity) {
          return null;
        }

        return {
          opportunity: detail.opportunity,
          evaluation: detail.evaluation,
        };
      }),
    )
  ).filter((entry) => entry !== null);

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.header}>
        <h1>Side-by-Side Prioritization</h1>
        <p className={styles.headerSub}>
          Compare evaluated roles and decide what deserves the next move.
        </p>
      </header>

      <CompareWorkspace
        initialEntries={selectedEntries}
        opportunities={opportunities}
      />
    </article>
  );
}
