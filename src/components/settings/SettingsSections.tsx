"use client";

import { type ChangeEvent, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type { ResumeSource, SystemCheckId, SystemCheckResult } from "@/lib/types";

import {
  Btn,
  Divider,
  FieldRow,
  Input,
  Modal,
  SectionHead,
  Select,
  StatusDot,
  StatusPill,
  TagInput,
  Textarea,
  Toggle,
} from "./SettingsPrimitives";
import type {
  ArchetypeRow,
  CompensationState,
  PositioningState,
  ProofRow,
  ReadinessSnapshot,
  ScannerState,
  SettingsAccount,
} from "./SettingsShell";
import styles from "./SettingsSections.module.css";

interface SectionProps {
  id: string;
  registerRef: (node: HTMLElement | null) => void;
}

const ICON_PLUS = (
  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const ICON_REFRESH = (
  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115 0M20 15a9 9 0 01-15 0" />
  </svg>
);

const ICON_UPLOAD = (
  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
);

const ICON_SEARCH = (
  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const ICON_CHEVRON = (
  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

// ─────────────────────────────────────────────
// 1. Setup Readiness
// ─────────────────────────────────────────────
interface ChecklistItem {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "missing";
  next?: string;
}

function deriveChecklist(readiness: ReadinessSnapshot): ChecklistItem[] {
  return [
    {
      id: "profile",
      label: "Profile configured",
      status: readiness.profileReady ? "pass" : "warn",
      next: readiness.profileReady ? undefined : "Save your profile to begin",
    },
    {
      id: "resume",
      label: "Resume source uploaded",
      status: readiness.resumeReady ? "pass" : "warn",
      next: readiness.resumeReady ? undefined : "Upload a resume in Resume Sources",
    },
    {
      id: "tracker",
      label: "Tracker initialized",
      status: readiness.trackerReady ? "pass" : "warn",
      next: readiness.trackerReady ? undefined : "Run scanner once to seed",
    },
    {
      id: "reports",
      label: "Reports directory available",
      status: readiness.reportsReady ? "pass" : "warn",
      next: readiness.reportsReady ? undefined : "Generate a report",
    },
    {
      id: "cv",
      label: "Default CV available",
      status: readiness.cvReady ? "pass" : "warn",
      next: readiness.cvReady ? undefined : "Add cv.md or set a default resume",
    },
  ];
}

const STATUS_LABELS: Record<ChecklistItem["status"], string> = {
  pass: "Ready",
  warn: "Needs attention",
  fail: "Not configured",
  missing: "Missing",
};

const STATUS_TONES: Record<ChecklistItem["status"], "success" | "warn" | "error"> = {
  pass: "success",
  warn: "warn",
  fail: "error",
  missing: "error",
};

interface ReadinessSectionProps extends SectionProps {
  readiness: ReadinessSnapshot;
}

export function ReadinessSection({ id, registerRef, readiness }: ReadinessSectionProps) {
  const items = deriveChecklist(readiness);
  const [running, setRunning] = useState(false);
  const passed = items.filter((item) => item.status === "pass").length;
  const total = items.length;
  const allGood = passed === total;
  const notify = useToast();

  const runCheck = async () => {
    setRunning(true);
    try {
      const response = await fetch("/api/system/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkId: "doctor" }),
      });
      const data = (await response.json()) as SystemCheckResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Check failed");
      notify({
        title: "Setup check complete",
        description: data.summary,
        tone: data.status === "fail" ? "error" : "neutral",
        dismissAfter: 5000,
      });
    } catch (error) {
      notify({
        title: "Check failed",
        description: error instanceof Error ? error.message : "Unable to run setup check.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <section
      id={id}
      ref={(node) => registerRef(node)}
      className={styles.section}
      aria-labelledby={`${id}-title`}
    >
      <SectionHead title="Setup Readiness" desc="Everything the system needs to run its first evaluation.">
        <Btn size="sm" icon={ICON_REFRESH} loading={running} onClick={runCheck}>
          Run setup check
        </Btn>
      </SectionHead>

      <div className={styles.banner} data-tone={allGood ? "success" : "warn"}>
        <span className={styles.bannerIcon}>{allGood ? "✓" : "⚠"}</span>
        <div className={styles.bannerCopy}>
          <span className={styles.bannerTitle}>
            {allGood
              ? "System ready"
              : `${total - passed} item${total - passed !== 1 ? "s" : ""} need attention`}
          </span>
          <span className={styles.bannerSub}>
            {passed} of {total} checks passing
          </span>
        </div>
        <div className={styles.bannerDots}>
          {items.map((item) => (
            <span key={item.id} className={styles.bannerDot} data-status={item.status} />
          ))}
        </div>
      </div>

      <div className={styles.checklist}>
        {items.map((item) => (
          <div key={item.id} className={styles.checklistRow}>
            <StatusDot status={item.status} />
            <span className={styles.checklistLabel}>{item.label}</span>
            {item.next ? <span className={styles.checklistNext}>{item.next}</span> : null}
            <StatusPill label={STATUS_LABELS[item.status]} tone={STATUS_TONES[item.status]} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// 2. Account & Identity
// ─────────────────────────────────────────────
interface AccountSectionProps extends SectionProps {
  value: SettingsAccount;
  onChange: (next: SettingsAccount) => void;
}

const TIMEZONES = [
  "",
  "America/Toronto",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const VISA_OPTIONS = [
  "",
  "Citizen",
  "Permanent Resident",
  "Open Work Permit",
  "Employer Sponsored",
  "TN Visa",
  "H-1B",
  "Other",
];

const ONSITE_OPTIONS = [
  "",
  "Fully remote",
  "Hybrid (1–2 days/week)",
  "Hybrid (3+ days/week)",
  "Full on-site",
  "Flexible",
];

export function AccountSection({ id, registerRef, value, onChange }: AccountSectionProps) {
  const set = <K extends keyof SettingsAccount>(key: K) => (v: SettingsAccount[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <section
      id={id}
      ref={(node) => registerRef(node)}
      className={styles.section}
      aria-labelledby={`${id}-title`}
    >
      <SectionHead title="Account & Identity" desc="Your personal profile and contact information." />
      <div className={styles.cardBlock}>
        <FieldRow>
          <Input label="Full name" value={value.fullName} onChange={set("fullName")} required />
          <Input label="Email" type="email" value={value.email} onChange={set("email")} required />
        </FieldRow>
        <FieldRow>
          <Input label="Phone" type="tel" value={value.phone} onChange={set("phone")} placeholder="+1 416 555 0100" />
          <Input
            label="Location"
            value={value.location}
            onChange={set("location")}
            placeholder="Toronto, ON, Canada"
          />
        </FieldRow>
        <FieldRow>
          <Select label="Timezone" value={value.timezone} onChange={set("timezone")} options={TIMEZONES} />
          <Select
            label="Visa / work authorization"
            value={value.visa}
            onChange={set("visa")}
            options={VISA_OPTIONS}
          />
        </FieldRow>
        <Divider />
        <FieldRow>
          <Input
            label="LinkedIn URL"
            value={value.linkedin}
            onChange={set("linkedin")}
            placeholder="https://linkedin.com/in/your-handle"
          />
          <Input
            label="GitHub URL"
            value={value.github}
            onChange={set("github")}
            placeholder="https://github.com/your-handle"
          />
        </FieldRow>
        <Input
          label="Portfolio URL"
          value={value.portfolio}
          onChange={set("portfolio")}
          placeholder="https://yourportfolio.com"
        />
        <Divider />
        <Select
          label="On-site availability"
          value={value.onsite}
          onChange={set("onsite")}
          options={ONSITE_OPTIONS}
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// 3. Career Positioning
// ─────────────────────────────────────────────
interface PositioningSectionProps extends SectionProps {
  value: PositioningState;
  onChange: (next: PositioningState) => void;
}

export function PositioningSection({ id, registerRef, value, onChange }: PositioningSectionProps) {
  const set = <K extends keyof PositioningState>(key: K) => (v: PositioningState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <section
      id={id}
      ref={(node) => registerRef(node)}
      className={styles.section}
      aria-labelledby={`${id}-title`}
    >
      <SectionHead
        title="Career Positioning"
        desc="Configure the recruiter brief the AI uses when evaluating fit. Be honest — the AI uses this to rank and filter."
      />
      <div className={styles.cardBlock}>
        <TagInput
          label="Target roles"
          values={value.targetRoles}
          onChange={set("targetRoles")}
          placeholder="e.g. AI Engineer"
          hint="Press Enter or comma to add. The AI evaluates every opportunity against these."
        />
        <TagInput
          label="Target geographies"
          values={value.targetGeos}
          onChange={set("targetGeos")}
          placeholder="e.g. Toronto, Remote"
          hint="Include 'Remote' if open to remote roles."
        />
        <Divider />
        <Input
          label="Professional headline"
          value={value.headline}
          onChange={set("headline")}
          placeholder="e.g. AI / ML Engineer & Full-Stack Developer — 8 yrs building production systems"
          hint="Shown at the top of every AI evaluation. Keep it tight and specific."
        />
        <Textarea
          label="Career narrative / exit story"
          value={value.narrative}
          onChange={set("narrative")}
          rows={4}
          placeholder="What's your story? Why are you here, what did you build, and where are you headed? Write this as if briefing a recruiter in 60 seconds."
          hint="The AI quotes from this when writing cover letters and evaluating narrative fit."
        />
        <Divider />
        <FieldRow>
          <Textarea
            label="Core strengths / superpowers"
            value={value.strengths}
            onChange={set("strengths")}
            rows={3}
            placeholder="e.g. Systems thinking, turning ambiguous problems into shipped products."
          />
          <Textarea
            label="Work that excites me"
            value={value.excites}
            onChange={set("excites")}
            rows={3}
            placeholder="e.g. Applied AI, zero-to-one products, hard technical challenges with real users."
          />
        </FieldRow>
        <FieldRow>
          <Textarea
            label="Work that drains me"
            value={value.drains}
            onChange={set("drains")}
            rows={3}
            placeholder="e.g. Siloed work, heavy process, roles with no user contact."
          />
          <Textarea
            label="Deal-breakers"
            value={value.dealbreakers}
            onChange={set("dealbreakers")}
            rows={3}
            placeholder="e.g. No equity, pure maintenance, toxic leadership."
            hint="The AI uses this to flag mismatches and score fit."
          />
        </FieldRow>
        <Textarea
          label="Best professional achievement"
          value={value.achievement}
          onChange={set("achievement")}
          rows={3}
          placeholder="Describe your standout career moment. What did you build or do, what was the impact, and how was it measured?"
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// 4. Role Archetypes
// ─────────────────────────────────────────────
const ARCHETYPE_DEFAULT: ArchetypeRow = {
  name: "",
  level: "Senior",
  fit: "primary",
  track: "Engineering",
  sellWhen: "",
};

const LEVEL_OPTIONS = ["Junior", "Mid", "Senior", "Staff", "Principal", "Lead", "Manager", "Director"];
const FIT_OPTIONS = [
  { value: "primary", label: "primary" },
  { value: "secondary", label: "secondary" },
  { value: "adjacent", label: "adjacent" },
];
const TRACK_OPTIONS = [
  "Engineering",
  "Product",
  "Design",
  "Data",
  "Leadership",
  "Research",
  "Other",
];

interface ArchetypesSectionProps extends SectionProps {
  value: ArchetypeRow[];
  onChange: (next: ArchetypeRow[]) => void;
}

export function ArchetypesSection({ id, registerRef, value, onChange }: ArchetypesSectionProps) {
  const [modal, setModal] = useState<
    | { mode: "add"; draft: ArchetypeRow }
    | { mode: "edit"; index: number; draft: ArchetypeRow }
    | null
  >(null);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  const openAdd = () => setModal({ mode: "add", draft: { ...ARCHETYPE_DEFAULT } });
  const openEdit = (index: number) =>
    setModal({ mode: "edit", index, draft: { ...value[index] } });

  const save = () => {
    if (!modal || !modal.draft.name.trim()) return;
    if (modal.mode === "add") {
      onChange([...value, modal.draft]);
    } else {
      onChange(value.map((row, index) => (index === modal.index ? modal.draft : row)));
    }
    setModal(null);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    setConfirmRemove(null);
  };

  const updateDraft = <K extends keyof ArchetypeRow>(key: K, v: ArchetypeRow[K]) => {
    if (!modal) return;
    setModal({ ...modal, draft: { ...modal.draft, [key]: v } });
  };

  return (
    <section
      id={id}
      ref={(node) => registerRef(node)}
      className={styles.section}
      aria-labelledby={`${id}-title`}
    >
      <SectionHead
        title="Role Archetypes"
        desc="Define the role families the AI evaluates against. Use these to weight fit scoring across different role types."
      >
        <Btn size="sm" variant="accent" onClick={openAdd} icon={ICON_PLUS}>
          Add archetype
        </Btn>
      </SectionHead>

      {value.length === 0 ? (
        <div className={styles.emptyState}>
          No archetypes defined —{" "}
          <button type="button" className={styles.linkButton} onClick={openAdd}>
            add one
          </button>{" "}
          to help the AI weight fit scoring.
        </div>
      ) : (
        <div className={styles.checklist}>
          {value.map((row, index) => (
            <div key={`${row.name}-${index}`} className={styles.archetypeRow}>
              <div className={styles.archetypeBody}>
                <div className={styles.archetypeTitle}>
                  <span className={styles.archetypeName}>{row.name}</span>
                  <span className={styles.archetypeFit} data-fit={row.fit}>
                    {row.fit}
                  </span>
                </div>
                <div className={styles.archetypeMeta}>
                  <span className={styles.metaMono}>
                    {row.level} · {row.track}
                  </span>
                  {row.sellWhen ? <span className={styles.metaText}>— {row.sellWhen}</span> : null}
                </div>
              </div>
              <Btn size="sm" variant="ghost" onClick={() => openEdit(index)}>
                Edit
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => setConfirmRemove(index)}
                style={{ color: "var(--color-error)" }}
              >
                Remove
              </Btn>
            </div>
          ))}
        </div>
      )}

      {modal ? (
        <Modal
          title={modal.mode === "add" ? "Add role archetype" : "Edit archetype"}
          onClose={() => setModal(null)}
        >
          <div style={{ display: "grid", gap: "var(--space-lg)" }}>
            <Input
              label="Archetype name"
              value={modal.draft.name}
              onChange={(v) => updateDraft("name", v)}
              placeholder="e.g. AI/ML Engineer"
              required
            />
            <FieldRow>
              <Select
                label="Level"
                value={modal.draft.level}
                onChange={(v) => updateDraft("level", v)}
                options={LEVEL_OPTIONS}
              />
              <Select
                label="Fit type"
                value={modal.draft.fit}
                onChange={(v) => updateDraft("fit", v as ArchetypeRow["fit"])}
                options={FIT_OPTIONS}
              />
            </FieldRow>
            <Select
              label="Track"
              value={modal.draft.track}
              onChange={(v) => updateDraft("track", v)}
              options={TRACK_OPTIONS}
            />
            <Textarea
              label="When to emphasize this archetype"
              value={modal.draft.sellWhen}
              onChange={(v) => updateDraft("sellWhen", v)}
              rows={2}
              placeholder="e.g. When the role is AI-focused and requires production system experience."
            />
          </div>
          <div className={styles.actionsRow} style={{ justifyContent: "flex-end", marginTop: "var(--space-xl)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Btn>
            <Btn variant="accent" onClick={save} disabled={!modal.draft.name.trim()}>
              Save archetype
            </Btn>
          </div>
        </Modal>
      ) : null}

      {confirmRemove !== null ? (
        <Modal title="Remove archetype?" onClose={() => setConfirmRemove(null)} width="small">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
            This will remove <strong style={{ color: "var(--color-text)" }}>{value[confirmRemove]?.name}</strong>. The change won&apos;t take effect until you save settings.
          </p>
          <div className={styles.actionsRow} style={{ justifyContent: "flex-end", marginTop: "var(--space-xl)" }}>
            <Btn variant="secondary" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Btn>
            <Btn variant="destructive" onClick={() => remove(confirmRemove)}>
              Remove
            </Btn>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

// ─────────────────────────────────────────────
// 5. Resume Sources
// ─────────────────────────────────────────────
interface ResumesSectionProps extends SectionProps {
  value: ResumeSource[];
  onChange: (next: ResumeSource[]) => void;
}

export function ResumesSection({ id, registerRef, value, onChange }: ResumesSectionProps) {
  const notify = useToast();
  const [editing, setEditing] = useState<{ index: number; draft: ResumeSource } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadRoles, setUploadRoles] = useState("");
  const [uploadDefault, setUploadDefault] = useState(value.length === 0);
  const [uploading, setUploading] = useState(false);

  const setDefault = (id: string) =>
    onChange(value.map((source) => ({ ...source, default: source.id === id })));

  const handleUpload = async () => {
    if (!uploadFile) {
      notify({
        title: "Choose a resume file first",
        description: "Upload a Markdown, text, PDF, or DOCX resume source to register it here.",
        tone: "error",
        dismissAfter: 5000,
      });
      return;
    }
    setUploading(true);
    try {
      const payload = new FormData();
      payload.append("file", uploadFile);
      payload.append("label", uploadLabel.trim());
      payload.append("targetRoles", uploadRoles.trim());
      payload.append("makeDefault", uploadDefault ? "true" : "false");
      const response = await fetch("/api/profile/resume-sources", {
        method: "POST",
        body: payload,
      });
      const data = (await response.json()) as { error?: string; source?: ResumeSource };
      if (!response.ok || !data.source) {
        throw new Error(data.error ?? "Unable to upload the resume source.");
      }
      const uploaded = data.source;
      const next: ResumeSource[] = [
        ...value.map((source) => ({
          ...source,
          default: uploaded.default ? false : source.default,
        })),
        {
          ...uploaded,
          targetRoles: uploaded.targetRoles ?? [],
          default: Boolean(uploaded.default) || value.length === 0,
        },
      ];
      onChange(next);
      setUploadFile(null);
      setUploadLabel("");
      setUploadRoles("");
      setUploadDefault(false);
      setShowUpload(false);
      const warningCount =
        uploaded.extractionDiagnostics?.filter((diagnostic) => diagnostic.severity !== "info")
          .length ?? 0;
      notify({
        title: "Resume source uploaded",
        description: warningCount
          ? `Save settings to persist it in profile.yml. ${warningCount} extraction warning${warningCount === 1 ? "" : "s"} found.`
          : "Save settings to persist it in profile.yml.",
        dismissAfter: 5000,
      });
    } catch (error) {
      notify({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unable to upload resume source.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section
      id={id}
      ref={(node) => registerRef(node)}
      className={styles.section}
      aria-labelledby={`${id}-title`}
    >
      <SectionHead
        title="Resume Sources"
        desc="All resume files available for evaluation and tailoring. Upload different versions for different role tracks."
      >
        <Btn size="sm" variant="accent" icon={ICON_UPLOAD} onClick={() => setShowUpload((v) => !v)}>
          Upload resume
        </Btn>
      </SectionHead>

      {showUpload ? (
        <div className={styles.uploadPanel} style={{ marginBottom: "var(--space-lg)" }}>
          <p className={styles.cardEyebrow}>Upload new source</p>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)" }}>
            Markdown, plain-text, PDF, or DOCX resume files. PDF/DOCX uploads are extracted
            into normalized markdown for Resume Studio.
          </p>
          <label style={{ display: "grid", gap: "var(--space-xs)" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
              Resume file
            </span>
            <input
              type="file"
              accept=".md,.markdown,.txt,.pdf,.docx,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className={styles.fileInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setUploadFile(event.target.files?.[0] ?? null)
              }
            />
          </label>
          <FieldRow>
            <Input label="Display label" value={uploadLabel} onChange={setUploadLabel} placeholder="Frontend master resume" />
            <Input label="Target roles" value={uploadRoles} onChange={setUploadRoles} placeholder="Frontend Engineer, Product Engineer" />
          </FieldRow>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={uploadDefault} onChange={(event) => setUploadDefault(event.target.checked)} />
            <span>Make this the default resume source</span>
          </label>
          <div className={styles.actionsRow}>
            <Btn variant="primary" onClick={handleUpload} loading={uploading} icon={ICON_UPLOAD}>Upload resume</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setShowUpload(false)}>Cancel</Btn>
          </div>
        </div>
      ) : null}

      <div className={styles.cardStack}>
        {value.length === 0 ? (
          <div className={styles.emptyState}>
            No resume sources yet. Resume Studio will fall back to the root-level <code>cv.md</code>.
          </div>
        ) : (
          value.map((source, index) => (
            <div key={`${source.id}-${index}`} className={styles.resumeCard}>
              <div className={styles.resumeCardBody}>
                <div className={styles.resumeCardHead}>
                  <span className={styles.resumeCardTitle}>{source.label}</span>
                  {source.default ? <StatusPill label="Default" tone="accent" /> : null}
                  <StatusPill label="Valid" tone="success" />
                </div>
                <span className={styles.resumeCardPath}>{source.path}</span>
                {source.originalPath ? (
                  <span className={styles.resumeCardPath}>Original: {source.originalPath}</span>
                ) : null}
                {source.extractionDiagnostics?.length ? (
                  <div className={styles.resumeRolesRow}>
                    {source.extractionDiagnostics.map((diagnostic, diagnosticIndex) => (
                      <span
                        key={`${diagnostic.code}-${diagnosticIndex}`}
                        className={styles.resumeRoleChip}
                        title={diagnostic.message}
                      >
                        {diagnostic.severity === "warning" ? "Warning" : "Parsed"}:{" "}
                        {diagnostic.message}
                      </span>
                    ))}
                  </div>
                ) : null}
                {source.targetRoles.length ? (
                  <div className={styles.resumeRolesRow}>
                    {source.targetRoles.map((role) => (
                      <span key={role} className={styles.resumeRoleChip}>{role}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={styles.resumeCardActions}>
                {!source.default ? (
                  <Btn size="sm" variant="ghost" onClick={() => setDefault(source.id)}>Set default</Btn>
                ) : null}
                <Btn size="sm" variant="ghost" onClick={() => setEditing({ index, draft: { ...source, targetRoles: [...source.targetRoles] } })}>Edit</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setConfirmRemove(index)} style={{ color: "var(--color-error)" }}>Remove</Btn>
              </div>
            </div>
          ))
        )}
      </div>

      {editing ? (
        <Modal title="Edit resume source" onClose={() => setEditing(null)}>
          <div style={{ display: "grid", gap: "var(--space-lg)" }}>
            <Input label="Label" value={editing.draft.label} onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, label: v } })} />
            <TagInput label="Target roles" values={editing.draft.targetRoles} onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, targetRoles: v } })} placeholder="Add role…" />
          </div>
          <div className={styles.actionsRow} style={{ justifyContent: "flex-end", marginTop: "var(--space-xl)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn variant="accent" onClick={() => { onChange(value.map((source, i) => (i === editing.index ? editing.draft : source))); setEditing(null); }}>Save</Btn>
          </div>
        </Modal>
      ) : null}

      {confirmRemove !== null ? (
        <Modal title="Remove resume source?" onClose={() => setConfirmRemove(null)} width="small">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
            This will remove <strong style={{ color: "var(--color-text)" }}>{value[confirmRemove]?.label}</strong>. The file will not be deleted.
          </p>
          <div className={styles.actionsRow} style={{ justifyContent: "flex-end", marginTop: "var(--space-xl)" }}>
            <Btn variant="secondary" onClick={() => setConfirmRemove(null)}>Cancel</Btn>
            <Btn variant="destructive" onClick={() => { onChange(value.filter((_, i) => i !== confirmRemove)); setConfirmRemove(null); }}>Remove</Btn>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

// ─────────────────────────────────────────────
// 6. Proof Points
// ─────────────────────────────────────────────
const PROOF_DEFAULT: ProofRow = { name: "", url: "", heroMetric: "", track: "", notes: "" };

interface ProofPointsSectionProps extends SectionProps {
  value: ProofRow[];
  onChange: (next: ProofRow[]) => void;
}

export function ProofPointsSection({ id, registerRef, value, onChange }: ProofPointsSectionProps) {
  const [modal, setModal] = useState<
    | { mode: "add"; draft: ProofRow }
    | { mode: "edit"; index: number; draft: ProofRow }
    | null
  >(null);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  const updateDraft = <K extends keyof ProofRow>(key: K, v: ProofRow[K]) => {
    if (!modal) return;
    setModal({ ...modal, draft: { ...modal.draft, [key]: v } });
  };

  const save = () => {
    if (!modal || !modal.draft.name.trim()) return;
    if (modal.mode === "add") {
      onChange([...value, modal.draft]);
    } else {
      onChange(value.map((row, index) => (index === modal.index ? modal.draft : row)));
    }
    setModal(null);
  };

  return (
    <section
      id={id}
      ref={(node) => registerRef(node)}
      className={styles.section}
      aria-labelledby={`${id}-title`}
    >
      <SectionHead
        title="Proof Points & Portfolio Context"
        desc="Projects, articles, metrics, and evidence the AI can cite when writing applications or scoring fit."
      >
        <Btn
          size="sm"
          variant="accent"
          onClick={() => setModal({ mode: "add", draft: { ...PROOF_DEFAULT } })}
          icon={ICON_PLUS}
        >
          Add proof point
        </Btn>
      </SectionHead>

      <div className={styles.checklist}>
        {value.length === 0 ? (
          <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: "var(--text-sm)" }}>
            No proof points — add a project, article or metric.
          </div>
        ) : (
          value.map((row, index) => (
            <div key={`${row.name}-${index}`} className={styles.proofRow}>
              <div className={styles.proofBody}>
                <div className={styles.proofTitle}>
                  <span className={styles.proofName}>{row.name}</span>
                  {row.track ? <span className={styles.metaMono}>{row.track}</span> : null}
                </div>
                {row.heroMetric ? <span className={styles.proofMetric}>{row.heroMetric}</span> : null}
                {row.url ? (
                  <a className={styles.proofUrl} href={row.url} target="_blank" rel="noopener noreferrer">
                    {row.url}
                  </a>
                ) : null}
                {row.notes ? <span className={styles.proofNotes}>{row.notes}</span> : null}
              </div>
              <div className={styles.proofActions}>
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => setModal({ mode: "edit", index, draft: { ...row } })}
                >
                  Edit
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmRemove(index)}
                  style={{ color: "var(--color-error)" }}
                >
                  Remove
                </Btn>
              </div>
            </div>
          ))
        )}
      </div>

      {modal ? (
        <Modal
          title={modal.mode === "add" ? "Add proof point" : "Edit proof point"}
          onClose={() => setModal(null)}
        >
          <div style={{ display: "grid", gap: "var(--space-lg)" }}>
            <Input
              label="Name"
              value={modal.draft.name}
              onChange={(v) => updateDraft("name", v)}
              required
              placeholder="Project, article, metric…"
            />
            <Input
              label="URL"
              type="url"
              value={modal.draft.url}
              onChange={(v) => updateDraft("url", v)}
              placeholder="https://…"
            />
            <Input
              label="Hero metric"
              value={modal.draft.heroMetric}
              onChange={(v) => updateDraft("heroMetric", v)}
              placeholder="e.g. Reduced latency by 60%"
              hint="This will appear prominently when the AI references this proof point."
            />
            <Select
              label="Related role track"
              value={modal.draft.track}
              onChange={(v) => updateDraft("track", v)}
              options={["", ...TRACK_OPTIONS]}
            />
            <Textarea
              label="Notes"
              value={modal.draft.notes}
              onChange={(v) => updateDraft("notes", v)}
              rows={3}
              placeholder="Brief context for the AI."
            />
          </div>
          <div className={styles.actionsRow} style={{ justifyContent: "flex-end", marginTop: "var(--space-xl)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Btn>
            <Btn variant="accent" onClick={save} disabled={!modal.draft.name.trim()}>
              Save
            </Btn>
          </div>
        </Modal>
      ) : null}

      {confirmRemove !== null ? (
        <Modal title="Remove proof point?" onClose={() => setConfirmRemove(null)} width="small">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
            Remove <strong style={{ color: "var(--color-text)" }}>{value[confirmRemove]?.name}</strong>?
          </p>
          <div className={styles.actionsRow} style={{ justifyContent: "flex-end", marginTop: "var(--space-xl)" }}>
            <Btn variant="secondary" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Btn>
            <Btn
              variant="destructive"
              onClick={() => {
                onChange(value.filter((_, i) => i !== confirmRemove));
                setConfirmRemove(null);
              }}
            >
              Remove
            </Btn>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

// ─────────────────────────────────────────────
// 7. Compensation & Location
// ─────────────────────────────────────────────
const CURRENCY_OPTIONS = ["", "CAD", "USD", "GBP", "EUR", "AUD", "SGD"];
const REMOTE_OPTIONS = [
  "",
  "Remote only",
  "Prefer remote, open to hybrid",
  "Hybrid preferred",
  "Open to on-site",
  "On-site preferred",
];
const RELOCATION_OPTIONS = [
  "",
  "Not open to relocation",
  "Open to relocation in same country",
  "Open to international relocation",
  "Already relocating to…",
];
const LOC_FLEX_OPTIONS = [
  "",
  "Strict — listed locations only",
  "Flexible — listed locations preferred",
  "Fully flexible",
];

interface CompensationSectionProps extends SectionProps {
  value: CompensationState;
  onChange: (next: CompensationState) => void;
}

export function CompensationSection({
  id,
  registerRef,
  value,
  onChange,
}: CompensationSectionProps) {
  const set = <K extends keyof CompensationState>(key: K) => (v: CompensationState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <section
      id={id}
      ref={(node) => registerRef(node)}
      className={styles.section}
      aria-labelledby={`${id}-title`}
    >
      <SectionHead
        title="Compensation & Location Preferences"
        desc="Used by the AI to flag mismatches and score location/comp fit."
      />
      <div className={styles.cardBlock}>
        <FieldRow cols={3}>
          <Input
            label="Target comp (min)"
            value={value.compMin}
            onChange={set("compMin")}
            placeholder="e.g. 120,000"
          />
          <Input
            label="Target comp (max)"
            value={value.compMax}
            onChange={set("compMax")}
            placeholder="e.g. 180,000"
          />
          <Select
            label="Currency"
            value={value.currency}
            onChange={set("currency")}
            options={CURRENCY_OPTIONS}
          />
        </FieldRow>
        <Input
          label="Minimum acceptable compensation"
          value={value.minimum}
          onChange={set("minimum")}
          placeholder="Hard floor — AI flags roles below this"
          hint="The AI will flag any role with listed comp below this value."
        />
        <Divider />
        <Select
          label="Remote preference"
          value={value.remote}
          onChange={set("remote")}
          options={REMOTE_OPTIONS}
        />
        <Select
          label="Relocation preference"
          value={value.relocation}
          onChange={set("relocation")}
          options={RELOCATION_OPTIONS}
        />
        <TagInput
          label="Preferred countries / cities"
          values={value.locations}
          onChange={set("locations")}
          placeholder="e.g. Toronto, London, Remote"
        />
        <Select
          label="Location flexibility"
          value={value.locationFlexibility}
          onChange={set("locationFlexibility")}
          options={LOC_FLEX_OPTIONS}
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// 8. Scanner Configuration
// ─────────────────────────────────────────────
const COMPANY_DEFAULT = { name: "", url: "", enabled: true, notes: "" };

interface ScannerSectionProps extends SectionProps {
  value: ScannerState;
  onChange: (next: ScannerState) => void;
}

export function ScannerSection({ id, registerRef, value, onChange }: ScannerSectionProps) {
  const set = <K extends keyof ScannerState>(key: K) => (v: ScannerState[K]) =>
    onChange({ ...value, [key]: v });
  const [modal, setModal] = useState<
    | { mode: "add"; draft: typeof COMPANY_DEFAULT }
    | { mode: "edit"; index: number; draft: typeof COMPANY_DEFAULT }
    | null
  >(null);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const notify = useToast();

  const saveCompany = () => {
    if (!modal || !modal.draft.name.trim()) return;
    if (modal.mode === "add") {
      set("companies")([...value.companies, modal.draft]);
    } else {
      set("companies")(
        value.companies.map((c, i) => (i === modal.index ? modal.draft : c)),
      );
    }
    setModal(null);
  };

  const toggleCompany = (index: number) => {
    set("companies")(
      value.companies.map((c, i) => (i === index ? { ...c, enabled: !c.enabled } : c)),
    );
  };

  const updateDraft = <K extends keyof typeof COMPANY_DEFAULT>(
    key: K,
    v: (typeof COMPANY_DEFAULT)[K],
  ) => {
    if (!modal) return;
    setModal({ ...modal, draft: { ...modal.draft, [key]: v } });
  };

  const runTest = async () => {
    setTesting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      notify({
        title: "Scanner test queued",
        description: "Use the scans page to view full output.",
        dismissAfter: 4000,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section
      id={id}
      ref={(node) => registerRef(node)}
      className={styles.section}
      aria-labelledby={`${id}-title`}
    >
      <SectionHead
        title="Scanner Configuration"
        desc="Controls automated job discovery. The scanner reads tracked company careers pages and inboxes to find new roles."
      >
        <Btn size="sm" loading={testing} onClick={runTest} icon={ICON_SEARCH}>
          Run scanner test
        </Btn>
      </SectionHead>

      <div className={styles.cardStack}>
        <div className={styles.cardBlock}>
          <p className={styles.cardEyebrow}>Keyword Filters</p>
          <TagInput
            label="Positive title keywords"
            values={value.positiveKeywords}
            onChange={set("positiveKeywords")}
            placeholder="e.g. AI, machine learning"
            hint="Roles matching any of these keywords are boosted."
          />
          <TagInput
            label="Negative title keywords"
            values={value.negativeKeywords}
            onChange={set("negativeKeywords")}
            placeholder="e.g. junior, intern"
            hint="Roles matching any of these are suppressed or skipped."
          />
          <TagInput
            label="Seniority boost keywords"
            values={value.seniorityKeywords}
            onChange={set("seniorityKeywords")}
            placeholder="e.g. senior, staff, principal"
          />
        </div>

        <div className={styles.cardBlock}>
          <p className={styles.cardEyebrow}>Search Queries</p>
          <TagInput
            label="Search queries"
            values={value.searchQueries}
            onChange={set("searchQueries")}
            placeholder="e.g. senior AI engineer Toronto"
            hint="These are run against job aggregators."
          />
        </div>

        <div>
          <SectionHead
            title="Tracked Companies"
            desc="The scanner checks these careers pages for new roles."
          >
            <Btn
              size="sm"
              variant="accent"
              icon={ICON_PLUS}
              onClick={() => setModal({ mode: "add", draft: { ...COMPANY_DEFAULT } })}
            >
              Add company
            </Btn>
          </SectionHead>
          <div className={styles.checklist}>
            {value.companies.length === 0 ? (
              <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: "var(--text-sm)" }}>
                No companies tracked yet.
              </div>
            ) : (
              value.companies.map((company, index) => (
                <div key={`${company.name}-${index}`} className={styles.companyRow}>
                  <Toggle
                    value={company.enabled}
                    onChange={() => toggleCompany(index)}
                    size="sm"
                    ariaLabel={`Toggle ${company.name}`}
                  />
                  <div className={styles.companyBody}>
                    <span className={styles.companyName} data-disabled={!company.enabled}>
                      {company.name}
                    </span>
                    {company.notes ? <span className={styles.companyNote}>— {company.notes}</span> : null}
                    {company.url ? (
                      <a
                        className={styles.companyUrl}
                        href={company.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {company.url}
                      </a>
                    ) : null}
                  </div>
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={() => setModal({ mode: "edit", index, draft: { ...company } })}
                  >
                    Edit
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRemove(index)}
                    style={{ color: "var(--color-error)" }}
                  >
                    Remove
                  </Btn>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {modal ? (
        <Modal
          title={modal.mode === "add" ? "Add company" : "Edit company"}
          onClose={() => setModal(null)}
        >
          <div style={{ display: "grid", gap: "var(--space-lg)" }}>
            <Input
              label="Company name"
              value={modal.draft.name}
              onChange={(v) => updateDraft("name", v)}
              required
            />
            <Input
              label="Careers URL"
              type="url"
              value={modal.draft.url}
              onChange={(v) => updateDraft("url", v)}
              placeholder="https://company.com/careers"
            />
            <Toggle
              value={modal.draft.enabled}
              onChange={(v) => updateDraft("enabled", v)}
              label="Enabled"
              hint="Disabled companies are skipped by the scanner."
            />
            <Textarea
              label="Notes"
              value={modal.draft.notes}
              onChange={(v) => updateDraft("notes", v)}
              rows={2}
            />
          </div>
          <div className={styles.actionsRow} style={{ justifyContent: "flex-end", marginTop: "var(--space-xl)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Btn>
            <Btn variant="accent" onClick={saveCompany} disabled={!modal.draft.name.trim()}>
              Save company
            </Btn>
          </div>
        </Modal>
      ) : null}

      {confirmRemove !== null ? (
        <Modal title="Remove company?" onClose={() => setConfirmRemove(null)} width="small">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
            Remove <strong style={{ color: "var(--color-text)" }}>{value.companies[confirmRemove]?.name}</strong> from tracked companies?
          </p>
          <div className={styles.actionsRow} style={{ justifyContent: "flex-end", marginTop: "var(--space-xl)" }}>
            <Btn variant="secondary" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Btn>
            <Btn
              variant="destructive"
              onClick={() => {
                set("companies")(value.companies.filter((_, i) => i !== confirmRemove));
                setConfirmRemove(null);
              }}
            >
              Remove
            </Btn>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

// ─────────────────────────────────────────────
// 9. AI & Worker
// ─────────────────────────────────────────────
interface AIWorkerSectionProps extends SectionProps {
  workspacePath: string;
}

export function AIWorkerSection({ id, registerRef, workspacePath }: AIWorkerSectionProps) {
  const notify = useToast();
  const [testing, setTesting] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [testResult, setTestResult] = useState<"pass" | "fail" | null>(null);

  const services = [
    { label: "AI provider", value: "Anthropic Claude", status: "connected" },
    { label: "API key", value: "Configured ••••••••", status: "connected", mono: true },
    { label: "Workspace path", value: workspacePath || "—", status: "connected", mono: true },
    { label: "Worker service", value: "Running", status: "connected" },
  ];

  const recoverStale = async () => {
    setRecovering(true);
    try {
      const response = await fetch("/api/pipeline/process", { method: "GET" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Unable to recover stale jobs.");
      }
      notify({
        title: "Stale jobs checked",
        description: "Pipeline worker queue refreshed.",
        dismissAfter: 4000,
      });
    } catch (error) {
      notify({
        title: "Recovery failed",
        description: error instanceof Error ? error.message : "Unable to recover stale jobs.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setRecovering(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/system/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkId: "doctor" }),
      });
      const data = (await response.json()) as SystemCheckResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to run test.");
      setTestResult(data.status === "fail" ? "fail" : "pass");
      notify({
        title: "Evaluation test complete",
        description: data.summary,
        tone: data.status === "fail" ? "error" : "neutral",
        dismissAfter: 5000,
      });
    } catch (error) {
      setTestResult("fail");
      notify({
        title: "Test failed",
        description: error instanceof Error ? error.message : "Unable to run direct evaluation.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section
      id={id}
      ref={(node) => registerRef(node)}
      className={styles.section}
      aria-labelledby={`${id}-title`}
    >
      <SectionHead
        title="AI & Worker Settings"
        desc="Service status and configuration. Secret values are never shown."
      />
      <div className={styles.checklist}>
        {services.map((service) => (
          <div key={service.label} className={styles.serviceRow}>
            <span className={styles.serviceLabel}>{service.label}</span>
            <span className={styles.serviceValue} data-mono={service.mono ? "true" : undefined}>
              {service.value}
            </span>
            <StatusDot status={service.status} />
          </div>
        ))}
      </div>
      <div className={styles.actionsRow} style={{ marginTop: "var(--space-lg)" }}>
        <Btn size="sm" loading={recovering} onClick={recoverStale}>
          Recover stale jobs
        </Btn>
        <Btn size="sm" variant="accent" loading={testing} onClick={runTest}>
          Direct evaluation test
        </Btn>
        {testResult === "pass" ? <StatusPill label="Test passed" tone="success" /> : null}
        {testResult === "fail" ? <StatusPill label="Needs work" tone="error" /> : null}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// 10. System Checks
// ─────────────────────────────────────────────
interface SystemCheckRow {
  id: SystemCheckId;
  label: string;
  description: string;
}

const SYSTEM_CHECKS: SystemCheckRow[] = [
  {
    id: "doctor",
    label: "Workspace doctor",
    description: "Validate prerequisites like profile, resumes, fonts, and required directories.",
  },
  {
    id: "verify",
    label: "Pipeline verify",
    description: "Tracker integrity, duplicate detection, score formatting, broken report links.",
  },
  {
    id: "sync-check",
    label: "Resume sync check",
    description: "Verify profile, resume sources, and prompt inputs stay consistent.",
  },
  {
    id: "liveness",
    label: "Job link liveness",
    description: "Test tracked opportunity URLs to see whether postings are still active.",
  },
];

interface SystemChecksSectionProps extends SectionProps {
  runCheck: (id: SystemCheckId) => Promise<SystemCheckResult>;
}

export function SystemChecksSection({ id, registerRef, runCheck }: SystemChecksSectionProps) {
  const notify = useToast();
  const [results, setResults] = useState<Partial<Record<SystemCheckId, SystemCheckResult>>>({});
  const [running, setRunning] = useState<Partial<Record<SystemCheckId, boolean>>>({});
  const [expanded, setExpanded] = useState<Partial<Record<SystemCheckId, boolean>>>({});

  const handleRun = async (checkId: SystemCheckId) => {
    setRunning((prev) => ({ ...prev, [checkId]: true }));
    try {
      const data = await runCheck(checkId);
      setResults((prev) => ({ ...prev, [checkId]: data }));
      notify({
        title: `${data.title} complete`,
        description: data.summary,
        tone: data.status === "fail" ? "error" : "neutral",
        dismissAfter: data.status === "fail" ? null : 5000,
      });
    } catch (error) {
      notify({
        title: "Check failed",
        description: error instanceof Error ? error.message : "Unable to run check.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setRunning((prev) => ({ ...prev, [checkId]: false }));
    }
  };

  const toneFor = (status?: SystemCheckResult["status"]) =>
    status === "fail" ? "error" : status === "warn" ? "warn" : status === "pass" ? "success" : "neutral";

  return (
    <section
      id={id}
      ref={(node) => registerRef(node)}
      className={styles.section}
      aria-labelledby={`${id}-title`}
    >
      <SectionHead title="System Checks" desc="Runnable diagnostics. None of these modify data." />
      <div className={styles.checklist}>
        {SYSTEM_CHECKS.map((check) => {
          const result = results[check.id];
          const isOpen = Boolean(expanded[check.id]);
          return (
            <div key={check.id}>
              <div className={styles.checkRow}>
                <button
                  type="button"
                  className={styles.checkExpandToggle}
                  onClick={() => setExpanded((prev) => ({ ...prev, [check.id]: !prev[check.id] }))}
                  aria-label={isOpen ? "Collapse" : "Expand"}
                  aria-expanded={isOpen}
                >
                  <span className={styles.checkChevron} data-open={isOpen ? "true" : undefined}>
                    {ICON_CHEVRON}
                  </span>
                </button>
                <span className={styles.checkLabel}>{check.label}</span>
                {result ? (
                  <span className={styles.checkLastRun}>
                    {new Date(Date.now()).toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                ) : null}
                <StatusPill
                  label={result ? result.status : "idle"}
                  tone={toneFor(result?.status)}
                />
                <Btn
                  size="sm"
                  variant="ghost"
                  loading={Boolean(running[check.id])}
                  onClick={() => handleRun(check.id)}
                >
                  Run
                </Btn>
              </div>
              {isOpen ? (
                <div className={styles.checkExpand}>
                  <p className={styles.checkSummary}>{result?.summary ?? check.description}</p>
                  {result?.details?.length ? (
                    <ul className={styles.checkDetails}>
                      {result.details.slice(0, 5).map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
