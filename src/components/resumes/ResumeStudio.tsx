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
      if (scoreDifference !== 0) return scoreDifference;
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
  if (!cv || !opportunity) return null;
  return buildResumeDraft({ cv, profile, opportunity, evaluation, format, selectedKeywords });
}

function previewId(opportunity: Opportunity | null) {
  if (!opportunity) return "RSM-000";
  return `RSM-${opportunity.id.slice(-3).toUpperCase()}`;
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

  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(initialOpportunity);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(initialEvaluation);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(
    initialOpportunity ? getDefaultResumeKeywords(initialOpportunity, initialEvaluation) : [],
  );
  const [format, setFormat] = useState<"a4" | "letter">("a4");
  const [tone, setTone] = useState(50);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const draft = useMemo(
    () => draftFrom(cv, profile, selectedOpportunity, selectedEvaluation, format, selectedKeywords),
    [cv, format, profile, selectedEvaluation, selectedKeywords, selectedOpportunity],
  );

  const allKeywords = selectedEvaluation?.keywords.length
    ? selectedEvaluation.keywords
    : getDefaultResumeKeywords(selectedOpportunity ?? reportBacked[0], selectedEvaluation);

  async function handleSelectOpportunity(id: string) {
    const next = reportBacked.find((o) => o.id === id);
    if (!next || selectedOpportunity?.id === id) return;

    setLoadingId(id);
    try {
      const response = await fetch(`/api/opportunities/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load report-backed opportunity.");

      const payload = (await response.json()) as {
        evaluation: Evaluation | null;
        opportunity: Opportunity;
      };

      setSelectedOpportunity(payload.opportunity);
      setSelectedEvaluation(payload.evaluation);
      setSelectedKeywords(getDefaultResumeKeywords(payload.opportunity, payload.evaluation));
    } catch (error) {
      notify({
        title: "Could not load that role",
        description: error instanceof Error ? error.message : "Try again in a moment.",
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
        ? current.filter((k) => k !== keyword)
        : [...current, keyword],
    );
  }

  function handleReset() {
    const base = getDefaultResumeKeywords(selectedOpportunity ?? reportBacked[0], selectedEvaluation);
    setSelectedKeywords(base);
    setTone(50);
    setFormat("a4");
  }

  async function handleExport() {
    if (!selectedOpportunity) return;
    setExporting(true);

    try {
      const response = await fetch("/api/resumes/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: selectedOpportunity.id, format, selectedKeywords }),
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
        title: "Asset compiled",
        description: "The tailored PDF was built from the current preview and downloaded.",
        dismissAfter: 4000,
      });

      startTransition(() => { router.refresh(); });
    } catch (error) {
      notify({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Check the export script and try again.",
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
          Add a markdown CV to <code>{workspace.careerOpsPath}</code> and this page will turn it
          into a role-specific draft and PDF.
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
          Add tracker rows and generate at least one evaluation first. As soon as a report exists,
          this page will show the matching keywords, preview the tailored draft, and unlock PDF export.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.studio}>
      {/* LEFT SIDEBAR */}
      <aside className={styles.controls}>
        <div className={styles.controlsShell}>

          {/* ARCHETYPE — role selection */}
          <section className={styles.controlSection}>
            <div className={styles.panelHead}>
              <p className={styles.sectionLabel}>Target Role</p>
              <p className={styles.panelText}>
                Select the evaluated role to tailor this resume against. Switching roles
                refreshes keywords and the live preview.
              </p>
            </div>
            <select
              className={styles.archetypeSelect}
              disabled={!!loadingId}
              onChange={(e) => void handleSelectOpportunity(e.target.value)}
              value={selectedOpportunity?.id ?? ""}
            >
              {reportBacked.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.company} · {o.role}
                </option>
              ))}
            </select>
          </section>

          {/* TONE CALIBRATION */}
          <section className={styles.controlSection}>
            <div className={styles.panelHead}>
              <p className={styles.sectionLabel}>Tone Calibration</p>
              <p className={styles.panelText}>
                Slide to adjust the language register — from clinical precision to confident
                assertiveness.
              </p>
            </div>
            <div className={styles.toneRow}>
              <span className={styles.toneValue}>{tone}</span>
            </div>
            <input
              className={styles.toneSlider}
              max={100}
              min={0}
              onChange={(e) => setTone(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, var(--color-text) 0%, var(--color-text) ${tone}%, var(--color-border) ${tone}%, var(--color-border) 100%)`,
              }}
              type="range"
              value={tone}
            />
            <div className={styles.toneExtremes}>
              <span>Clinical</span>
              <span>Assertive</span>
            </div>
          </section>

          {/* LEXICON — keyword chips */}
          <section className={styles.controlSection}>
            <div className={styles.panelHead}>
              <div className={styles.lexiconHeader}>
                <p className={styles.sectionLabel}>Lexicon</p>
                <span className={styles.lexiconCount}>
                  {selectedKeywords.length}/{allKeywords.length}
                </span>
              </div>
              <p className={styles.panelText}>
                Toggle terms to control which role keywords get woven into the draft.
              </p>
            </div>
            <div className={styles.keywordList}>
              {allKeywords.map((keyword) => {
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

          {/* FORMAT */}
          <section className={styles.controlSection}>
            <div className={styles.panelHead}>
              <p className={styles.sectionLabel}>Output Format</p>
            </div>
            <label className={styles.field}>
              <span>Paper size</span>
              <select
                className={styles.select}
                onChange={(e) => setFormat(e.target.value as "a4" | "letter")}
                value={format}
              >
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
              </select>
            </label>
            <div className={styles.metaBlock}>
              <p>Profile: <strong>{workspace.profileReady ? "Included" : "Optional / missing"}</strong></p>
              <p>Existing PDF: <strong>{selectedOpportunity?.hasPdf ? "Yes" : "No"}</strong></p>
              <p>Active keywords: <strong>{selectedKeywords.length}</strong></p>
            </div>
          </section>
        </div>

        {/* SIDEBAR FOOTER */}
        <div className={styles.controlsFooter}>
          <button
            className={styles.exportButton}
            disabled={!draft || exporting}
            onClick={() => void handleExport()}
            type="button"
          >
            {exporting ? "Compiling…" : "Compile Asset"}
          </button>
          <button
            className={styles.resetButton}
            onClick={handleReset}
            type="button"
          >
            Reset Baseline
          </button>
        </div>
      </aside>

      {/* RIGHT PREVIEW PANEL */}
      <section className={styles.previewPanel}>
        <div className={styles.previewHead}>
          <div className={styles.previewStatus}>
            <div className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              Live Rendering
            </div>
            <span className={styles.previewId}>{previewId(selectedOpportunity)}</span>
          </div>
          <p className={styles.previewMeta}>
            {draft?.profileReady
              ? "Updates instantly as you change roles, keywords, and format"
              : "Using CV and evaluation — profile details can be added later"}
          </p>
        </div>

        <div className={styles.previewBody}>
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
                  <p>Current export</p>
                  <strong>{draft.targetLabel}</strong>
                  <span>{draft.fileName}</span>
                  <span>{draft.focusKeywords.length} keywords active</span>
                </div>
              </header>

              <div className={styles.previewGrid}>
                <div>
                  <section className={styles.previewSection}>
                    <h4>Target summary</h4>
                    <p>{draft.summary}</p>
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
                </div>

                <div>
                  <section className={styles.previewSection}>
                    <h4>Focus keywords</h4>
                    <div className={styles.keywordList}>
                      {draft.focusKeywords.map((keyword) => (
                        <span className={styles.previewChip} key={keyword}>{keyword}</span>
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
        </div>
      </section>
    </section>
  );
}
