import Link from "next/link";
import { notFound } from "next/navigation";

import type { ApplyEvaluationContext } from "@/components/apply/ApplyWorkspaceClient";
import ApplyWorkspaceClient from "@/components/apply/ApplyWorkspaceClient";
import {
  getApplyData,
  getOpportunity,
  seedApplyActivity,
} from "@/lib/api/career-ops";

import styles from "./page.module.css";

export default async function OpportunityApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { evaluation, opportunity } = await getOpportunity(id);

  if (!opportunity) notFound();

  await seedApplyActivity(id, {
    evaluationDate: opportunity.date || null,
  });

  const applyData = await getApplyData(id);
  const evaluationContext: ApplyEvaluationContext | null = evaluation
    ? {
        cvMatchItems: evaluation.cvMatchItems.slice(0, 4),
        keywords: evaluation.keywords.slice(0, 12),
        personalizationItems: evaluation.personalizationItems.slice(0, 5),
      }
    : null;

  return (
    <article className={`app-page ${styles.page}`}>
      <p className={styles.breadcrumb}>
        <Link href="/pipeline">Pipeline</Link>
        {" // "}
        <Link href={`/pipeline/${opportunity.id}`}>Analysis Dossier</Link>
        {" // "}
        Apply &amp; Outreach
      </p>

      <ApplyWorkspaceClient
        evaluationContext={evaluationContext}
        initialApplyData={applyData}
        opportunity={opportunity}
      />
    </article>
  );
}
