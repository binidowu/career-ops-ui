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
        title: "Could not load that role",
        description:
          error instanceof Error
            ? error.message
            : "The selected role could not be loaded. Try again in a moment.",
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
        title: "Tailored PDF downloaded",
        description:
          "The file was built from the current preview and downloaded to your browser.",
        dismissAfter: 4000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      notify({
        title: "Could not export the PDF",
        description:
          error instanceof Error
            ? error.message
            : "The download did not finish. Check the export script and try again.",
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
          Add a markdown CV to <code>{workspace.careerOpsPath}</code> and this
          page will turn it into a role-specific draft and PDF.
        </p>
      </section>
    );
  }

  if (!reportBacked.length) {
    return (
      <section className="empty-state">
        <p className="section-label">No evaluated roles yet</p>
        <h2>There are no evaluated roles to tailor against yet.</h2>
        <p>
          Add tracker rows and generate at least one evaluation first. As soon
          as a report exists, this page will show the matching keywords, preview
          the tailored draft, and unlock PDF export.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.studio}>
      <section className={styles.controls}>
        <div className={styles.controlsShell}>
          <section className={styles.controlSection}>
            <div className={styles.panelHead}>
              <p className="section-label">Source role</p>
              <h2>Pick the role you want this resume to match.</h2>
            </div>
            <p className={styles.panelText}>
              Switching roles refreshes the summary, fit evidence, and keyword
              suggestions in the live preview.
            </p>

            <div className={styles.roleList}>
              {reportBacked.map((opportunity) => {
                const active = opportunity.id === selectedOpportunity?.id;

                return (
                  <button
                    aria-pressed={active}
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
          </section>

          <section className={styles.controlSection}>
            <div className={styles.panelHead}>
              <p className="section-label">Keyword tuning</p>
              <h2>Choose which role terms get woven into the draft.</h2>
            </div>
            <p className={styles.panelText}>
              Turn a term off to keep the resume broader. Turn it on to push it
              into the summary, highlights, and skills emphasis.
            </p>

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
                    aria-pressed={active}
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
          </section>

          <section className={styles.controlSection}>
            <div className={styles.panelHead}>
              <p className="section-label">Export settings</p>
              <h2>Choose the file you want to leave with.</h2>
            </div>
            <p className={styles.panelText}>
              The PDF uses the preview on the right. Change the role, keywords,
              or paper size here before you download it.
            </p>

            <label className={styles.field}>
              <span>Paper format</span>
              <select
                className={styles.select}
                onChange={(event) =>
                  setFormat(event.target.value as "a4" | "letter")
                }
                value={format}
              >
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
              </select>
            </label>

            <div className={styles.metaBlock}>
              <p>
                Profile details:{" "}
                <strong>{workspace.profileReady ? "Included" : "Missing but optional"}</strong>
              </p>
              <p>
                Tracker row already has a PDF:{" "}
                <strong>{selectedOpportunity?.hasPdf ? "Yes" : "No"}</strong>
              </p>
              <p>
                Selected keywords: <strong>{selectedKeywords.length}</strong>
              </p>
            </div>

            <button
              className={styles.exportButton}
              disabled={!draft || exporting}
              onClick={() => void handleExport()}
              type="button"
            >
              {exporting ? "Building PDF..." : "Download tailored PDF"}
            </button>
          </section>
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
              ? "Updates instantly as you switch roles, keywords, and paper size"
              : "Using the CV and evaluation now; profile details can still be added later"}
          </p>
        </div>

        {draft ? (
          <div className={styles.previewSheet}>
            <header className={styles.previewHeader}>
              <div className={styles.previewIdentity}>
                <h3>{profile?.candidate.fullName || cv?.name || "Candidate"}</h3>
                <p>{draft.headline}</p>
                <div className={styles.contactRow}>
                  {draft.contactLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              </div>

              <div className={styles.previewSignal}>
                <p className="section-label">Current export</p>
                <strong>{draft.targetLabel}</strong>
                <span>{draft.fileName}</span>
                <span>{draft.focusKeywords.length} keywords active in this draft</span>
              </div>
            </header>

            <div className={styles.previewGrid}>
              <div className={styles.previewMain}>
                <section className={styles.previewSection}>
                  <h4>Target summary</h4>
                  <p>{draft.summary}</p>
                </section>

                <section className={styles.previewSection}>
                  <h4>Experience highlights</h4>
                  <div className={styles.entryStack}>
                    {draft.experienceHighlights.map((entry) => (
                      <article
                        className={styles.entryCard}
                        key={entry.heading + entry.subheading}
                      >
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
              </div>

              <div className={styles.previewSide}>
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
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
