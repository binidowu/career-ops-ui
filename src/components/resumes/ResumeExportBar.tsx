"use client";

import type { ResumeDocument } from "@/lib/types";

import styles from "./ResumeDocumentEditor.module.css";

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

interface Props {
  document: ResumeDocument;
  saveStatus: SaveStatus;
}

const STATUS_LABELS: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved",
  error: "Save failed",
};

export function ResumeExportBar({ document, saveStatus }: Props) {
  return (
    <div className={styles.exportBar}>
      <div className={styles.saveIndicator}>
        <span className={styles.saveDot} data-status={saveStatus} />
        {STATUS_LABELS[saveStatus]}
      </div>
      <span className={styles.docId} title={`Document: ${document.id}`}>
        {document.id.slice(0, 8)}…
      </span>
    </div>
  );
}
