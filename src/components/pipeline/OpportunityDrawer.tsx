"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";

import type { Evaluation, Opportunity } from "@/lib/types";

import OpportunityStatusEditor from "./OpportunityStatusEditor";
import styles from "./OpportunityDrawer.module.css";

interface OpportunityDrawerProps {
  onClose: () => void;
  opportunity: Opportunity | null;
  statusOptions: string[];
}

interface OpportunityResponse {
  evaluation: Evaluation | null;
  opportunity: Opportunity | null;
}

export default function OpportunityDrawer({
  opportunity,
  onClose,
  statusOptions,
}: OpportunityDrawerProps) {
  const [data, setData] = useState<OpportunityResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const activeOpportunity = data?.opportunity ?? opportunity;
  const evaluation = data?.evaluation ?? null;
  const isOpen = Boolean(opportunity);

  const onWindowKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
    }
  });

  useEffect(() => {
    if (!isOpen || !opportunity) {
      setData(null);
      return;
    }

    const currentOpportunity = opportunity;
    const controller = new AbortController();

    async function loadDetails() {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/opportunities/${currentOpportunity.id}`,
          {
          signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Unable to load opportunity details.");
        }

        const payload = (await response.json()) as OpportunityResponse;
        setData(payload);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setData({
          opportunity: currentOpportunity,
          evaluation: null,
        });
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDetails();

    return () => controller.abort();
  }, [isOpen, opportunity]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => onWindowKeyDown(event);
    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !activeOpportunity) {
    return null;
  }

  return (
    <>
      <button
        aria-label="Close opportunity drawer"
        className={styles.scrim}
        onClick={onClose}
        type="button"
      />

      <aside aria-label="Opportunity drawer" className={styles.drawer}>
        <header className={styles.header}>
          <div className={styles.headCopy}>
            <p className={styles.eyebrow}>Quick dossier</p>
            <h2>
              {activeOpportunity.company} · {activeOpportunity.role}
            </h2>
            <p>
              {evaluation?.summary ??
                activeOpportunity.summary ??
                "No report summary has been captured yet."}
            </p>
          </div>

          <button className={styles.close} onClick={onClose} type="button">
            Close
          </button>
        </header>

        <div className={styles.metrics}>
          <div>
            <span>Score</span>
            <strong className="tabular-nums">
              {typeof activeOpportunity.score === "number"
                ? activeOpportunity.score.toFixed(1)
                : activeOpportunity.scoreRaw || "N/A"}
            </strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{activeOpportunity.status}</strong>
          </div>
          <div>
            <span>Archetype</span>
            <strong>{activeOpportunity.archetype ?? "Pending"}</strong>
          </div>
        </div>

        <div className={styles.body}>
          <section className={styles.block}>
            <p className={styles.label}>Status and notes</p>
            <OpportunityStatusEditor
              initialNotes={activeOpportunity.notes}
              initialStatus={activeOpportunity.status}
              opportunityId={activeOpportunity.id}
              statusOptions={statusOptions}
            />
          </section>

          <section className={styles.block}>
            <p className={styles.label}>Signals</p>
            <ul className={styles.list}>
              <li>Evaluated on {activeOpportunity.date || "unknown date"}</li>
              <li>{activeOpportunity.remote ?? "Location signal unavailable"}</li>
              <li>{activeOpportunity.compensation ?? "Comp estimate unavailable"}</li>
              <li>{activeOpportunity.jobUrl ?? "Original job URL unavailable"}</li>
            </ul>
          </section>

          <section className={styles.block}>
            <p className={styles.label}>Evaluation snapshot</p>
            {loading ? (
              <p>Loading the full report…</p>
            ) : evaluation ? (
              <div className={styles.evaluation}>
                <p>
                  <strong>Detected level:</strong>{" "}
                  {evaluation.detectedLevel ?? "Unavailable"}
                </p>
                <p>
                  <strong>CV match rows:</strong> {evaluation.cvMatchItems.length}
                </p>
                <p>
                  <strong>Gap rows:</strong> {evaluation.gapItems.length}
                </p>
                <p>
                  <strong>Interview prompts:</strong>{" "}
                  {evaluation.interviewItems.length}
                </p>
              </div>
            ) : (
              <p>
                No parsed report details are available yet for this opportunity.
              </p>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <Link href={`/pipeline/${activeOpportunity.id}`}>Open full page</Link>
          {activeOpportunity.reportPath ? (
            <span>{activeOpportunity.reportPath}</span>
          ) : (
            <span>No report linked</span>
          )}
        </footer>
      </aside>
    </>
  );
}
