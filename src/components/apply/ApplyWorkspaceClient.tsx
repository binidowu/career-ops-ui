"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type {
  ApplyActivityEntry,
  ApplyDraftKind,
  ApplyNoteEntry,
  ApplyTargetContact,
  OutreachChannel,
} from "@/lib/api/career-ops";
import type {
  CvMatchItem,
  Opportunity,
  OpportunityStatus,
  PersonalizationItem,
} from "@/lib/types";

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
  { id: "review-dossier", label: "Review the evaluation dossier", hint: "Open the analysis dossier" },
  { id: "tailor-resume", label: "Tailored resume compiled", hint: "Open Resume Studio" },
  { id: "draft-cover", label: "Cover letter drafted", hint: "Cover Letter tab" },
  { id: "draft-outreach", label: "Outreach message drafted", hint: "Outreach tab" },
  { id: "submit", label: "Application submitted via portal", hint: "Confirm submission" },
  { id: "mark-applied", label: "Status moved to Applied", hint: "Status select in the hero" },
];

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "cover", label: "Cover Letter" },
  { id: "outreach", label: "Outreach" },
  { id: "notes", label: "Notes & Intel" },
  { id: "log", label: "Activity Log" },
];

const CHANNELS: Array<{ id: OutreachChannel; label: string }> = [
  { id: "linkedin", label: "LinkedIn DM" },
  { id: "email", label: "Cold Email" },
  { id: "twitter", label: "Twitter / X" },
];

type TabId = "cover" | "outreach" | "notes" | "log";

export interface ApplyEvaluationContext {
  cvMatchItems: CvMatchItem[];
  keywords: string[];
  personalizationItems: PersonalizationItem[];
}

interface Props {
  evaluationContext: ApplyEvaluationContext | null;
  initialApplyData: ApplyNoteEntry;
  opportunity: Opportunity;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatScore100(score: number | null) {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  return Math.round(score * 20);
}

function gradeFromScore(score: number | null) {
  if (typeof score !== "number") return "—";
  if (score >= 4.5) return "A";
  if (score >= 4.0) return "B";
  if (score >= 3.0) return "C";
  if (score >= 2.0) return "D";
  return "F";
}

function gradeTone(grade: string): "a" | "b" | "c" | "d" | "f" | "neutral" {
  const lc = grade.toLowerCase();
  if (lc === "a" || lc === "b" || lc === "c" || lc === "d" || lc === "f") return lc;
  return "neutral";
}

function fitTone(score100: number | null): "success" | "warn" | "error" | "neutral" {
  if (score100 === null) return "neutral";
  if (score100 >= 70) return "success";
  if (score100 >= 50) return "warn";
  return "error";
}

function abbreviateThousands(value: string): string {
  const numeric = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric === 0) return value;
  if (numeric >= 1000 && numeric % 1000 === 0) return `$${numeric / 1000}K`;
  if (numeric >= 1000) return `$${(numeric / 1000).toFixed(1)}K`;
  return `$${numeric}`;
}

/**
 * The compensation field is often a free-text paragraph from the evaluation
 * report. Pull out the first money-range ($X,XXX–$Y,YYY) and format it tightly.
 */
function parseCompForDisplay(comp: string | null): string | null {
  if (!comp) return null;
  const range = /\$?([\d,]+)\s*[–-]\s*\$?([\d,]+)/.exec(comp);
  if (!range) return null;
  const low = abbreviateThousands(range[1]);
  const high = abbreviateThousands(range[2]);

  // Look for a unit/cadence right after the range (e.g. "/hr", "/year")
  const tail = comp.slice(range.index + range[0].length, range.index + range[0].length + 20);
  const unitMatch = /^\s*\/?\s*(hr|hour|yr|year|annually|annual)\b/i.exec(tail);
  const unit = unitMatch
    ? unitMatch[1].toLowerCase().startsWith("h")
      ? "/hr"
      : "/yr"
    : "";

  const currencyMatch = /(CAD|USD|GBP|EUR|AUD)/i.exec(comp);
  const currency = currencyMatch ? currencyMatch[1].toUpperCase() : "";

  const baseRange = `${low}–${high}`;
  if (unit && currency) return `${baseRange} ${currency}${unit}`;
  if (unit) return `${baseRange}${unit}`;
  if (currency) return `${baseRange} ${currency}`;
  return baseRange;
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const ms = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function deadlineTone(days: number | null): "success" | "warn" | "error" | "neutral" {
  if (days === null) return "neutral";
  if (days > 14) return "error";
  if (days > 7) return "warn";
  return "neutral";
}

/**
 * The `remote` field is parsed from free-text in the evaluation report and
 * sometimes captures a role description ("Role: Agent Designer (Canada based)")
 * instead of the actual work mode. Extract a clean work-mode keyword.
 */
function parseWorkMode(remote: string | null): string | null {
  if (!remote) return null;
  const trimmed = remote.trim();
  if (!trimmed) return null;
  if (/^role\s*:/i.test(trimmed)) return null;
  const match = /\b(remote|hybrid|on[\s-]?site|onsite|in[\s-]?office|distributed|anywhere)\b/i.exec(trimmed);
  if (!match) return null;
  // Short strings carry useful context ("Hybrid 3d/wk", "Remote (Canada)") — keep them
  if (trimmed.length <= 32) return trimmed;
  const keyword = match[0];
  return keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase();
}

function countWords(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function lengthLabel(words: number) {
  if (words === 0) return "Empty";
  if (words < 120) return "Short";
  if (words < 280) return "Medium";
  if (words < 450) return "Long";
  return "Very long";
}

function matchKeywords(text: string, keywords: string[]) {
  if (!keywords.length) return [];
  const lower = text.toLowerCase();
  return keywords.map((kw) => ({ keyword: kw, matched: lower.includes(kw.toLowerCase()) }));
}

function formatActivityTs(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export default function ApplyWorkspaceClient({
  evaluationContext,
  initialApplyData,
  opportunity,
}: Props) {
  const router = useRouter();
  const notify = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("cover");
  const [coverLetter, setCoverLetter] = useState(initialApplyData.coverLetterNotes);
  const [channel, setChannel] = useState<OutreachChannel>(initialApplyData.outreachChannel);
  const [channelDrafts, setChannelDrafts] = useState(initialApplyData.outreachDrafts);
  const [privateNotes, setPrivateNotes] = useState(initialApplyData.privateNotes);
  const [targetContact, setTargetContact] = useState<ApplyTargetContact>(initialApplyData.targetContact);
  const [appliedDate, setAppliedDate] = useState(initialApplyData.appliedDate);
  const [status, setStatus] = useState<OpportunityStatus>(opportunity.status);
  const [generating, setGenerating] = useState<ApplyDraftKind | null>(null);
  const [updatingDate, setUpdatingDate] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const stored = localStorage.getItem(`apply-checklist-${opportunity.id}`);
    return stored ? new Set<string>(JSON.parse(stored) as string[]) : new Set();
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const score100 = formatScore100(opportunity.score);
  const grade = gradeFromScore(opportunity.score);
  const keywords = evaluationContext?.keywords ?? [];
  const outreachDraft = channelDrafts[channel];
  const compDisplay = parseCompForDisplay(opportunity.compensation);
  const workMode = parseWorkMode(opportunity.remote);
  const daysInPipeline = daysSince(opportunity.date);

  const coverWordCount = countWords(coverLetter);
  const keywordHits = useMemo(
    () => matchKeywords(coverLetter, keywords),
    [coverLetter, keywords],
  );
  const matchedKeywords = keywordHits.filter((k) => k.matched).length;

  const outreachWordCount = countWords(outreachDraft);

  const completedCount = CHECKLIST_STEPS.filter((s) => checked.has(s.id)).length;
  const progressPct = Math.round((completedCount / CHECKLIST_STEPS.length) * 100);

  const sortedActivity = useMemo(
    () => [...initialApplyData.activity].sort((a, b) => b.ts.localeCompare(a.ts)),
    [initialApplyData.activity],
  );

  /* ── Persistence helpers ─────────────────────────────────── */

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
        title: "Could not save",
        description: "Changes will be lost on refresh. Check your connection.",
        tone: "error",
        dismissAfter: 5000,
      });
    }
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(
        `apply-checklist-${opportunity.id}`,
        JSON.stringify([...next]),
      );
      return next;
    });
  }

  /* ── Action handlers ─────────────────────────────────────── */

  async function handleStatusChange(next: OpportunityStatus) {
    if (next === status || updatingStatus) return;
    const prev = status;
    const prevAppliedDate = appliedDate;
    setUpdatingStatus(true);
    setStatus(next);

    try {
      if (next === "Applied" && !appliedDate) {
        const today = new Date().toISOString().slice(0, 10);
        setAppliedDate(today);
        const dateRes = await fetch(`/api/apply/${opportunity.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appliedDate: today }),
        });
        if (!dateRes.ok) throw new Error("Applied date update failed");
      }

      const res = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Status update failed");

      notify({ title: `Status → ${next}`, description: `Tracker updated to "${next}".`, dismissAfter: 2200 });
      router.refresh();
    } catch {
      setStatus(prev);
      setAppliedDate(prevAppliedDate);
      notify({ title: "Status update failed", description: "Unable to write the new status.", tone: "error", dismissAfter: null });
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAppliedDateChange(value: string) {
    const nextDate = value || null;
    const prevDate = appliedDate;
    setAppliedDate(nextDate);
    setUpdatingDate(true);

    try {
      const res = await fetch(`/api/apply/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appliedDate: nextDate }),
      });
      if (!res.ok) throw new Error("Applied date update failed");
      router.refresh();
    } catch {
      setAppliedDate(prevDate);
      notify({ title: "Date update failed", description: "Unable to save the applied date.", tone: "error", dismissAfter: null });
    } finally {
      setUpdatingDate(false);
    }
  }

  async function handleGenerate(kind: ApplyDraftKind) {
    setGenerating(kind);

    try {
      const res = await fetch(`/api/apply/${opportunity.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = (await res.json()) as { error?: string; text?: string };
      if (!res.ok || !data.text) throw new Error(data.error ?? "Generation failed");

      if (kind === "cover-letter") {
        setCoverLetter(data.text);
        scheduleSave({ coverLetterNotes: data.text });
      } else {
        const next = { ...channelDrafts, [channel]: data.text };
        setChannelDrafts(next);
        scheduleSave({ outreachDrafts: next });
      }

      notify({
        title: kind === "cover-letter" ? "Cover letter drafted" : "Outreach drafted",
        description: "Review and edit the generated copy before sending.",
        dismissAfter: 3000,
      });
      router.refresh();
    } catch (error) {
      notify({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unable to generate a draft right now.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setGenerating(null);
    }
  }

  async function handleChannelChange(next: OutreachChannel) {
    if (next === channel) return;
    setChannel(next);
    try {
      await fetch(`/api/apply/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreachChannel: next }),
      });
      router.refresh();
    } catch {
      // non-fatal — UI already updated
    }
  }

  function handleContactChange(field: keyof ApplyTargetContact, value: string) {
    const next = { ...targetContact, [field]: value };
    setTargetContact(next);
    scheduleSave({ targetContact: next });
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/apply/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privateNotes }),
      });
      if (!res.ok) throw new Error("Save failed");
      notify({ title: "Notes saved", description: "Private notes updated.", dismissAfter: 2200 });
    } catch {
      notify({ title: "Save failed", description: "Unable to save notes.", tone: "error", dismissAfter: null });
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleCopy(text: string, label: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify({ title: `${label} copied`, description: "Pasted to your clipboard.", dismissAfter: 2000 });
    } catch {
      notify({ title: "Copy failed", description: "Clipboard access was blocked.", tone: "error", dismissAfter: null });
    }
  }

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <>
      {/* Hero */}
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Application Workspace</p>
          <h1 className={styles.heroTitle}>{opportunity.role}</h1>
          <p className={styles.heroSubMeta}>
            <span>{opportunity.company}</span>
            {workMode ? (
              <>
                <span className={styles.heroDot}>·</span>
                <span>{workMode}</span>
              </>
            ) : null}
            <span className={styles.heroDot}>·</span>
            <span className={styles.heroId}>ID: {opportunity.num.toString().padStart(3, "0")}</span>
          </p>
        </div>

        <div className={styles.heroActions}>
          <select
            aria-label="Application status"
            className={styles.statusSelect}
            disabled={updatingStatus}
            onChange={(event) => void handleStatusChange(event.target.value as OpportunityStatus)}
            value={status}
          >
            {APPLY_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Link className={styles.btnOutline} href={`/pipeline/${opportunity.id}`}>
            Open Dossier
          </Link>
          <Link className={styles.btnPrimary} href={`/resumes?opportunity=${opportunity.id}`}>
            Tailor Resume
          </Link>
        </div>
      </header>

      {/* Badge row — grade, score, days-in-pipeline counter, posting */}
      <div className={styles.badgeRow}>
        <span className={styles.gradeBadge} data-grade={gradeTone(grade)}>{grade}</span>
        {score100 !== null ? (
          <span className={styles.scoreTag} data-tone={fitTone(score100)}>
            Score {score100}/100
          </span>
        ) : null}
        {daysInPipeline !== null ? (
          <span className={styles.scoreTag} data-tone={deadlineTone(daysInPipeline)}>
            {daysInPipeline === 0 ? "Today" : `${daysInPipeline}d in pipeline`}
          </span>
        ) : null}
        {opportunity.jobUrl ? (
          <a
            className={styles.postingLink}
            href={opportunity.jobUrl}
            rel="noreferrer"
            target="_blank"
          >
            Posting ↗
          </a>
        ) : null}
      </div>

      <div className={styles.layout}>
        {/* Main column */}
        <div className={styles.main}>
          {/* Tab bar */}
          <div className={styles.tabBar} role="tablist">
            {TABS.map((tab) => (
              <button
                aria-selected={activeTab === tab.id}
                className={styles.tabButton}
                data-active={activeTab === tab.id}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Cover Letter tab */}
          {activeTab === "cover" ? (
            <section className={styles.tabPanel}>
              <div className={styles.tabHead}>
                <div>
                  <p className={styles.tabEyebrow}>Cover Letter Draft</p>
                  <p className={styles.tabHint}>Tailored to {opportunity.company}</p>
                </div>
                <div className={styles.tabActions}>
                  <button
                    className={styles.ghostButton}
                    disabled={generating !== null}
                    onClick={() => void handleGenerate("cover-letter")}
                    type="button"
                  >
                    {generating === "cover-letter" ? "Generating…" : coverLetter ? "Regenerate" : "Generate"}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => void handleCopy(coverLetter, "Cover letter")}
                    type="button"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className={styles.metaBar}>
                <div className={styles.metaBarItem}>
                  <span className={styles.metaBarKey}>Words</span>
                  <span className={styles.metaBarValue}>{coverWordCount}</span>
                </div>
                <div className={styles.metaBarItem}>
                  <span className={styles.metaBarKey}>Length</span>
                  <span className={styles.metaBarValue}>{lengthLabel(coverWordCount)}</span>
                </div>
                <div className={styles.metaBarItem}>
                  <span className={styles.metaBarKey}>Keywords</span>
                  <span className={styles.metaBarValue}>
                    {keywords.length ? `${matchedKeywords}/${keywords.length}` : "—"}
                  </span>
                </div>
                <div className={styles.metaBarItem}>
                  <span className={styles.metaBarKey}>Format</span>
                  <span className={styles.metaBarValue}>Plain text</span>
                </div>
              </div>

              <textarea
                className={styles.editor}
                onChange={(e) => {
                  setCoverLetter(e.target.value);
                  scheduleSave({ coverLetterNotes: e.target.value });
                }}
                placeholder={`Why you're excited about ${opportunity.company}, what you bring, and what you want to communicate in your application…`}
                rows={16}
                value={coverLetter}
              />

              {keywords.length ? (
                <div className={styles.coverageCard}>
                  <div className={styles.coverageHead}>
                    <span className={styles.cardEyebrow}>Keyword Coverage</span>
                    <span
                      className={styles.coverageCount}
                      data-tone={matchedKeywords === keywords.length ? "success" : matchedKeywords > keywords.length / 2 ? "warn" : "error"}
                    >
                      {matchedKeywords}/{keywords.length} matched
                    </span>
                  </div>
                  <div className={styles.keywordGrid}>
                    {keywordHits.map(({ keyword, matched }) => (
                      <span
                        className={styles.keywordPill}
                        data-matched={matched}
                        key={keyword}
                      >
                        {matched ? "✓" : "·"} {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className={styles.autoSaveHint}>Auto-saved as you type.</p>
            </section>
          ) : null}

          {/* Outreach tab */}
          {activeTab === "outreach" ? (
            <section className={styles.tabPanel}>
              <div className={styles.tabHead}>
                <div>
                  <p className={styles.tabEyebrow}>Outreach Message</p>
                  <p className={styles.tabHint}>
                    {channel === "linkedin" ? "LinkedIn DM" : channel === "email" ? "Cold email" : "Twitter / X DM"} to a recruiter or hiring manager at {opportunity.company}
                  </p>
                </div>
                <div className={styles.tabActions}>
                  <button
                    className={styles.ghostButton}
                    disabled={generating !== null}
                    onClick={() => void handleGenerate("outreach")}
                    type="button"
                  >
                    {generating === "outreach" ? "Generating…" : outreachDraft ? "Regenerate" : "Generate"}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => void handleCopy(outreachDraft, "Outreach")}
                    type="button"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className={styles.channelRow} role="tablist" aria-label="Outreach channel">
                {CHANNELS.map((c) => (
                  <button
                    aria-selected={channel === c.id}
                    className={styles.channelButton}
                    data-active={channel === c.id}
                    key={c.id}
                    onClick={() => void handleChannelChange(c.id)}
                    role="tab"
                    type="button"
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <textarea
                className={styles.editor}
                onChange={(e) => {
                  const next = { ...channelDrafts, [channel]: e.target.value };
                  setChannelDrafts(next);
                  scheduleSave({ outreachDrafts: next });
                }}
                placeholder={`Hi [Name], I came across the ${opportunity.role} role at ${opportunity.company} and wanted to reach out…`}
                rows={9}
                value={outreachDraft}
              />

              <div className={styles.contactCard}>
                <span className={styles.cardEyebrow}>Target Contact</span>
                <div className={styles.contactGrid}>
                  {(["name", "title", "linkedin", "email"] as const).map((field) => (
                    <label className={styles.contactField} key={field}>
                      <span>{field === "linkedin" ? "LinkedIn" : field === "email" ? "Email" : field === "title" ? "Title" : "Name"}</span>
                      <input
                        onChange={(e) => handleContactChange(field, e.target.value)}
                        placeholder={
                          field === "name"
                            ? "Add manually"
                            : field === "title"
                            ? "Recruiter / Hiring Manager"
                            : field === "linkedin"
                            ? "linkedin.com/in/…"
                            : "email@example.com"
                        }
                        type={field === "email" ? "email" : "text"}
                        value={targetContact[field]}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.outreachActions}>
                <button
                  className={styles.primaryButton}
                  disabled={!outreachDraft.trim()}
                  onClick={() => {
                    if (status !== "Responded" && status !== "Interview") {
                      void handleStatusChange("Responded");
                    } else {
                      notify({
                        title: "Already past outreach stage",
                        description: `Status is "${status}".`,
                        dismissAfter: 2500,
                      });
                    }
                  }}
                  type="button"
                >
                  Mark as Sent
                </button>
                <button
                  className={styles.secondaryButton}
                  disabled={!outreachDraft.trim()}
                  onClick={() => void handleCopy(outreachDraft, "Outreach")}
                  type="button"
                >
                  Copy to Clipboard
                </button>
                <span className={styles.outreachMeta}>{outreachWordCount} words</span>
              </div>
            </section>
          ) : null}

          {/* Notes & Intel tab */}
          {activeTab === "notes" ? (
            <section className={styles.tabPanel}>
              {opportunity.summary || evaluationContext ? (
                <div className={styles.intelCard}>
                  <span className={styles.cardEyebrow}>Latest Intelligence</span>
                  {opportunity.summary ? (
                    <p className={styles.intelSummary}>{opportunity.summary}</p>
                  ) : null}
                  <div className={styles.intelTags}>
                    <span className={styles.intelTag}>
                      {evaluationContext?.cvMatchItems.length ?? 0} CV matches
                    </span>
                    <span className={styles.intelTag}>
                      {evaluationContext?.personalizationItems.length ?? 0} personalization notes
                    </span>
                    <span className={styles.intelTag}>
                      {evaluationContext?.keywords.length ?? 0} keywords flagged
                    </span>
                  </div>
                </div>
              ) : null}

              {evaluationContext?.cvMatchItems.length ? (
                <div className={styles.intelGroup}>
                  <span className={styles.cardEyebrow}>CV Strengths to Lead With</span>
                  <ul className={styles.intelList}>
                    {evaluationContext.cvMatchItems.map((item, index) => (
                      <li key={`${item.requirement}-${index}`}>
                        <strong>{item.requirement}</strong>
                        <span>{item.match}</span>
                        {item.source ? <em>{item.source}</em> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className={styles.notesGroup}>
                <div className={styles.notesHead}>
                  <span className={styles.cardEyebrow}>Private Notes</span>
                  <span className={styles.notesHint}>Saves with the role. Not exported.</span>
                </div>
                <textarea
                  className={styles.editor}
                  onChange={(e) => {
                    setPrivateNotes(e.target.value);
                    scheduleSave({ privateNotes: e.target.value });
                  }}
                  placeholder="Thoughts about this role, recruiter names, compensation intel, interview impressions…"
                  rows={6}
                  value={privateNotes}
                />
                <button
                  className={styles.secondaryButton}
                  disabled={savingNotes}
                  onClick={() => void handleSaveNotes()}
                  type="button"
                >
                  {savingNotes ? "Saving…" : "Save Notes"}
                </button>
              </div>

              <div className={styles.metadataGroup}>
                <span className={styles.cardEyebrow}>Role Metadata</span>
                <div className={styles.metadataTable}>
                  {[
                    ["Role ID", opportunity.num.toString().padStart(3, "0")],
                    ["Evaluated", opportunity.date || "—"],
                    ["Archetype", opportunity.archetype || "Unknown"],
                    ["Location", workMode || "—"],
                    ["Score", score100 !== null ? `${score100}/100` : "—"],
                    ["Grade", grade],
                    ["Status", status],
                  ].map(([k, v]) => (
                    <div className={styles.metadataRow} key={k}>
                      <span>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* Activity Log tab */}
          {activeTab === "log" ? (
            <section className={styles.tabPanel}>
              <div className={styles.tabHead}>
                <div>
                  <p className={styles.tabEyebrow}>Activity Log</p>
                  <p className={styles.tabHint}>
                    {sortedActivity.length} event{sortedActivity.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              {sortedActivity.length ? (
                <ol className={styles.activityList}>
                  {sortedActivity.map((entry, index) => (
                    <ActivityRow entry={entry} key={`${entry.ts}-${index}`} />
                  ))}
                </ol>
              ) : (
                <p className={styles.emptyHint}>
                  No activity yet. Events appear here as you generate drafts, change status, or
                  export resumes.
                </p>
              )}
            </section>
          ) : null}
        </div>

        {/* Rail */}
        <aside className={styles.rail}>
          <section className={styles.railCard}>
            <div className={styles.railHead}>
              <span className={styles.railLabel}>Submission Checklist</span>
              <span className={styles.checklistCount}>
                {completedCount}/{CHECKLIST_STEPS.length}
              </span>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className={styles.checklist}>
              {CHECKLIST_STEPS.map((step) => (
                <label className={styles.checkItem} data-done={checked.has(step.id)} key={step.id}>
                  <span
                    className={styles.checkBox}
                    data-checked={checked.has(step.id)}
                    onClick={() => toggleCheck(step.id)}
                  >
                    {checked.has(step.id) ? "✓" : ""}
                  </span>
                  <div className={styles.checkCopy}>
                    <span className={styles.checkLabel}>{step.label}</span>
                    <span className={styles.checkHint}>{step.hint}</span>
                  </div>
                </label>
              ))}
            </div>
            <button
              className={styles.primaryButton}
              disabled={status === "Applied" || updatingStatus}
              onClick={() => void handleStatusChange("Applied")}
              type="button"
            >
              {status === "Applied" ? "Marked as Submitted" : "Mark as Submitted"}
            </button>
            <label className={styles.dateField}>
              <span>Applied date</span>
              <input
                disabled={updatingDate}
                onChange={(event) => void handleAppliedDateChange(event.target.value)}
                type="date"
                value={appliedDate ?? ""}
              />
            </label>
          </section>

          <section className={styles.railCard}>
            <span className={styles.railLabel}>Role Signal</span>
            <div className={styles.signalList}>
              {score100 !== null ? (
                <div className={styles.signalRow}>
                  <span>Fit Score</span>
                  <span className={styles.signalPill} data-tone={fitTone(score100)}>{score100}/100</span>
                </div>
              ) : null}
              <div className={styles.signalRow}>
                <span>Grade</span>
                <span className={styles.signalPill} data-tone="neutral">{grade}</span>
              </div>
              {compDisplay ? (
                <div className={styles.signalRow}>
                  <span>Comp Band</span>
                  <span className={styles.signalPill} data-tone="neutral">{compDisplay}</span>
                </div>
              ) : null}
              {workMode ? (
                <div className={styles.signalRow}>
                  <span>Work Mode</span>
                  <span className={styles.signalPill} data-tone="neutral">{workMode}</span>
                </div>
              ) : null}
              {appliedDate ? (
                <div className={styles.signalRow}>
                  <span>Applied</span>
                  <span className={styles.signalPill} data-tone="success">{appliedDate}</span>
                </div>
              ) : null}
            </div>
          </section>

          <section className={styles.railLinks}>
            <Link className={styles.railLink} href={`/pipeline/${opportunity.id}`}>
              Open Dossier →
            </Link>
            <Link className={styles.railLink} href={`/pipeline/${opportunity.id}/interview`}>
              Prep Interview →
            </Link>
            <Link className={styles.railLink} href={`/resumes?opportunity=${opportunity.id}`}>
              Resume Studio →
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}

function ActivityRow({ entry }: { entry: ApplyActivityEntry }) {
  return (
    <li className={styles.activityRow} data-kind={entry.kind}>
      <span className={styles.activityTs}>{formatActivityTs(entry.ts)}</span>
      <span className={styles.activityEvent}>{entry.event}</span>
      <span className={styles.activityActor}>{entry.actor}</span>
    </li>
  );
}
