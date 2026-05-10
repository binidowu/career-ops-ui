"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import {
  type ResumeDraft,
  type ResumeDraftVariant,
} from "@/lib/resume-studio";
import type { Evaluation, Opportunity, ResumeSource, UserProfile } from "@/lib/types";

import styles from "./ResumeStudio.module.css";

interface ResumeStudioProps {
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
    resumePath: string;
    resumeReady: boolean;
    resumeSourceCount: number;
    resumeSourcesConfigured: number;
    trackerPath: string;
    trackerReady: boolean;
  };
}

const ZOOM_LEVELS = [75, 100, 125, 150] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

function normalizeRoleList(opportunities: Opportunity[]) {
  return opportunities
    .filter((o) => o.reportPath)
    .sort((l, r) => {
      const diff = (r.score ?? 0) - (l.score ?? 0);
      return diff !== 0 ? diff : r.date.localeCompare(l.date);
    });
}

function previewId(opportunity: Opportunity | null) {
  if (!opportunity) return "RSM-000";
  return `RSM-${opportunity.id.slice(-3).toUpperCase()}`;
}

function getDefaultResumeSourceId(profile: UserProfile | null) {
  const sources = profile?.resumeSources ?? [];
  return sources.find((source) => source.default)?.id ?? sources[0]?.id ?? "";
}

/* ── Override persistence helpers ── */

const OVERRIDES_PREFIX = "resume-overrides-";

interface StoredOverrides {
  headlineOverride: string;
  summaryOverride: string;
  expBulletOverrides: Record<number, string[]>;
}

const EMPTY_OVERRIDES: StoredOverrides = {
  headlineOverride: "",
  summaryOverride: "",
  expBulletOverrides: {},
};

function loadStoredOverrides(opportunityId: string): StoredOverrides {
  if (typeof window === "undefined") {
    return EMPTY_OVERRIDES;
  }
  try {
    const raw = localStorage.getItem(`${OVERRIDES_PREFIX}${opportunityId}`);
    if (!raw) return EMPTY_OVERRIDES;
    return JSON.parse(raw) as StoredOverrides;
  } catch {
    return EMPTY_OVERRIDES;
  }
}

function saveStoredOverrides(opportunityId: string, overrides: StoredOverrides) {
  try {
    localStorage.setItem(`${OVERRIDES_PREFIX}${opportunityId}`, JSON.stringify(overrides));
  } catch { /* quota errors are non-fatal */ }
}

function clearStoredOverrides(opportunityId: string) {
  try {
    localStorage.removeItem(`${OVERRIDES_PREFIX}${opportunityId}`);
  } catch { /* ignore */ }
}

function bulletMatches(text: string, keywords: string[]): boolean {
  if (!keywords.length) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => kw && lower.includes(kw.toLowerCase()));
}

function parseBulletsFromText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[\s—\-•]+/, "").trim())
    .filter(Boolean);
}

function formatBulletsAsText(bullets: string[]): string {
  return bullets.join("\n");
}

/* Pencil SVG icon */
function PencilIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ResumeStudio({
  initialEvaluation,
  initialOpportunity,
  opportunities,
  profile,
  workspace,
}: ResumeStudioProps) {
  const notify = useToast();
  const router = useRouter();
  const reportBacked = useMemo(() => normalizeRoleList(opportunities), [opportunities]);
  const configuredResumeSources = profile?.resumeSources ?? [];

  /* Core draft state */
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(initialOpportunity);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(initialEvaluation);
  const [selectedResumeSourceId, setSelectedResumeSourceId] = useState(
    getDefaultResumeSourceId(profile),
  );
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [format, setFormat] = useState<"a4" | "letter">("a4");
  const [tone, setTone] = useState(50);
  const [debouncedTone, setDebouncedTone] = useState(50);
  const toneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [variant, setVariant] = useState<ResumeDraftVariant>("balanced");
  const [headlineOverride, setHeadlineOverride] = useState("");
  const [summaryOverride, setSummaryOverride] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  const [draftResumeSource, setDraftResumeSource] = useState<ResumeSource | null>(null);
  const [draftRefreshKey, setDraftRefreshKey] = useState(0);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const manualRefreshPendingRef = useRef(false);

  const draftQuality = useMemo(() => {
    if (!draft) return null;
    const sections = [
      { label: "Contact", ok: draft.contactLines.length > 0 },
      { label: "Headline", ok: Boolean(draft.headline) },
      { label: "Summary", ok: Boolean(draft.summary) },
      { label: "Experience", ok: draft.experienceHighlights.length > 0 },
      { label: "Skills", ok: draft.skillHighlights.length > 0 },
    ];
    const filled = sections.filter((s) => s.ok).length;
    return { sections, filled, total: sections.length };
  }, [draft]);

  /* Canvas controls */
  const [zoom, setZoom] = useState<ZoomLevel>(100);
  const [matchedOnly, setMatchedOnly] = useState(false);

  /* Inline editing state */
  const [editing, setEditing] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [expBulletOverrides, setExpBulletOverrides] = useState<Record<number, string[]>>({});
  const [lastGeneratedSourceId, setLastGeneratedSourceId] = useState<string | null>(null);
  const editHandleRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!selectedOpportunity) {
      setHeadlineOverride("");
      setSummaryOverride("");
      setExpBulletOverrides({});
      return;
    }

    const stored = loadStoredOverrides(selectedOpportunity.id);
    setHeadlineOverride(stored.headlineOverride);
    setSummaryOverride(stored.summaryOverride);
    setExpBulletOverrides(stored.expBulletOverrides);
  }, [selectedOpportunity]);

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

      const stored = loadStoredOverrides(payload.opportunity.id);
      setVariant("balanced");
      setHeadlineOverride(stored.headlineOverride);
      setSummaryOverride(stored.summaryOverride);
      setExpBulletOverrides(stored.expBulletOverrides);
      setEditing(null);
      setLastGeneratedSourceId(null);
      setSelectedOpportunity(payload.opportunity);
      setSelectedEvaluation(payload.evaluation);
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

  function handleReset() {
    if (toneDebounceRef.current) clearTimeout(toneDebounceRef.current);
    if (selectedOpportunity) clearStoredOverrides(selectedOpportunity.id);
    setSelectedResumeSourceId(getDefaultResumeSourceId(profile));
    setSelectedKeywords(draft?.focusKeywords ?? []);
    setTone(50);
    setDebouncedTone(50);
    setFormat("a4");
    setVariant("balanced");
    setHeadlineOverride("");
    setSummaryOverride("");
    setExpBulletOverrides({});
    setEditing(null);
  }

  function handleRegenerate() {
    manualRefreshPendingRef.current = true;
    setEditing(null);
    setDraftRefreshKey((current) => current + 1);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDraft() {
      if (!selectedOpportunity) {
        setDraft(null);
        setDraftResumeSource(null);
        setSelectedKeywords([]);
        return;
      }

      setDraftLoading(true);

      try {
        const response = await fetch("/api/resumes/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opportunityId: selectedOpportunity.id,
            resumeSourceId: selectedResumeSourceId || undefined,
            format,
            tone: debouncedTone,
            variant,
          }),
        });
        const data = (await response.json()) as {
          draft?: ResumeDraft;
          error?: string;
          resumeSource?: ResumeSource;
        };

        if (!response.ok || !data.draft) {
          throw new Error(data.error ?? "Unable to generate the resume draft.");
        }

        if (cancelled) {
          return;
        }

        setDraft(data.draft);
        setDraftResumeSource(data.resumeSource ?? null);
        setLastGeneratedSourceId(selectedResumeSourceId || null);
        setSelectedKeywords(data.draft.focusKeywords);
        setLastGeneratedAt(
          new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
          }),
        );

        if (manualRefreshPendingRef.current) {
          manualRefreshPendingRef.current = false;
          notify({
            title: "Draft regenerated",
            description: `Fresh ${data.draft.variantLabel.toLowerCase()} draft${data.resumeSource?.label ? ` from ${data.resumeSource.label}` : ""}. Your inline edits are preserved — use Reset Baseline to clear them.`,
            dismissAfter: 4000,
          });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        manualRefreshPendingRef.current = false;
        setDraft(null);
        setDraftResumeSource(null);
        setSelectedKeywords([]);
        notify({
          title: "Draft generation failed",
          description:
            error instanceof Error ? error.message : "Unable to reach the backend draft generator.",
          tone: "error",
          dismissAfter: null,
        });
      } finally {
        if (!cancelled) {
          setDraftLoading(false);
        }
      }
    }

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [debouncedTone, format, notify, selectedOpportunity, selectedResumeSourceId, variant, draftRefreshKey]);

  /* Open a section for inline editing */
  function openEditor(key: string, initialText: string) {
    setEditing(key);
    setEditBuffer(initialText);
  }

  function closeEditor(key: string) {
    setEditing(null);
    setEditBuffer("");
    editHandleRefs.current.get(key)?.focus();
  }

  function saveEdit(key: string) {
    const text = editBuffer.trim();
    if (!selectedOpportunity) { closeEditor(key); return; }

    if (key === "summary") {
      setSummaryOverride(text);
      saveStoredOverrides(selectedOpportunity.id, {
        headlineOverride,
        summaryOverride: text,
        expBulletOverrides,
      });
    } else if (key === "headline") {
      setHeadlineOverride(text);
      saveStoredOverrides(selectedOpportunity.id, {
        headlineOverride: text,
        summaryOverride,
        expBulletOverrides,
      });
    } else if (key.startsWith("experience-")) {
      const idx = parseInt(key.replace("experience-", ""), 10);
      if (!Number.isNaN(idx)) {
        const next = { ...expBulletOverrides, [idx]: parseBulletsFromText(text) };
        setExpBulletOverrides(next);
        saveStoredOverrides(selectedOpportunity.id, {
          headlineOverride,
          summaryOverride,
          expBulletOverrides: next,
        });
      }
    }
    closeEditor(key);
  }

  function cancelEdit(key: string) {
    closeEditor(key);
  }

  async function handleExport() {
    if (!selectedOpportunity) return;
    setExporting(true);

    try {
      const expOverrides = Object.entries(expBulletOverrides).map(([i, bullets]) => ({
        index: Number(i),
        bullets,
      }));

      const response = await fetch("/api/resumes/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: selectedOpportunity.id,
          resumeSourceId: selectedResumeSourceId || undefined,
          format,
          selectedKeywords,
          tone,
          variant,
          headlineOverride,
          summaryOverride,
          experienceOverrides: expOverrides,
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
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      notify({
        title: "Asset compiled",
        description: "The tailored PDF was built from the current preview and downloaded.",
        dismissAfter: 4000,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      notify({
        title: "Export failed",
        description:
          error instanceof Error ? error.message : "Check the export script and try again.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setExporting(false);
    }
  }

  if (!workspace.resumeReady) {
    return (
      <section className="empty-state">
        <p className="section-label">Resume source missing</p>
        <h2>
          Resume Studio needs either <code>{workspace.cvPath}</code> or an uploaded resume source.
        </h2>
        <p>
          Add a markdown CV to <code>{workspace.careerOpsPath}</code> or upload one in settings.
          The backend draft generator will then tailor it to each job report and unlock PDF export.
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
          this page will show the matching keywords, preview the tailored draft, and unlock PDF
          export.
        </p>
      </section>
    );
  }

  /* Personalization suggestions from evaluation, keyed by section name */
  const personalizationMap: Record<string, string> = {};
  for (const item of selectedEvaluation?.personalizationItems ?? []) {
    if (item.section && item.proposedChange) {
      personalizationMap[item.section.toLowerCase()] = item.proposedChange;
    }
  }

  const hasEdits = Boolean(
    headlineOverride || summaryOverride || Object.keys(expBulletOverrides).length,
  );

  return (
    <section className={styles.studio}>
      {/* ── LEFT SIDEBAR ── */}
      <aside className={styles.controls}>
        <div className={styles.controlsShell}>
          {/* TARGET ROLE */}
          <section className={styles.controlSection}>
            <div className={styles.panelHead}>
              <p className={styles.sectionLabel}>Target Role</p>
              <p className={styles.panelText}>
                Select the evaluated role to tailor this resume against. Switching roles refreshes
                the backend draft and live preview.
              </p>
            </div>
            <select
              className={styles.archetypeSelect}
              disabled={!!loadingId || draftLoading}
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

          {configuredResumeSources.length > 0 && (
            <section className={styles.controlSection}>
              <div className={styles.panelHead}>
                <p className={styles.sectionLabel}>Resume Source</p>
                <p className={styles.panelText}>
                  Choose which base resume the backend should tailor for this job description.
                </p>
              </div>
              <select
                className={styles.archetypeSelect}
                disabled={draftLoading}
                onChange={(e) => setSelectedResumeSourceId(e.target.value)}
                value={selectedResumeSourceId}
              >
                {configuredResumeSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.label}{source.default ? " (default)" : ""}
                  </option>
                ))}
              </select>
              {(() => {
                const selected = configuredResumeSources.find((s) => s.id === selectedResumeSourceId);
                const mismatch = lastGeneratedSourceId !== null && lastGeneratedSourceId !== selectedResumeSourceId;
                return (
                  <>
                    {mismatch && (
                      <p className={styles.sourceMismatch}>
                        Source changed —{" "}
                        <button
                          className={styles.sourceMismatchAction}
                          onClick={handleRegenerate}
                          type="button"
                        >
                          regenerate to apply
                        </button>
                      </p>
                    )}
                    {selected?.targetRoles?.length ? (
                      <p className={styles.sourceRoles}>
                        Targets: {selected.targetRoles.join(", ")}
                      </p>
                    ) : null}
                    {selected?.originalPath ? (
                      <p className={styles.sourceRoles}>
                        Original: {selected.originalPath}
                      </p>
                    ) : null}
                    {selected?.extractionDiagnostics?.length ? (
                      <div className={styles.sourceRoles}>
                        {selected.extractionDiagnostics.map((diagnostic, index) => (
                          <p key={`${diagnostic.code}-${index}`}>
                            {diagnostic.severity === "warning" ? "Warning" : "Parsed"}:{" "}
                            {diagnostic.message}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </section>
          )}

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
              aria-label="Tone calibration"
              className={styles.toneSlider}
              max={100}
              min={0}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTone(v);
                if (toneDebounceRef.current) clearTimeout(toneDebounceRef.current);
                toneDebounceRef.current = setTimeout(() => setDebouncedTone(v), 350);
              }}
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

          {/* OUTPUT FORMAT */}
          <section className={styles.controlSection}>
            <div className={styles.panelHead}>
              <p className={styles.sectionLabel}>Output Format</p>
            </div>
            <div className={styles.kvList}>
              {([
                ["Paper Size", format === "a4" ? "A4" : "US Letter"],
                ["Draft Angle", draft?.variantLabel ?? "Balanced emphasis"],
                ["Profile", workspace.profileReady ? "Included" : "Missing"],
                ["Keywords active", String(selectedKeywords.length)],
              ] as const).map(([k, v]) => (
                <div key={k} className={styles.kvRow}>
                  <span className={styles.kvLabel}>{k}</span>
                  <span className={styles.kvValue}>{v}</span>
                </div>
              ))}
            </div>
            <div className={styles.formatControls}>
              <select
                className={styles.select}
                onChange={(e) => setFormat(e.target.value as "a4" | "letter")}
                value={format}
              >
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
              </select>
              <select
                className={styles.select}
                onChange={(e) => setVariant(e.target.value as ResumeDraftVariant)}
                value={variant}
              >
                <option value="balanced">Balanced</option>
                <option value="technical">Technical</option>
                <option value="execution">Execution</option>
              </select>
            </div>
          </section>

          {/* MANUAL EDITS */}
          <section className={styles.controlSection}>
            <div className={styles.panelHead}>
              <p className={styles.sectionLabel}>Manual Edits</p>
              <p className={styles.panelText}>
                Override the generated headline or summary. You can also click the pencil icon
                on any section in the preview to edit it inline.
              </p>
            </div>
            <label className={styles.field}>
              <span>Headline</span>
              <input
                className={styles.textInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setHeadlineOverride(value);
                  if (selectedOpportunity) {
                    saveStoredOverrides(selectedOpportunity.id, {
                      headlineOverride: value,
                      summaryOverride,
                      expBulletOverrides,
                    });
                  }
                }}
                placeholder={draft?.headline ?? "Generated headline"}
                type="text"
                value={headlineOverride}
              />
            </label>
            <label className={styles.field}>
              <span>Summary</span>
              <textarea
                className={styles.textArea}
                onChange={(e) => {
                  const value = e.target.value;
                  setSummaryOverride(value);
                  if (selectedOpportunity) {
                    saveStoredOverrides(selectedOpportunity.id, {
                      headlineOverride,
                      summaryOverride: value,
                      expBulletOverrides,
                    });
                  }
                }}
                placeholder={draft?.summary ?? "Generated summary"}
                rows={5}
                value={summaryOverride}
              />
            </label>
          </section>
        </div>

        {/* FOOTER */}
        <div className={styles.controlsFooter}>
          <button
            className={styles.exportButton}
            disabled={!draft || draftLoading || exporting}
            onClick={() => void handleExport()}
            type="button"
          >
            {exporting ? "Compiling…" : "Compile Asset"}
          </button>
          <button
            className={styles.secondaryButton}
            disabled={!selectedOpportunity || draftLoading}
            onClick={handleRegenerate}
            type="button"
          >
            {draftLoading ? "Regenerating…" : "Regenerate Draft"}
          </button>
          <button className={styles.resetButton} onClick={handleReset} type="button">
            Reset Baseline
          </button>
        </div>
      </aside>

      {/* ── RIGHT CANVAS PANEL ── */}
      <section className={styles.previewPanel}>
        {/* Header bar */}
        <div className={styles.previewHead}>
          <div className={styles.previewStatus}>
            <div className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              Live Rendering
            </div>
            <span className={styles.previewId}>{previewId(selectedOpportunity)}</span>
            {draft ? <span className={styles.previewVariant}>{draft.variantLabel}</span> : null}
            {draftQuality ? (
              <span
                className={styles.qualityBadge}
                data-full={draftQuality.filled === draftQuality.total}
                title={draftQuality.sections
                  .map((s) => `${s.ok ? "✓" : "✗"} ${s.label}`)
                  .join("  ·  ")}
              >
                {draftQuality.filled}/{draftQuality.total} sections
              </span>
            ) : null}
            {hasEdits && (
              <span className={styles.editsIndicator} title="You have unsaved inline edits. Use Reset Baseline to clear them.">
                Edited
              </span>
            )}
          </div>

          {/* Zoom controls */}
          <div className={styles.zoomControls}>
            {ZOOM_LEVELS.map((level) => (
              <button
                className={styles.zoomBtn}
                data-active={zoom === level}
                key={level}
                onClick={() => setZoom(level)}
                type="button"
              >
                {level}%
              </button>
            ))}
          </div>

          <p className={styles.previewMeta}>
            {draftLoading
              ? "Refreshing the backend-tailored draft…"
              : lastGeneratedAt
                ? `Last regenerated at ${lastGeneratedAt}`
              : draft?.profileReady
                ? "Hover any section to edit inline"
                : "Using resume source and evaluation — profile details can be added later"}
          </p>
        </div>

        {/* Canvas body */}
        <div className={styles.previewBody}>
          {draft ? (
            <div
              className={styles.sheetScaler}
              style={{ transform: `scale(${zoom / 100})`, marginBottom: `calc((${zoom / 100} - 1) * 11in)` }}
            >
              <div className={styles.docSheet}>
                {/* DOCUMENT HEADER */}
                <header className={styles.docHeader}>
                  <div className={styles.editableZone}>
                    <div className={styles.docIdentity}>
                      <h1 className={styles.docName}>{draft.name}</h1>
                      {draft.headline && (
                        <p className={styles.docTitle}>{headlineOverride || draft.headline}</p>
                      )}
                    </div>
                    <button
                      aria-label="Edit headline"
                      className={styles.editHandle}
                      onClick={() => openEditor("headline", headlineOverride || draft.headline)}
                      ref={(el) => {
                        if (el) editHandleRefs.current.set("headline", el);
                        else editHandleRefs.current.delete("headline");
                      }}
                      type="button"
                    >
                      <PencilIcon />
                    </button>
                    {editing === "headline" && (
                      <div>
                        <input
                          autoFocus
                          className={styles.inlineEditor}
                          style={{ minHeight: "2.5rem" }}
                          onChange={(e) => setEditBuffer(e.target.value)}
                          value={editBuffer}
                        />
                        <div className={styles.inlineEditorActions}>
                          <button className={styles.inlineEditorCancel} onClick={() => cancelEdit("headline")} type="button">Cancel</button>
                          <button className={styles.inlineEditorSave} onClick={() => saveEdit("headline")} type="button">Apply</button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={styles.docContact}>
                    {draft.contactLines.map((line) => {
                      const isEmail = line.includes("@");
                      const isLink =
                        line.includes("github.com") ||
                        line.includes("linkedin.com") ||
                        line.startsWith("http");
                      const href = isEmail
                        ? `mailto:${line}`
                        : isLink
                          ? line.startsWith("http")
                            ? line
                            : `https://${line}`
                          : undefined;
                      return href ? (
                        <a href={href} key={line} rel="noreferrer" target="_blank">
                          {line}
                        </a>
                      ) : (
                        <span key={line}>{line}</span>
                      );
                    })}
                  </div>
                </header>

                {/* DRAFT DIAGNOSTICS — shown when backend emits notes */}
                {draft.notes.length > 0 && (
                  <details className={styles.draftNotes}>
                    <summary className={styles.draftNotesSummary}>
                      Draft diagnostics ({draft.notes.length})
                    </summary>
                    <ul className={styles.draftNotesList}>
                      {draft.notes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* PROFESSIONAL SYNOPSIS */}
                {draft.summary ? (
                  <div className={styles.docSection}>
                    <span className={styles.docSectionLabel}>Professional Synopsis</span>
                    <div className={styles.editableZone}>
                      <p className={styles.docSectionBody}>
                        {summaryOverride || draft.summary}
                      </p>
                      <button
                        aria-label="Edit summary"
                        className={styles.editHandle}
                        onClick={() => openEditor("summary", summaryOverride || draft.summary)}
                        ref={(el) => {
                          if (el) editHandleRefs.current.set("summary", el);
                          else editHandleRefs.current.delete("summary");
                        }}
                        type="button"
                      >
                        <PencilIcon />
                      </button>
                      {editing === "summary" && (
                        <div>
                          <textarea
                            autoFocus
                            className={styles.inlineEditor}
                            onChange={(e) => setEditBuffer(e.target.value)}
                            rows={5}
                            value={editBuffer}
                          />
                          <div className={styles.inlineEditorActions}>
                            <button className={styles.inlineEditorCancel} onClick={() => cancelEdit("summary")} type="button">Cancel</button>
                            <button className={styles.inlineEditorSave} onClick={() => saveEdit("summary")} type="button">Apply</button>
                          </div>
                        </div>
                      )}
                      {personalizationMap["summary"] && editing !== "summary" && (
                        <button
                          className={styles.suggestionChip}
                          onClick={() => {
                            setSummaryOverride(personalizationMap["summary"] ?? "");
                          }}
                          type="button"
                        >
                          AI suggestion — click to apply
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={styles.docSection}>
                    <span className={styles.docSectionLabel}>Professional Synopsis</span>
                    <p className={styles.emptySectionHint}>
                      No summary generated — add a professional summary to your resume source.
                    </p>
                  </div>
                )}

                {/* EXPERIENCE VECTOR */}
                {draft.experienceHighlights.length > 0 && (
                  <div className={styles.docSection}>
                    <span className={styles.docSectionLabel}>Experience Vector</span>
                    <div className={styles.docEntryList}>
                      {draft.experienceHighlights.map((entry, index) => {
                        const expKey = `experience-${index}`;
                        const overriddenBullets = expBulletOverrides[index] ?? entry.bullets;
                        const displayBullets = matchedOnly
                          ? overriddenBullets.filter((b) => bulletMatches(b, selectedKeywords))
                          : overriddenBullets;

                        return (
                          <article className={styles.docEntry} key={entry.heading + entry.subheading}>
                            <div className={styles.docEntryHead}>
                              <span className={styles.docEntryTitle}>
                                {(() => {
                                  const subParts = entry.subheading.split(" · ");
                                  const role = subParts[0] ?? "";
                                  return (
                                    <>
                                      <strong>{role}</strong>
                                      {" | "}
                                      <span>{entry.heading}</span>
                                    </>
                                  );
                                })()}
                              </span>
                              <span className={styles.docEntryDate}>
                                {(() => {
                                  const subParts = entry.subheading.split(" · ");
                                  return subParts.length > 1 ? subParts[subParts.length - 1] : "";
                                })()}
                              </span>
                            </div>

                            <div className={styles.editableZone}>
                              <ul className={styles.docBulletList}>
                                {displayBullets.map((bullet) => {
                                  const matched = bulletMatches(bullet, selectedKeywords);
                                  return (
                                    <li
                                      className={`${styles.docBulletItem} ${matched ? styles.bulletMatched : styles.bulletUnmatched}`}
                                      key={bullet}
                                    >
                                      {matched && selectedKeywords.length > 0 && (
                                        <span className={styles.matchDot} aria-hidden="true" />
                                      )}
                                      {bullet}
                                    </li>
                                  );
                                })}
                              </ul>

                              <button
                                aria-label="Edit bullets"
                                className={styles.editHandle}
                                onClick={() =>
                                  openEditor(expKey, formatBulletsAsText(overriddenBullets))
                                }
                                ref={(el) => {
                                  if (el) editHandleRefs.current.set(expKey, el);
                                  else editHandleRefs.current.delete(expKey);
                                }}
                                type="button"
                              >
                                <PencilIcon />
                              </button>

                              {editing === expKey && (
                                <div>
                                  <textarea
                                    autoFocus
                                    className={styles.inlineEditor}
                                    onChange={(e) => setEditBuffer(e.target.value)}
                                    placeholder="One bullet per line"
                                    rows={Math.max(4, overriddenBullets.length + 1)}
                                    value={editBuffer}
                                  />
                                  <div className={styles.inlineEditorActions}>
                                    <button className={styles.inlineEditorCancel} onClick={() => cancelEdit(expKey)} type="button">Cancel</button>
                                    <button className={styles.inlineEditorSave} onClick={() => saveEdit(expKey)} type="button">Apply</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PROJECT LEDGER */}
                {draft.projectHighlights.length > 0 && (
                  <div className={styles.docSection}>
                    <span className={styles.docSectionLabel}>Project Ledger</span>
                    <div className={styles.docProjectList}>
                      {draft.projectHighlights.map((project) => (
                        <p className={styles.docProjectItem} key={project.title}>
                          <strong>{project.title}</strong>
                          {project.description ? ` — ${project.description}` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* EDUCATION */}
                {draft.educationHighlights.length > 0 && (
                  <div className={styles.docSection}>
                    <span className={styles.docSectionLabel}>Education</span>
                    <div className={styles.docEducationList}>
                      {draft.educationHighlights.map((entry) => (
                        <p className={styles.docEducationItem} key={entry}>
                          {entry}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* TECHNICAL ONTOLOGY — 3-column skills grid */}
                {draft.skillHighlights.length > 0 && (
                  <div className={styles.docSection}>
                    <span className={styles.docSectionLabel}>Technical Ontology</span>
                    <div className={styles.docOntologyGrid}>
                      {draft.skillHighlights.map((group) => (
                        <div className={styles.docOntologyGroup} key={group.label}>
                          <span className={styles.docOntologyGroupLabel}>{group.label}</span>
                          <p className={styles.docOntologyGroupItems}>{group.items.join(", ")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.previewEmpty}>
              <p className={styles.sectionLabel}>Draft preview</p>
              <h2>Choose a report-backed role to generate a tailored resume.</h2>
              <p>
                The preview will appear here once the backend assembles the draft from your selected
                resume source and the job evaluation report.
              </p>
            </div>
          )}
        </div>

        {/* Floating zoom controls */}
        <div className={styles.floatingZoom}>
          <button
            className={styles.floatingZoomBtn}
            onClick={() => setZoom((z) => (Math.max(75, z - 25) as ZoomLevel))}
            type="button"
          >
            −
          </button>
          <span className={styles.floatingZoomLabel}>{zoom}%</span>
          <button
            className={styles.floatingZoomBtn}
            onClick={() => setZoom((z) => (Math.min(150, z + 25) as ZoomLevel))}
            type="button"
          >
            +
          </button>
        </div>
      </section>
    </section>
  );
}
