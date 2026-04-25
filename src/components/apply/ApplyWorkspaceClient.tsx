"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type { ApplyDraftKind, ApplyNoteEntry } from "@/lib/api/career-ops";
import type { CvMatchItem, Opportunity, OpportunityStatus, PersonalizationItem } from "@/lib/types";

import styles from "./ApplyWorkspaceClient.module.css";

const APPLY_STATUSES: OpportunityStatus[] = [
  "Evaluated",
  "Applied",
  "Responded",
  "Interview",
  "Offer",
  "Rejected",
  "Discarded",
];

const CHECKLIST_STEPS = [
  { id: "review-dossier", label: "Review the evaluation dossier and score" },
  { id: "tailor-resume", label: "Generate and download a tailored resume" },
  { id: "draft-cover", label: "Write cover letter / application notes" },
  { id: "draft-outreach", label: "Draft a LinkedIn or email outreach message" },
  { id: "submit", label: "Submit the application through the job posting" },
  { id: "mark-applied", label: "Mark status as Applied in the tracker" },
];

interface Props {
  evaluationContext: ApplyEvaluationContext | null;
  opportunity: Opportunity;
  initialApplyData: ApplyNoteEntry;
}

export interface ApplyEvaluationContext {
  cvMatchItems: CvMatchItem[];
  keywords: string[];
  personalizationItems: PersonalizationItem[];
}

export default function ApplyWorkspaceClient({
  evaluationContext,
  opportunity,
  initialApplyData,
}: Props) {
  const router = useRouter();
  const notify = useToast();

  const [coverLetter, setCoverLetter] = useState(initialApplyData.coverLetterNotes);
  const [outreach, setOutreach] = useState(initialApplyData.outreachDraft);
  const [appliedDate, setAppliedDate] = useState(initialApplyData.appliedDate);
  const [status, setStatus] = useState<OpportunityStatus>(opportunity.status);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<ApplyDraftKind | null>(null);
  const [updatingDate, setUpdatingDate] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const stored = localStorage.getItem(`apply-checklist-${opportunity.id}`);
    return stored ? new Set<string>(JSON.parse(stored) as string[]) : new Set();
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem(
        `apply-checklist-${opportunity.id}`,
        JSON.stringify([...next]),
      );
      return next;
    });
  }

  function scheduleSave(patch: Partial<ApplyNoteEntry>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistApplyData(patch), 800);
  }

  async function persistApplyData(patch: Partial<ApplyNoteEntry>) {
    try {
      const res = await fetch(`/api/apply/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch {
      notify({
        title: "Could not save notes",
        description: "Changes will be lost on refresh. Check your connection.",
        tone: "error",
        dismissAfter: 5000,
      });
    }
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      const res = await fetch(`/api/apply/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverLetterNotes: coverLetter,
          outreachDraft: outreach,
          appliedDate,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      notify({ title: "Notes saved", description: "Cover letter and outreach draft saved.", dismissAfter: 2500 });
    } catch {
      notify({
        title: "Save failed",
        description: "Unable to write apply notes. Try again.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(next: OpportunityStatus) {
    setUpdatingStatus(true);
    const prev = status;
    const prevAppliedDate = appliedDate;
    setStatus(next);

    try {
      const patch: Partial<ApplyNoteEntry> = {};
      if (next === "Applied" && !appliedDate) {
        patch.appliedDate = new Date().toISOString().slice(0, 10);
        setAppliedDate(patch.appliedDate);
        const dateRes = await fetch(`/api/apply/${opportunity.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!dateRes.ok) throw new Error("Applied date update failed");
      }

      const res = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Status update failed");

      notify({ title: `Status → ${next}`, description: `Tracker updated to "${next}".`, dismissAfter: 2500 });
      router.refresh();
    } catch {
      setStatus(prev);
      setAppliedDate(prevAppliedDate);
      notify({ title: "Status update failed", description: "Unable to write the new status. Try again.", tone: "error", dismissAfter: null });
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAppliedDateChange(value: string) {
    const nextDate = value || null;
    const prevDate = appliedDate;
    setAppliedDate(nextDate);
    setUpdatingDate(true);

    try {
      const res = await fetch(`/api/apply/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appliedDate: nextDate }),
      });
      if (!res.ok) throw new Error("Applied date update failed");
      notify({
        title: nextDate ? "Applied date updated" : "Applied date cleared",
        description: nextDate ? `Saved ${nextDate}.` : "The workspace no longer has an applied date.",
        dismissAfter: 2200,
      });
    } catch {
      setAppliedDate(prevDate);
      notify({
        title: "Date update failed",
        description: "Unable to save the applied date. Try again.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setUpdatingDate(false);
    }
  }

  async function handleGenerate(kind: ApplyDraftKind) {
    setGenerating(kind);

    try {
      const res = await fetch(`/api/apply/${opportunity.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = (await res.json()) as { error?: string; text?: string };
      if (!res.ok || !data.text) {
        throw new Error(data.error ?? "Generation failed");
      }

      if (kind === "cover-letter") {
        setCoverLetter(data.text);
        scheduleSave({ coverLetterNotes: data.text });
      } else {
        setOutreach(data.text);
        scheduleSave({ outreachDraft: data.text });
      }

      notify({
        title: kind === "cover-letter" ? "Cover letter drafted" : "Outreach drafted",
        description: "Review and edit the generated copy before sending.",
        dismissAfter: 3000,
      });
    } catch (error) {
      notify({
        title: "Generation failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to generate a draft right now.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setGenerating(null);
    }
  }

  const completedCount = CHECKLIST_STEPS.filter((s) => checked.has(s.id)).length;
  const hasTalkingPoints =
    Boolean(evaluationContext?.cvMatchItems.length) ||
    Boolean(evaluationContext?.personalizationItems.length) ||
    Boolean(evaluationContext?.keywords.length);

  return (
    <div className={styles.layout}>
      {/* Main column */}
      <div className={styles.main}>

        {/* Apply checklist */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <span className={styles.sectionLabel}>Apply checklist</span>
            <span className={styles.sectionProgress}>
              {completedCount} / {CHECKLIST_STEPS.length}
            </span>
          </header>
          <div className={styles.checklist}>
            {CHECKLIST_STEPS.map((step) => (
              <label key={step.id} className={styles.checkItem} data-done={checked.has(step.id)}>
                <input
                  checked={checked.has(step.id)}
                  className={styles.checkInput}
                  onChange={() => toggleCheck(step.id)}
                  type="checkbox"
                />
                <span>{step.label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Cover letter / application notes */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <span className={styles.sectionLabel}>Cover letter &amp; application notes</span>
            <div className={styles.sectionActions}>
              <span className={styles.sectionHint}>Auto-saved as you type</span>
              <button
                className={styles.btnGenerate}
                disabled={generating !== null}
                onClick={() => void handleGenerate("cover-letter")}
                type="button"
              >
                {generating === "cover-letter" ? "Generating…" : coverLetter ? "Regenerate" : "Generate"}
              </button>
            </div>
          </header>
          <p className={styles.sectionCopy}>
            Draft your cover letter, application statement, or any notes specific to
            this submission. Reference the evaluation report for talking points.
          </p>
          <textarea
            className={styles.editor}
            onChange={(e) => {
              setCoverLetter(e.target.value);
              scheduleSave({ coverLetterNotes: e.target.value });
            }}
            placeholder={`Why you're excited about ${opportunity.company}, what you bring, and what you want to communicate in your application…`}
            rows={12}
            value={coverLetter}
          />
        </section>

        {/* Outreach draft */}
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <span className={styles.sectionLabel}>Outreach draft</span>
            <div className={styles.sectionActions}>
              <span className={styles.sectionHint}>LinkedIn connection / email</span>
              <button
                className={styles.btnGenerate}
                disabled={generating !== null}
                onClick={() => void handleGenerate("outreach")}
                type="button"
              >
                {generating === "outreach" ? "Generating…" : outreach ? "Regenerate" : "Generate"}
              </button>
            </div>
          </header>
          <p className={styles.sectionCopy}>
            Write a short outreach message to a hiring manager or employee at{" "}
            {opportunity.company}. Keep it specific — mention the role, one reason
            you&apos;re a strong fit, and a clear ask.
          </p>
          <textarea
            className={styles.editor}
            onChange={(e) => {
              setOutreach(e.target.value);
              scheduleSave({ outreachDraft: e.target.value });
            }}
            placeholder={`Hi [Name], I came across the ${opportunity.role} role at ${opportunity.company} and wanted to reach out…`}
            rows={7}
            value={outreach}
          />
        </section>

        <div className={styles.saveBar}>
          <button
            className={styles.btnSave}
            disabled={saving}
            onClick={() => void handleSaveAll()}
            type="button"
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
        </div>
      </div>

      {/* Rail */}
      <aside className={styles.rail}>

        {/* Status control */}
        <section className={styles.railCard}>
          <span className={styles.railLabel}>Application status</span>
          <div className={styles.statusGrid} aria-label="Update application status">
            {APPLY_STATUSES.map((s) => (
              <button
                key={s}
                className={styles.statusBtn}
                data-active={status === s}
                disabled={updatingStatus || status === s}
                onClick={() => void handleStatusChange(s)}
                type="button"
              >
                {s}
              </button>
            ))}
          </div>
          <label className={styles.dateField}>
            <span>Applied date</span>
            <input
              disabled={updatingDate}
              onChange={(event) => void handleAppliedDateChange(event.target.value)}
              type="date"
              value={appliedDate ?? ""}
            />
          </label>
        </section>

        {/* Evaluation-backed talking points */}
        {hasTalkingPoints ? (
          <details className={styles.railCard} open>
            <summary className={styles.talkingSummary}>
              <span className={styles.railLabel}>Talking points</span>
              <span className={styles.summaryToggle}>Toggle</span>
            </summary>

            {evaluationContext?.cvMatchItems.length ? (
              <div className={styles.talkingGroup}>
                <h2>CV strengths to lead with</h2>
                <ul className={styles.talkingList}>
                  {evaluationContext.cvMatchItems.map((item, index) => (
                    <li key={`${item.requirement}-${index}`}>
                      <strong>{item.requirement}</strong>
                      <span>{item.match}</span>
                      {item.source ? <em>{item.source}</em> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {evaluationContext?.personalizationItems.length ? (
              <div className={styles.talkingGroup}>
                <h2>Personalization suggestions</h2>
                <ul className={styles.talkingList}>
                  {evaluationContext.personalizationItems.map((item, index) => (
                    <li key={`${item.section}-${item.index || index}`}>
                      <strong>{item.section || `Suggestion ${index + 1}`}</strong>
                      <span>{item.proposedChange || item.current}</span>
                      {item.why ? <em>{item.why}</em> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {evaluationContext?.keywords.length ? (
              <div className={styles.talkingGroup}>
                <h2>ATS keywords to work in</h2>
                <div className={styles.keywordList}>
                  {evaluationContext.keywords.map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </details>
        ) : null}

        {/* Key signals from evaluation */}
        {opportunity.score !== null ? (
          <section className={styles.railCard}>
            <span className={styles.railLabel}>Fit signals</span>
            <div className={styles.signalList}>
              <div className={styles.signalRow}>
                <span>Score</span>
                <strong className={styles.signalValue}>
                  {(opportunity.score * 20).toFixed(0)}/100
                </strong>
              </div>
              {opportunity.archetype ? (
                <div className={styles.signalRow}>
                  <span>Archetype</span>
                  <strong>{opportunity.archetype}</strong>
                </div>
              ) : null}
              {opportunity.remote ? (
                <div className={styles.signalRow}>
                  <span>Remote</span>
                  <strong>{opportunity.remote}</strong>
                </div>
              ) : null}
              {opportunity.compensation ? (
                <div className={styles.signalRow}>
                  <span>Comp</span>
                  <strong>{opportunity.compensation}</strong>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Quick links */}
        <section className={styles.railCard}>
          <span className={styles.railLabel}>Quick links</span>
          <div className={styles.linkList}>
            <a
              className={styles.linkItem}
              href={`/resumes?opportunity=${opportunity.id}`}
            >
              Tailor resume →
            </a>
            <a
              className={styles.linkItem}
              href={`/pipeline/${opportunity.id}`}
            >
              Evaluation dossier →
            </a>
            <a
              className={styles.linkItem}
              href={`/pipeline/${opportunity.id}/interview`}
            >
              Interview prep →
            </a>
            {opportunity.jobUrl ? (
              <a
                className={styles.linkItem}
                href={opportunity.jobUrl}
                rel="noreferrer"
                target="_blank"
              >
                Job posting ↗
              </a>
            ) : null}
          </div>
        </section>

      </aside>
    </div>
  );
}
