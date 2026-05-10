"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import {
  type ResumeDraft,
  type ResumeDraftVariant,
} from "@/lib/resume-studio";
import type {
  Evaluation,
  Opportunity,
  ResumeDocument,
  ResumeEvidenceDiagnostic,
  ResumeEvidenceSummary,
  ResumeRewriteResult,
  ResumeSource,
  ResumeStrategy,
  UserProfile,
} from "@/lib/types";

import { ResumeDiagnosticsPanel } from "./ResumeDiagnosticsPanel";
import { ResumeEvidencePanel } from "./ResumeEvidencePanel";
import { ResumeStrategyPanel } from "./ResumeStrategyPanel";

import legacyStyles from "./ResumeStudio.module.css";
import v2Styles from "./ResumeStudioV2.module.css";

/* ── Types ── */

interface ResumeStudioV2Props {
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

type RightRailTab = "strategy" | "evidence" | "diagnostics";

const ZOOM_LEVELS = [75, 100, 125, 150] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

/* ── Helpers ── */

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

/* ── Override persistence ── */

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
  if (typeof window === "undefined") return EMPTY_OVERRIDES;
  try {
    const raw = localStorage.getItem(`${OVERRIDES_PREFIX}${opportunityId}`);
    return raw ? (JSON.parse(raw) as StoredOverrides) : EMPTY_OVERRIDES;
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
  try { localStorage.removeItem(`${OVERRIDES_PREFIX}${opportunityId}`); } catch { /* ignore */ }
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

/* ── Component ── */

export default function ResumeStudioV2({
  initialEvaluation,
  initialOpportunity,
  opportunities,
  profile,
  workspace,
}: ResumeStudioV2Props) {
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

  /* V2 data from backend */
  const [strategy, setStrategy] = useState<ResumeStrategy | undefined>(undefined);
  const [evidenceSummary, setEvidenceSummary] = useState<ResumeEvidenceSummary | undefined>(undefined);
  const [evidenceDiagnostics, setEvidenceDiagnostics] = useState<ResumeEvidenceDiagnostic[]>([]);
  const [resumeDocument, setResumeDocument] = useState<ResumeDocument | undefined>(undefined);
  const [rewrite, setRewrite] = useState<ResumeRewriteResult | undefined>(undefined);

  /* Right rail */
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>("strategy");

  const diagnosticCount =
    (resumeDocument?.diagnostics?.length ?? 0) + (rewrite && rewrite.status !== "skipped" ? 1 : 0);

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

  const hasEdits = Boolean(
    headlineOverride || summaryOverride || Object.keys(expBulletOverrides).length,
  );

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
        setStrategy(undefined);
        setEvidenceSummary(undefined);
        setEvidenceDiagnostics([]);
        setResumeDocument(undefined);
        setRewrite(undefined);
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
          document?: ResumeDocument;
          evidence?: { items: unknown[]; diagnostics: ResumeEvidenceDiagnostic[] };
          evidenceSummary?: ResumeEvidenceSummary;
          strategy?: ResumeStrategy;
          rewrite?: ResumeRewriteResult;
          error?: string;
          resumeSource?: ResumeSource;
        };

        if (!response.ok || !data.draft) {
          throw new Error(data.error ?? "Unable to generate the resume draft.");
        }

        if (cancelled) return;

        setDraft(data.draft);
        setDraftResumeSource(data.resumeSource ?? null);
        setLastGeneratedSourceId(selectedResumeSourceId || null);
        setSelectedKeywords(data.draft.focusKeywords);
        setStrategy(data.strategy);
        setEvidenceSummary(data.evidenceSummary);
        setEvidenceDiagnostics(data.evidence?.diagnostics ?? []);
        setResumeDocument(data.document);
        setRewrite(data.rewrite);
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
            description: `Fresh ${data.draft.variantLabel.toLowerCase()} draft${data.resumeSource?.label ? ` from ${data.resumeSource.label}` : ""}. Your inline edits are preserved.`,
            dismissAfter: 4000,
          });
        }
      } catch (error) {
        if (cancelled) return;

        manualRefreshPendingRef.current = false;
        setDraft(null);
        setDraftResumeSource(null);
        setSelectedKeywords([]);
        setStrategy(undefined);
        setEvidenceSummary(undefined);
        setEvidenceDiagnostics([]);
        setResumeDocument(undefined);
        setRewrite(undefined);
        notify({
          title: "Draft generation failed",
          description:
            error instanceof Error ? error.message : "Unable to reach the backend draft generator.",
          tone: "error",
          dismissAfter: null,
        });
      } finally {
        if (!cancelled) setDraftLoading(false);
      }
    }

    void loadDraft();
    return () => { cancelled = true; };
  }, [debouncedTone, format, notify, selectedOpportunity, selectedResumeSourceId, variant, draftRefreshKey]);

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
      saveStoredOverrides(selectedOpportunity.id, { headlineOverride, summaryOverride: text, expBulletOverrides });
    } else if (key === "headline") {
      setHeadlineOverride(text);
      saveStoredOverrides(selectedOpportunity.id, { headlineOverride: text, summaryOverride, expBulletOverrides });
    } else if (key.startsWith("experience-")) {
      const idx = parseInt(key.replace("experience-", ""), 10);
      if (!Number.isNaN(idx)) {
        const next = { ...expBulletOverrides, [idx]: parseBulletsFromText(text) };
        setExpBulletOverrides(next);
        saveStoredOverrides(selectedOpportunity.id, { headlineOverride, summaryOverride, expBulletOverrides: next });
      }
    }
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

  /* ── Empty states ── */

  if (!workspace.resumeReady) {
    return (
      <section className="empty-state">
        <p className="section-label">Resume source missing</p>
        <h2>
          Resume Studio needs either <code>{workspace.cvPath}</code> or an uploaded resume source.
        </h2>
        <p>
          Add a markdown CV to <code>{workspace.careerOpsPath}</code> or upload one in settings.
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
          Add tracker rows and generate at least one evaluation first, then come back here to tailor
          and export your resume.
        </p>
      </section>
    );
  }

  /* Personalization suggestions from evaluation */
  const personalizationMap: Record<string, string> = {};
  for (const item of selectedEvaluation?.personalizationItems ?? []) {
    if (item.section && item.proposedChange) {
      personalizationMap[item.section.toLowerCase()] = item.proposedChange;
    }
  }

  /* ── Render ── */

  return (
    <section className={v2Styles.studio}>

      {/* ══ LEFT RAIL ══ */}
      <aside className={legacyStyles.controls}>
        <div className={legacyStyles.controlsShell}>

          {/* Target Role */}
          <section className={legacyStyles.controlSection}>
            <div className={legacyStyles.panelHead}>
              <p className={legacyStyles.sectionLabel}>Target Role</p>
              <p className={legacyStyles.panelText}>
                Select the evaluated role to tailor this resume against.
              </p>
            </div>
            <select
              className={legacyStyles.archetypeSelect}
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

          {/* Resume Source */}
          {configuredResumeSources.length > 0 && (
            <section className={legacyStyles.controlSection}>
              <div className={legacyStyles.panelHead}>
                <p className={legacyStyles.sectionLabel}>Resume Source</p>
                <p className={legacyStyles.panelText}>
                  Choose which base resume to tailor for this job.
                </p>
              </div>
              <select
                className={legacyStyles.archetypeSelect}
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
                      <p className={legacyStyles.sourceMismatch}>
                        Source changed —{" "}
                        <button className={legacyStyles.sourceMismatchAction} onClick={handleRegenerate} type="button">
                          regenerate to apply
                        </button>
                      </p>
                    )}
                    {selected?.targetRoles?.length ? (
                      <p className={legacyStyles.sourceRoles}>Targets: {selected.targetRoles.join(", ")}</p>
                    ) : null}
                    {selected?.originalPath ? (
                      <p className={legacyStyles.sourceRoles}>Original: {selected.originalPath}</p>
                    ) : null}
                    {selected?.extractionDiagnostics?.length ? (
                      <div className={legacyStyles.sourceRoles}>
                        {selected.extractionDiagnostics.map((d, i) => (
                          <p key={`${d.code}-${i}`}>
                            {d.severity === "warning" ? "Warning" : "Parsed"}: {d.message}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </section>
          )}

          {/* Tone */}
          <section className={legacyStyles.controlSection}>
            <div className={legacyStyles.panelHead}>
              <p className={legacyStyles.sectionLabel}>Tone Calibration</p>
              <p className={legacyStyles.panelText}>
                Adjust from clinical precision to confident assertiveness.
              </p>
            </div>
            <div className={legacyStyles.toneRow}>
              <span className={legacyStyles.toneValue}>{tone}</span>
            </div>
            <input
              aria-label="Tone calibration"
              className={legacyStyles.toneSlider}
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
            <div className={legacyStyles.toneExtremes}>
              <span>Clinical</span>
              <span>Assertive</span>
            </div>
          </section>

          {/* Output Format */}
          <section className={legacyStyles.controlSection}>
            <div className={legacyStyles.panelHead}>
              <p className={legacyStyles.sectionLabel}>Output Format</p>
            </div>
            <div className={legacyStyles.kvList}>
              {([
                ["Paper Size", format === "a4" ? "A4" : "US Letter"],
                ["Draft Angle", draft?.variantLabel ?? "Balanced emphasis"],
                ["Profile", workspace.profileReady ? "Included" : "Missing"],
                ["Keywords active", String(selectedKeywords.length)],
              ] as const).map(([k, v]) => (
                <div key={k} className={legacyStyles.kvRow}>
                  <span className={legacyStyles.kvLabel}>{k}</span>
                  <span className={legacyStyles.kvValue}>{v}</span>
                </div>
              ))}
            </div>
            <div className={legacyStyles.formatControls}>
              <select
                className={legacyStyles.select}
                onChange={(e) => setFormat(e.target.value as "a4" | "letter")}
                value={format}
              >
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
              </select>
              <select
                className={legacyStyles.select}
                onChange={(e) => setVariant(e.target.value as ResumeDraftVariant)}
                value={variant}
              >
                <option value="balanced">Balanced</option>
                <option value="technical">Technical</option>
                <option value="execution">Execution</option>
              </select>
            </div>
          </section>

          {/* Manual Edits */}
          <section className={legacyStyles.controlSection}>
            <div className={legacyStyles.panelHead}>
              <p className={legacyStyles.sectionLabel}>Manual Edits</p>
              <p className={legacyStyles.panelText}>
                Override the headline or summary. Click the pencil icon on any section to edit inline.
              </p>
            </div>
            <label className={legacyStyles.field}>
              <span>Headline</span>
              <input
                className={legacyStyles.textInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setHeadlineOverride(value);
                  if (selectedOpportunity) {
                    saveStoredOverrides(selectedOpportunity.id, { headlineOverride: value, summaryOverride, expBulletOverrides });
                  }
                }}
                placeholder={draft?.headline ?? "Generated headline"}
                type="text"
                value={headlineOverride}
              />
            </label>
            <label className={legacyStyles.field}>
              <span>Summary</span>
              <textarea
                className={legacyStyles.textArea}
                onChange={(e) => {
                  const value = e.target.value;
                  setSummaryOverride(value);
                  if (selectedOpportunity) {
                    saveStoredOverrides(selectedOpportunity.id, { headlineOverride, summaryOverride: value, expBulletOverrides });
                  }
                }}
                placeholder={draft?.summary ?? "Generated summary"}
                rows={5}
                value={summaryOverride}
              />
            </label>
          </section>
        </div>

        {/* Left rail footer */}
        <div className={legacyStyles.controlsFooter}>
          <button
            className={legacyStyles.exportButton}
            disabled={!draft || draftLoading || exporting}
            onClick={() => void handleExport()}
            type="button"
          >
            {exporting ? "Compiling…" : "Compile Asset"}
          </button>
          <button
            className={legacyStyles.secondaryButton}
            disabled={!selectedOpportunity || draftLoading}
            onClick={handleRegenerate}
            type="button"
          >
            {draftLoading ? "Regenerating…" : "Regenerate Draft"}
          </button>
          <button className={legacyStyles.resetButton} onClick={handleReset} type="button">
            Reset Baseline
          </button>
        </div>
      </aside>

      {/* ══ CENTER — Document Preview ══ */}
      <section className={legacyStyles.previewPanel}>
        {/* Header bar */}
        <div className={legacyStyles.previewHead}>
          <div className={legacyStyles.previewStatus}>
            <div className={legacyStyles.liveIndicator}>
              <span className={legacyStyles.liveDot} />
              Live Rendering
            </div>
            <span className={legacyStyles.previewId}>{previewId(selectedOpportunity)}</span>
            {draft ? <span className={legacyStyles.previewVariant}>{draft.variantLabel}</span> : null}
            {draftQuality ? (
              <span
                className={legacyStyles.qualityBadge}
                data-full={draftQuality.filled === draftQuality.total}
                title={draftQuality.sections.map((s) => `${s.ok ? "✓" : "✗"} ${s.label}`).join("  ·  ")}
              >
                {draftQuality.filled}/{draftQuality.total} sections
              </span>
            ) : null}
            {hasEdits && (
              <span className={legacyStyles.editsIndicator} title="You have unsaved inline edits.">
                Edited
              </span>
            )}
          </div>

          <div className={legacyStyles.zoomControls}>
            {ZOOM_LEVELS.map((level) => (
              <button
                className={legacyStyles.zoomBtn}
                data-active={zoom === level}
                key={level}
                onClick={() => setZoom(level)}
                type="button"
              >
                {level}%
              </button>
            ))}
          </div>

          <p className={legacyStyles.previewMeta}>
            {draftLoading
              ? "Refreshing the backend-tailored draft…"
              : lastGeneratedAt
                ? `Last regenerated at ${lastGeneratedAt}`
                : draft?.profileReady
                  ? "Hover any section to edit inline"
                  : "Using resume source and evaluation"}
          </p>
        </div>

        {/* Canvas body */}
        <div className={legacyStyles.previewBody}>
          {draft ? (
            <div
              className={legacyStyles.sheetScaler}
              style={{ transform: `scale(${zoom / 100})`, marginBottom: `calc((${zoom / 100} - 1) * 11in)` }}
            >
              <div className={legacyStyles.docSheet}>
                {/* Document header */}
                <header className={legacyStyles.docHeader}>
                  <div className={legacyStyles.editableZone}>
                    <div className={legacyStyles.docIdentity}>
                      <h1 className={legacyStyles.docName}>{draft.name}</h1>
                      {draft.headline && (
                        <p className={legacyStyles.docTitle}>{headlineOverride || draft.headline}</p>
                      )}
                    </div>
                    <button
                      aria-label="Edit headline"
                      className={legacyStyles.editHandle}
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
                          className={legacyStyles.inlineEditor}
                          style={{ minHeight: "2.5rem" }}
                          onChange={(e) => setEditBuffer(e.target.value)}
                          value={editBuffer}
                        />
                        <div className={legacyStyles.inlineEditorActions}>
                          <button className={legacyStyles.inlineEditorCancel} onClick={() => closeEditor("headline")} type="button">Cancel</button>
                          <button className={legacyStyles.inlineEditorSave} onClick={() => saveEdit("headline")} type="button">Apply</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={legacyStyles.docContact}>
                    {draft.contactLines.map((line) => {
                      const isEmail = line.includes("@");
                      const isLink = line.includes("github.com") || line.includes("linkedin.com") || line.startsWith("http");
                      const href = isEmail ? `mailto:${line}` : isLink ? (line.startsWith("http") ? line : `https://${line}`) : undefined;
                      return href ? (
                        <a href={href} key={line} rel="noreferrer" target="_blank">{line}</a>
                      ) : (
                        <span key={line}>{line}</span>
                      );
                    })}
                  </div>
                </header>

                {/* Draft diagnostics */}
                {draft.notes.length > 0 && (
                  <details className={legacyStyles.draftNotes}>
                    <summary className={legacyStyles.draftNotesSummary}>
                      Draft diagnostics ({draft.notes.length})
                    </summary>
                    <ul className={legacyStyles.draftNotesList}>
                      {draft.notes.map((note, i) => <li key={i}>{note}</li>)}
                    </ul>
                  </details>
                )}

                {/* Summary */}
                {draft.summary ? (
                  <div className={legacyStyles.docSection}>
                    <span className={legacyStyles.docSectionLabel}>Professional Synopsis</span>
                    <div className={legacyStyles.editableZone}>
                      <p className={legacyStyles.docSectionBody}>{summaryOverride || draft.summary}</p>
                      <button
                        aria-label="Edit summary"
                        className={legacyStyles.editHandle}
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
                            className={legacyStyles.inlineEditor}
                            onChange={(e) => setEditBuffer(e.target.value)}
                            rows={5}
                            value={editBuffer}
                          />
                          <div className={legacyStyles.inlineEditorActions}>
                            <button className={legacyStyles.inlineEditorCancel} onClick={() => closeEditor("summary")} type="button">Cancel</button>
                            <button className={legacyStyles.inlineEditorSave} onClick={() => saveEdit("summary")} type="button">Apply</button>
                          </div>
                        </div>
                      )}
                      {personalizationMap["summary"] && editing !== "summary" && (
                        <button
                          className={legacyStyles.suggestionChip}
                          onClick={() => setSummaryOverride(personalizationMap["summary"] ?? "")}
                          type="button"
                        >
                          AI suggestion — click to apply
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={legacyStyles.docSection}>
                    <span className={legacyStyles.docSectionLabel}>Professional Synopsis</span>
                    <p className={legacyStyles.emptySectionHint}>No summary generated.</p>
                  </div>
                )}

                {/* Experience */}
                {draft.experienceHighlights.length > 0 && (
                  <div className={legacyStyles.docSection}>
                    <span className={legacyStyles.docSectionLabel}>Experience Vector</span>
                    <div className={legacyStyles.docEntryList}>
                      {draft.experienceHighlights.map((entry, index) => {
                        const expKey = `experience-${index}`;
                        const overriddenBullets = expBulletOverrides[index] ?? entry.bullets;
                        const displayBullets = matchedOnly
                          ? overriddenBullets.filter((b) => bulletMatches(b, selectedKeywords))
                          : overriddenBullets;

                        return (
                          <article className={legacyStyles.docEntry} key={entry.heading + entry.subheading}>
                            <div className={legacyStyles.docEntryHead}>
                              <span className={legacyStyles.docEntryTitle}>
                                {(() => {
                                  const subParts = entry.subheading.split(" · ");
                                  const role = subParts[0] ?? "";
                                  return <><strong>{role}</strong>{" | "}<span>{entry.heading}</span></>;
                                })()}
                              </span>
                              <span className={legacyStyles.docEntryDate}>
                                {(() => {
                                  const subParts = entry.subheading.split(" · ");
                                  return subParts.length > 1 ? subParts[subParts.length - 1] : "";
                                })()}
                              </span>
                            </div>
                            <div className={legacyStyles.editableZone}>
                              <ul className={legacyStyles.docBulletList}>
                                {displayBullets.map((bullet) => {
                                  const matched = bulletMatches(bullet, selectedKeywords);
                                  return (
                                    <li
                                      className={`${legacyStyles.docBulletItem} ${matched ? legacyStyles.bulletMatched : legacyStyles.bulletUnmatched}`}
                                      key={bullet}
                                    >
                                      {matched && selectedKeywords.length > 0 && (
                                        <span className={legacyStyles.matchDot} aria-hidden="true" />
                                      )}
                                      {bullet}
                                    </li>
                                  );
                                })}
                              </ul>
                              <button
                                aria-label="Edit bullets"
                                className={legacyStyles.editHandle}
                                onClick={() => openEditor(expKey, formatBulletsAsText(overriddenBullets))}
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
                                    className={legacyStyles.inlineEditor}
                                    onChange={(e) => setEditBuffer(e.target.value)}
                                    placeholder="One bullet per line"
                                    rows={Math.max(4, overriddenBullets.length + 1)}
                                    value={editBuffer}
                                  />
                                  <div className={legacyStyles.inlineEditorActions}>
                                    <button className={legacyStyles.inlineEditorCancel} onClick={() => closeEditor(expKey)} type="button">Cancel</button>
                                    <button className={legacyStyles.inlineEditorSave} onClick={() => saveEdit(expKey)} type="button">Apply</button>
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

                {/* Projects */}
                {draft.projectHighlights.length > 0 && (
                  <div className={legacyStyles.docSection}>
                    <span className={legacyStyles.docSectionLabel}>Project Ledger</span>
                    <div className={legacyStyles.docProjectList}>
                      {draft.projectHighlights.map((project) => (
                        <p className={legacyStyles.docProjectItem} key={project.title}>
                          <strong>{project.title}</strong>
                          {project.description ? ` — ${project.description}` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {draft.educationHighlights.length > 0 && (
                  <div className={legacyStyles.docSection}>
                    <span className={legacyStyles.docSectionLabel}>Education</span>
                    <div className={legacyStyles.docEducationList}>
                      {draft.educationHighlights.map((entry) => (
                        <p className={legacyStyles.docEducationItem} key={entry}>{entry}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills */}
                {draft.skillHighlights.length > 0 && (
                  <div className={legacyStyles.docSection}>
                    <span className={legacyStyles.docSectionLabel}>Technical Ontology</span>
                    <div className={legacyStyles.docOntologyGrid}>
                      {draft.skillHighlights.map((group) => (
                        <div className={legacyStyles.docOntologyGroup} key={group.label}>
                          <span className={legacyStyles.docOntologyGroupLabel}>{group.label}</span>
                          <p className={legacyStyles.docOntologyGroupItems}>{group.items.join(", ")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={legacyStyles.previewEmpty}>
              <p className={legacyStyles.sectionLabel}>Draft preview</p>
              <h2>Choose a report-backed role to generate a tailored resume.</h2>
              <p>
                The preview will appear here once the backend assembles the draft from your selected
                resume source and the job evaluation report.
              </p>
            </div>
          )}
        </div>

        {/* Floating zoom */}
        <div className={legacyStyles.floatingZoom}>
          <button
            className={legacyStyles.floatingZoomBtn}
            onClick={() => setZoom((z) => (Math.max(75, z - 25) as ZoomLevel))}
            type="button"
          >
            −
          </button>
          <span className={legacyStyles.floatingZoomLabel}>{zoom}%</span>
          <button
            className={legacyStyles.floatingZoomBtn}
            onClick={() => setZoom((z) => (Math.min(150, z + 25) as ZoomLevel))}
            type="button"
          >
            +
          </button>
        </div>
      </section>

      {/* ══ RIGHT RAIL ══ */}
      <aside className={v2Styles.rightRail}>
        {/* Tab bar */}
        <div className={v2Styles.rightRailTabs}>
          <button
            className={v2Styles.rightRailTab}
            data-active={rightRailTab === "strategy"}
            onClick={() => setRightRailTab("strategy")}
            type="button"
          >
            Strategy
          </button>
          <button
            className={v2Styles.rightRailTab}
            data-active={rightRailTab === "evidence"}
            onClick={() => setRightRailTab("evidence")}
            type="button"
          >
            Evidence
          </button>
          <button
            className={v2Styles.rightRailTab}
            data-active={rightRailTab === "diagnostics"}
            onClick={() => setRightRailTab("diagnostics")}
            type="button"
          >
            Diagnostics
            {diagnosticCount > 0 && (
              <span className={v2Styles.rightRailBadge}>{diagnosticCount}</span>
            )}
          </button>
        </div>

        {/* Panel content */}
        <div className={v2Styles.rightRailPanel}>
          {rightRailTab === "strategy" && (
            <ResumeStrategyPanel strategy={strategy} />
          )}
          {rightRailTab === "evidence" && (
            <ResumeEvidencePanel
              evidenceSummary={evidenceSummary}
              evidenceDiagnostics={evidenceDiagnostics}
            />
          )}
          {rightRailTab === "diagnostics" && (
            <ResumeDiagnosticsPanel document={resumeDocument} rewrite={rewrite} />
          )}
        </div>
      </aside>

    </section>
  );
}
