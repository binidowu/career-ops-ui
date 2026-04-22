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
    if (event.key === "Escape") onClose();
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
        const response = await fetch(`/api/opportunities/${currentOpportunity.id}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to load opportunity details.");
        const payload = (await response.json()) as OpportunityResponse;
        setData(payload);
      } catch {
        if (!controller.signal.aborted) {
          setData({ opportunity: currentOpportunity, evaluation: null });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadDetails();
    return () => controller.abort();
  }, [isOpen, opportunity]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => onWindowKeyDown(event);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !activeOpportunity) return null;

  const scoreDisplay = typeof activeOpportunity.score === "number"
    ? `${Math.round(activeOpportunity.score * 20)}/100`
    : activeOpportunity.scoreRaw || "N/A";

  const compBand = activeOpportunity.compensation || "—";
  const timeline = activeOpportunity.date ? `Added ${activeOpportunity.date}` : "—";

  return (
    <>
      <button
        aria-label="Close drawer"
        className={styles.scrim}
        onClick={onClose}
        type="button"
      />

      <aside aria-label="Quick Preview" className={styles.drawer}>
        {/* HEADER */}
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <span className={styles.label}>Quick Preview</span>
            <div className={styles.headerActions}>
              <Link className={styles.expandBtn} href={`/pipeline/${activeOpportunity.id}`} title="Open full page">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M9 1h4v4M13 1l-6 6M6 3H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <button className={styles.closeBtn} onClick={onClose} type="button">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Close" aria-hidden="true">
                  <path d="M1 1l12 12M13 1 1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <h2 className={styles.drawerTitle}>{activeOpportunity.role}</h2>
          <p className={styles.drawerCompany}>{activeOpportunity.company}</p>

          <div className={styles.statusRow}>
            <span className={styles.statusPill} data-tone={activeOpportunity.status.toLowerCase()}>
              {activeOpportunity.status.toUpperCase()}
            </span>
            <span className={styles.idLabel}>
              ID: {activeOpportunity.id.toUpperCase().slice(0, 8)}
            </span>
          </div>
        </header>

        {/* METRICS */}
        <div className={styles.metrics}>
          <div className={styles.metricGroup}>
            <span className={styles.metricLabel}>Fit Score</span>
            <strong className={styles.metricValue}>{scoreDisplay}</strong>
          </div>
          <div className={styles.metricGroup}>
            <span className={styles.metricLabel}>Archetype</span>
            <strong className={styles.metricValue}>{activeOpportunity.archetype ?? "Pending"}</strong>
          </div>
          <div className={styles.metricGroup}>
            <span className={styles.metricLabel}>Comp Band</span>
            <strong className={styles.metricValue}>{compBand}</strong>
          </div>
          <div className={styles.metricGroup}>
            <span className={styles.metricLabel}>Timeline</span>
            <strong className={styles.metricValue}>{timeline}</strong>
          </div>
        </div>

        {/* BODY */}
        <div className={styles.body}>
          {/* LATEST INTELLIGENCE */}
          <section className={styles.block}>
            <p className={styles.label}>Latest Intelligence</p>
            {loading ? (
              <p className={styles.bodyText}>Loading report…</p>
            ) : (
              <p className={styles.bodyText}>
                {evaluation?.summary ??
                  activeOpportunity.summary ??
                  (activeOpportunity.notes || "No report summary has been captured yet.")}
              </p>
            )}
            {evaluation && (
              <p className={styles.logMeta}>
                {evaluation.cvMatchItems.length} CV matches · {evaluation.gapItems.length} gaps · {evaluation.interviewItems.length} stories
              </p>
            )}
          </section>

          {/* STATUS EDITOR */}
          <section className={styles.block}>
            <p className={styles.label}>Status &amp; Notes</p>
            <OpportunityStatusEditor
              initialNotes={activeOpportunity.notes}
              initialStatus={activeOpportunity.status}
              opportunityId={activeOpportunity.id}
              statusOptions={statusOptions}
            />
          </section>
        </div>

        {/* FOOTER ACTIONS */}
        <footer className={styles.footer}>
          <Link className={styles.btnPrimary} href={`/pipeline/${activeOpportunity.id}/interview`}>
            Prep Interview
          </Link>
          <Link className={styles.btnOutline} href={`/pipeline/${activeOpportunity.id}`}>
            Open Dossier
          </Link>
        </footer>
      </aside>
    </>
  );
}
