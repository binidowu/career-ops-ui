"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type { ApplyNoteEntry } from "@/lib/api/career-ops";
import type { Opportunity, OpportunityStatus } from "@/lib/types";

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
  opportunity: Opportunity;
  initialApplyData: ApplyNoteEntry;
}

export default function ApplyWorkspaceClient({ opportunity, initialApplyData }: Props) {
  const router = useRouter();
  const notify = useToast();

  const [coverLetter, setCoverLetter] = useState(initialApplyData.coverLetterNotes);
  const [outreach, setOutreach] = useState(initialApplyData.outreachDraft);
  const [status, setStatus] = useState<OpportunityStatus>(opportunity.status);
  const [saving, setSaving] = useState(false);
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
        body: JSON.stringify({ coverLetterNotes: coverLetter, outreachDraft: outreach }),
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
    setStatus(next);

    try {
      const patch: Partial<ApplyNoteEntry> = {};
      if (next === "Applied" && !initialApplyData.appliedDate) {
        patch.appliedDate = new Date().toISOString().slice(0, 10);
        await fetch(`/api/apply/${opportunity.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
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
      notify({ title: "Status update failed", description: "Unable to write the new status. Try again.", tone: "error", dismissAfter: null });
    } finally {
      setUpdatingStatus(false);
    }
  }

  const completedCount = CHECKLIST_STEPS.filter((s) => checked.has(s.id)).length;

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
            <span className={styles.sectionHint}>Auto-saved as you type</span>
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
            <span className={styles.sectionHint}>LinkedIn connection / email</span>
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
        </section>

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
