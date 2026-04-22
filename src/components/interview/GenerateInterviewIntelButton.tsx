"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/common/ToastContext";

import styles from "./GenerateInterviewIntelButton.module.css";

interface GenerateInterviewIntelButtonProps {
  opportunityId: string;
}

export default function GenerateInterviewIntelButton({
  opportunityId,
}: GenerateInterviewIntelButtonProps) {
  const router = useRouter();
  const notify = useToast();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);

    try {
      const response = await fetch("/api/interview-prep/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });
      const data = (await response.json()) as {
        error?: string;
        inferredQuestions?: number;
        outputPath?: string;
        storyMatches?: number;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to generate interview intel.");
      }

      notify({
        title: "Interview intel generated",
        description: `${data.inferredQuestions ?? 0} prep prompts and ${data.storyMatches ?? 0} story-bank match${data.storyMatches === 1 ? "" : "es"} written to ${data.outputPath ?? "interview-prep/"}.`,
        dismissAfter: 5000,
      });
      router.refresh();
    } catch (error) {
      notify({
        title: "Generation failed",
        description:
          error instanceof Error ? error.message : "Unable to generate interview intel.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className={styles.button}
      disabled={loading}
      onClick={() => void handleGenerate()}
      type="button"
    >
      {loading ? "Generating…" : "Generate Fresh Intel"}
    </button>
  );
}
