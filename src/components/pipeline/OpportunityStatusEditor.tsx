"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/common/ToastContext";

import styles from "./OpportunityStatusEditor.module.css";

interface OpportunityStatusEditorProps {
  initialNotes: string;
  initialStatus: string;
  opportunityId: string;
  statusOptions: string[];
}

export default function OpportunityStatusEditor({
  initialNotes,
  initialStatus,
  opportunityId,
  statusOptions,
}: OpportunityStatusEditorProps) {
  const router = useRouter();
  const notify = useToast();

  const [status, setStatus] = useState(initialStatus);
  const [savedStatus, setSavedStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  async function patchOpportunity(payload: { notes?: string; status?: string }) {
    const response = await fetch(`/api/opportunities/${opportunityId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as {
      error?: string;
      opportunity?: {
        notes: string;
        status: string;
      };
    };

    if (!response.ok) {
      throw new Error(data.error ?? "Unable to save the opportunity update.");
    }

    router.refresh();
    return data;
  }

  async function saveStatus(nextStatus: string, previousStatus: string, withUndo = true) {
    setStatus(nextStatus);
    setSavingStatus(true);

    try {
      const data = await patchOpportunity({ status: nextStatus });
      const confirmedStatus = data.opportunity?.status ?? nextStatus;
      setStatus(confirmedStatus);
      setSavedStatus(confirmedStatus);
      notify({
        title: `Status updated to ${confirmedStatus}`,
        description: "The tracker row in career-ops has been updated.",
        dismissAfter: 4000,
        action: withUndo
          ? {
              label: "Undo",
              onSelect: () => {
                void saveStatus(previousStatus, confirmedStatus, false);
              },
            }
          : undefined,
      });
    } catch (error) {
      setStatus(previousStatus);
      notify({
        title: "Status update failed",
        description:
          error instanceof Error ? error.message : "Unable to save status.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);

    try {
      const data = await patchOpportunity({ notes });
      const confirmedNotes = data.opportunity?.notes ?? notes;
      setNotes(confirmedNotes);
      setSavedNotes(confirmedNotes);
      notify({
        title: savedNotes ? "Notes updated" : "Notes added",
        description: "The tracker notes field has been written back to applications.md.",
        dismissAfter: 4000,
      });
    } catch (error) {
      notify({
        title: "Notes could not be saved",
        description:
          error instanceof Error ? error.message : "Unable to save notes.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className={styles.editor}>
      <label className={styles.field}>
        <span className={styles.label}>Pipeline status</span>
        <select
          className={styles.control}
          disabled={savingStatus}
          onChange={(event) => {
            const nextStatus = event.target.value;
            if (nextStatus && nextStatus !== savedStatus) {
              void saveStatus(nextStatus, savedStatus);
            }
          }}
          value={status}
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Working notes</span>
        <textarea
          className={styles.notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Capture next action, follow-up context, or anything worth remembering."
          rows={5}
          value={notes}
        />
      </label>

      <div className={styles.footer}>
        <p className={styles.helper}>
          {savingStatus
            ? "Saving status…"
            : savingNotes
              ? "Saving notes…"
              : notes !== savedNotes
                ? "Notes changed but not saved yet."
                : "Status changes save immediately. Notes save when you confirm below."}
        </p>

        <button
          className={styles.save}
          disabled={savingNotes || notes === savedNotes}
          onClick={() => void saveNotes()}
          type="button"
        >
          Save notes
        </button>
      </div>
    </div>
  );
}
