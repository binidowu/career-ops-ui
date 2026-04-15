"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type { ParsedCvDocument } from "@/lib/data/parse-cv";
import {
  buildResumeDraft,
  getDefaultResumeKeywords,
} from "@/lib/resume-studio";
import type { Evaluation, Opportunity, UserProfile } from "@/lib/types";

import styles from "./ResumeStudio.module.css";

interface ResumeStudioProps {
  cv: ParsedCvDocument | null;
  initialEvaluation: Evaluation | null;
  initialOpportunity: Opportunity | null;
  opportunities: Opportunity[];
  profile: UserProfile | null;
  workspace: {
    careerOpsPath: string;
    cvPath: string;
    cvReady: boolean;
    profilePath: string;
    profileReady: boolean;
    reportsReady: boolean;
    trackerPath: string;
    trackerReady: boolean;
  };
}

function normalizeRoleList(opportunities: Opportunity[]) {
  return opportunities
    .filter((opportunity) => opportunity.reportPath)
    .sort((left, right) => {
      const scoreDifference = (right.score ?? 0) - (left.score ?? 0);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return right.date.localeCompare(left.date);
    });
}

function draftFrom(
  cv: ParsedCvDocument | null,
  profile: UserProfile | null,
  opportunity: Opportunity | null,
  evaluation: Evaluation | null,
  format: "a4" | "letter",
  selectedKeywords: string[],
) {
  if (!cv || !opportunity) {
    return null;
  }

  return buildResumeDraft({
    cv,
    profile,
    opportunity,
    evaluation,
    format,
    selectedKeywords,
  });
}

export default function ResumeStudio({
  cv,
  initialEvaluation,
  initialOpportunity,
  opportunities,
  profile,
  workspace,
}: ResumeStudioProps) {
  const notify = useToast();
  const router = useRouter();
  const reportBacked = useMemo(() => normalizeRoleList(opportunities), [opportunities]);

  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(
    initialOpportunity,
  );
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(
    initialEvaluation,
  );
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(
    initialOpportunity ? getDefaultResumeKeywords(initialOpportunity, initialEvaluation) : [],
  );
  const [format, setFormat] = useState<"a4" | "letter">("a4");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const draft = useMemo(
    () =>
      draftFrom(
        cv,
        profile,
        selectedOpportunity,
        selectedEvaluation,
        format,
        selectedKeywords,
      ),
    [cv, format, profile, selectedEvaluation, selectedKeywords, selectedOpportunity],
  );

  async function handleSelectOpportunity(id: string) {
    const nextOpportunity = reportBacked.find((opportunity) => opportunity.id === id);

    if (!nextOpportunity) {
      return;
    }

    if (selectedOpportunity?.id === id) {
      return;
    }

    setLoadingId(id);

    try {
      const response = await fetch(`/api/opportunities/${id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load report-backed opportunity.");
      }

      const payload = (await response.json()) as {
        evaluation: Evaluation | null;
        opportunity: Opportunity;
      };

      setSelectedOpportunity(payload.opportunity);
      setSelectedEvaluation(payload.evaluation);
      setSelectedKeywords(
        getDefaultResumeKeywords(payload.opportunity, payload.evaluation),
      );
    } catch (error) {
      notify({
        title: "Could not switch roles",
        description:
          error instanceof Error
            ? error.message
            : "The selected opportunity could not be loaded.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setLoadingId(null);
    }
  }

  function toggleKeyword(keyword: string) {
    setSelectedKeywords((current) =>
      current.includes(keyword)
        ? current.filter((entry) => entry !== keyword)
        : [...current, keyword],
    );
  }

  async function handleExport() {
    if (!selectedOpportunity) {
      return;
    }

    setExporting(true);

    try {
      const response = await fetch("/api/resumes/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          opportunityId: selectedOpportunity.id,
          format,
          selectedKeywords,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to export PDF.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = draft?.fileName ?? "career-ops-resume.pdf";
      anchor.click();
      URL.revokeObjectURL(url);

      notify({
        title: "Resume PDF generated",
        description:
          "The studio rendered a tailored PDF through the connected career-ops export script.",
        dismissAfter: 4000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      notify({
        title: "Resume export failed",
        description:
          error instanceof Error
            ? error.message
            : "The PDF export could not be completed.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setExporting(false);
    }
  }

  if (!workspace.cvReady) {
    return (
      <section className="empty-state">
        <p className="section-label">CV source missing</p>
        <h2>Resume Studio needs a root-level <code>{workspace.cvPath}</code>.</h2>
        <p>
          The export script is available, but there is no markdown CV in{" "}
          <code>{workspace.careerOpsPath}</code> to tailor from yet.
        </p>
      </section>
    );
  }

  if (!reportBacked.length) {
    return (
      <section className="empty-state">
        <p className="section-label">No evaluated roles yet</p>
        <h2>The studio is ready, but there are no report-backed opportunities to tailor against.</h2>
        <p>
          Add tracker rows and generate evaluations first. As soon as a report
          exists, this page will expose keyword controls, preview content, and
          PDF export.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.studio}>
      <section className={styles.controls}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <p className="section-label">Source role</p>
            <h2>Choose the opportunity to tailor against.</h2>
          </div>

          <div className={styles.roleList}>
            {reportBacked.map((opportunity) => {
              const active = opportunity.id === selectedOpportunity?.id;

              return (
                <button
                  className={styles.roleCard}
                  data-active={active}
                  disabled={loadingId === opportunity.id}
                  key={opportunity.id}
                  onClick={() => void handleSelectOpportunity(opportunity.id)}
                  type="button"
                >
                  <strong>
                    {opportunity.company} · {opportunity.role}
                  </strong>
                  <p>
                    {typeof opportunity.score === "number"
                      ? opportunity.score.toFixed(1)
                      : opportunity.scoreRaw}
                    {" · "}
                    {opportunity.status}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <p className="section-label">Keyword tuning</p>
            <h2>Turn evidence-rich terms on or off before export.</h2>
          </div>

          <div className={styles.keywordList}>
            {(selectedEvaluation?.keywords.length
              ? selectedEvaluation.keywords
              : getDefaultResumeKeywords(
                  selectedOpportunity ?? reportBacked[0],
                  selectedEvaluation,
                )
            ).map((keyword) => {
              const active = selectedKeywords.includes(keyword);

              return (
                <button
                  className={styles.keyword}
                  data-active={active}
                  key={keyword}
                  onClick={() => toggleKeyword(keyword)}
                  type="button"
                >
                  {keyword}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <p className="section-label">Export settings</p>
            <h2>Keep the output close to the working draft.</h2>
          </div>

          <label className={styles.field}>
            <span>Paper format</span>
            <select
              className={styles.select}
              onChange={(event) => setFormat(event.target.value as "a4" | "letter")}
              value={format}
            >
              <option value="a4">A4</option>
              <option value="letter">US Letter</option>
            </select>
          </label>

          <div className={styles.metaBlock}>
            <p>
              Profile source:{" "}
              <strong>{workspace.profileReady ? "Loaded" : "Optional but missing"}</strong>
            </p>
            <p>
              Existing tracker PDF flag:{" "}
              <strong>{selectedOpportunity?.hasPdf ? "Present" : "Not yet"}</strong>
            </p>
          </div>

          <button
            className={styles.exportButton}
            disabled={!draft || exporting}
            onClick={() => void handleExport()}
            type="button"
          >
            {exporting ? "Rendering PDF..." : "Download tailored PDF"}
          </button>
        </div>
      </section>

      <section className={styles.previewPanel}>
        <div className={styles.previewHead}>
          <div>
            <p className="section-label">Live preview</p>
            <h2>{draft?.targetLabel ?? "Resume preview"}</h2>
          </div>
          <p className={styles.previewMeta}>
            {draft?.profileReady
              ? "Profile + CV + evaluation combined"
              : "CV + evaluation combined; profile enrichment is optional"}
          </p>
        </div>

        {draft ? (
          <div className={styles.previewSheet}>
            <header className={styles.previewHeader}>
              <h3>{profile?.candidate.fullName || cv?.name || "Candidate"}</h3>
              <p>{draft.headline}</p>
              <div className={styles.contactRow}>
                {draft.contactLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            </header>

            <section className={styles.previewSection}>
              <h4>Target summary</h4>
              <p>{draft.summary}</p>
            </section>

            <section className={styles.previewSection}>
              <h4>Focus keywords</h4>
              <div className={styles.keywordList}>
                {draft.focusKeywords.map((keyword) => (
                  <span className={styles.previewChip} key={keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
            </section>

            <section className={styles.previewSection}>
              <h4>Fit evidence</h4>
              <ul className={styles.previewList}>
                {draft.fitHighlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className={styles.previewSection}>
              <h4>Experience highlights</h4>
              <div className={styles.entryStack}>
                {draft.experienceHighlights.map((entry) => (
                  <article className={styles.entryCard} key={entry.heading + entry.subheading}>
                    <strong>{entry.heading}</strong>
                    <p>{entry.subheading}</p>
                    <ul className={styles.previewList}>
                      {entry.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.previewSection}>
              <h4>Selected projects</h4>
              <ul className={styles.previewList}>
                {draft.projectHighlights.map((project) => (
                  <li key={project.title}>
                    <strong>{project.title}</strong>
                    {project.description ? ` — ${project.description}` : ""}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.previewSection}>
              <h4>Skills emphasis</h4>
              <ul className={styles.previewList}>
                {draft.skillHighlights.map((group) => (
                  <li key={group.label}>
                    <strong>{group.label}:</strong> {group.items.join(", ")}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </section>
    </section>
  );
}
