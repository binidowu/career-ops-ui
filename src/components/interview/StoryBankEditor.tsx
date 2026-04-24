"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/common/ToastContext";

import styles from "./StoryBankEditor.module.css";

interface StoryBankEditorProps {
  initialContent: string;
  path: string;
}

export default function StoryBankEditor({
  initialContent,
  path,
}: StoryBankEditorProps) {
  const router = useRouter();
  const notify = useToast();
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  const dirty = content !== initialContent;

  async function handleSave() {
    setSaving(true);

    try {
      const response = await fetch("/api/interview-prep/story-bank", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save the story bank.");
      }

      notify({
        title: "Story bank saved",
        description: "Your interview story bank has been updated in the backend workspace.",
        dismissAfter: 4000,
      });
      router.refresh();
    } catch (error) {
      notify({
        title: "Save failed",
        description:
          error instanceof Error ? error.message : "Unable to save the interview story bank.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headCopy}>
          <p className={styles.eyebrow}>Story bank</p>
          <h2>Edit the reusable STAR+R bank from the browser.</h2>
          <p className={styles.lead}>
            This is the reusable layer the backend keeps reaching for when it builds prep briefs.
            Tighten the stories here and the rest of the workspace gets sharper with it.
          </p>
        </div>
        <div className={styles.meta}>
          <span className={styles.path}>{path}</span>
          <span className={styles.status}>{dirty ? "Unsaved changes" : "In sync with workspace"}</span>
        </div>
      </div>

      <p className={styles.copy}>
        Keep your strongest examples here so future interview prep can map questions back to proven
        work rather than generic claims.
      </p>

      <div className={styles.editorShell}>
        <div className={styles.editorNote}>
          Write in plain language first. The generator can translate tone later, but it needs
          concrete situations, actions, and outcomes to work from.
        </div>
        <textarea
          className={styles.editor}
          onChange={(event) => setContent(event.target.value)}
          rows={18}
          value={content}
        />
      </div>

      <div className={styles.actions}>
        <span className={styles.actionHint}>
          Saves directly into the backend workspace and refreshes the prep route.
        </span>
        <button
          className={styles.saveButton}
          disabled={!dirty || saving}
          onClick={() => void handleSave()}
          type="button"
        >
          {saving ? "Saving…" : "Save story bank"}
        </button>
        <button
          className={styles.resetButton}
          disabled={!dirty || saving}
          onClick={() => setContent(initialContent)}
          type="button"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
