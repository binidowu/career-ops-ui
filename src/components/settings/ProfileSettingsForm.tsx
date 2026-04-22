"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import { useTheme } from "@/components/common/ThemeProvider";
import type { ResumeSource, UserProfile } from "@/lib/types";

import styles from "./ProfileSettingsForm.module.css";

interface ProfileSettingsFormProps {
  hasExistingProfile: boolean;
  initialProfile: UserProfile;
}

interface FormState {
  city: string;
  country: string;
  currency: string;
  email: string;
  exitStory: string;
  fullName: string;
  headline: string;
  location: string;
  minimum: string;
  primaryRoles: string;
  resumeSources: ResumeSource[];
  superpowers: string;
  targetRange: string;
  timezone: string;
}

function listToLine(values: string[]) {
  return values.join(", ");
}

function lineToList(value: string) {
  return value
    .split(/,|\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function cloneResumeSources(sources: ResumeSource[]) {
  return sources.map((source) => ({
    ...source,
    targetRoles: [...source.targetRoles],
  }));
}

function createFormState(profile: UserProfile): FormState {
  return {
    fullName: profile.candidate.fullName,
    email: profile.candidate.email,
    location: profile.candidate.location,
    headline: profile.narrative.headline,
    exitStory: profile.narrative.exitStory,
    primaryRoles: listToLine(profile.targetRoles.primary),
    superpowers: listToLine(profile.narrative.superpowers),
    targetRange: profile.compensation.targetRange,
    currency: profile.compensation.currency,
    minimum: profile.compensation.minimum,
    country: profile.location.country,
    city: profile.location.city,
    timezone: profile.location.timezone,
    resumeSources: cloneResumeSources(profile.resumeSources ?? []),
  };
}

function ensureDefaultResumeSource(sources: ResumeSource[]) {
  if (!sources.length) {
    return [];
  }

  const alreadyDefault = sources.some((source) => source.default);
  if (alreadyDefault) {
    return sources;
  }

  return sources.map((source, index) => ({
    ...source,
    default: index === 0,
  }));
}

export default function ProfileSettingsForm({
  hasExistingProfile,
  initialProfile,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const notify = useToast();
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [form, setForm] = useState<FormState>(() => createFormState(initialProfile));
  const [weights, setWeights] = useState({
    careerGrowth: 80,
    techStack: 95,
    workLife: 60,
  });
  const [uploadState, setUploadState] = useState({
    file: null as File | null,
    label: "",
    makeDefault: (initialProfile.resumeSources?.length ?? 0) === 0,
    targetRoles: "",
  });

  const initial = useMemo(() => createFormState(initialProfile), [initialProfile]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function field(key: Exclude<keyof FormState, "resumeSources">) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: e.target.value }));
  }

  function updateResumeSource(index: number, next: Partial<ResumeSource>) {
    setForm((current) => ({
      ...current,
      resumeSources: current.resumeSources.map((source, sourceIndex) =>
        sourceIndex === index ? { ...source, ...next } : source,
      ),
    }));
  }

  function setDefaultResumeSource(index: number) {
    setForm((current) => ({
      ...current,
      resumeSources: current.resumeSources.map((source, sourceIndex) => ({
        ...source,
        default: sourceIndex === index,
      })),
    }));
  }

  function removeResumeSource(index: number) {
    setForm((current) => {
      const resumeSources = current.resumeSources.filter((_, sourceIndex) => sourceIndex !== index);
      return {
        ...current,
        resumeSources: ensureDefaultResumeSource(resumeSources),
      };
    });
  }

  async function handleUploadResume() {
    if (!uploadState.file) {
      notify({
        title: "Choose a resume file first",
        description: "Upload a markdown or plain-text resume source to register it here.",
        tone: "error",
        dismissAfter: 5000,
      });
      return;
    }

    setUploadingResume(true);

    try {
      const payload = new FormData();
      payload.append("file", uploadState.file);
      payload.append("label", uploadState.label.trim());
      payload.append("targetRoles", uploadState.targetRoles.trim());
      payload.append("makeDefault", uploadState.makeDefault ? "true" : "false");

      const response = await fetch("/api/profile/resume-sources", {
        method: "POST",
        body: payload,
      });
      const data = (await response.json()) as {
        error?: string;
        source?: ResumeSource;
      };

      if (!response.ok || !data.source) {
        throw new Error(data.error ?? "Unable to upload the resume source.");
      }
      const uploadedSource = data.source;

      setForm((current) => {
        const resumeSources = current.resumeSources.map((source) => ({
          ...source,
          default: uploadedSource.default ? false : source.default,
        }));
        const nextSource: ResumeSource = {
          ...uploadedSource,
          targetRoles: uploadedSource.targetRoles ?? [],
          default: Boolean(uploadedSource.default) || resumeSources.length === 0,
        };

        return {
          ...current,
          resumeSources: ensureDefaultResumeSource([
            ...resumeSources,
            nextSource,
          ]),
        };
      });

      setUploadState({
        file: null,
        label: "",
        makeDefault: false,
        targetRoles: "",
      });

      notify({
        title: "Resume source uploaded",
        description: "It has been added to the form. Save configuration to persist it in profile.yml.",
        dismissAfter: 5000,
      });
    } catch (error) {
      notify({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "Unable to upload the resume source.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setUploadingResume(false);
    }
  }

  async function handleSave() {
    setSaving(true);

    const nextProfile: UserProfile = {
      ...initialProfile,
      candidate: {
        ...initialProfile.candidate,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        location: form.location.trim(),
      },
      targetRoles: {
        ...initialProfile.targetRoles,
        primary: lineToList(form.primaryRoles),
      },
      narrative: {
        ...initialProfile.narrative,
        headline: form.headline.trim(),
        exitStory: form.exitStory.trim(),
        superpowers: lineToList(form.superpowers),
      },
      compensation: {
        ...initialProfile.compensation,
        targetRange: form.targetRange.trim(),
        currency: form.currency.trim(),
        minimum: form.minimum.trim(),
      },
      location: {
        ...initialProfile.location,
        country: form.country.trim(),
        city: form.city.trim(),
        timezone: form.timezone.trim(),
      },
      resumeSources: ensureDefaultResumeSource(
        form.resumeSources.map((source, index) => ({
          id: source.id.trim() || `resume-${index + 1}`,
          label: source.label.trim() || source.id.trim() || `Resume ${index + 1}`,
          path: source.path.trim(),
          default: Boolean(source.default),
          targetRoles: source.targetRoles
            .map((role) => role.trim())
            .filter(Boolean),
        })),
      ).filter((source) => source.path),
    };

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: nextProfile }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save profile.");
      }

      notify({
        title: hasExistingProfile ? "Configuration saved" : "Configuration created",
        description: "Your Career-Ops profile has been updated.",
        dismissAfter: 4000,
      });
      router.refresh();
    } catch (error) {
      notify({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to write profile.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setSaving(false);
    }
  }

  const themeOptions: { value: "light" | "dark" | "system"; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  return (
    <div className={styles.form}>
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Appearance</h2>
        <div className={styles.sectionBody}>
          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Theme</span>
              <div className={styles.themeSegment} role="group" aria-label="Theme preference">
                {themeOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    className={styles.themeOption}
                    data-active={theme === value}
                    onClick={() => setTheme(value)}
                    type="button"
                    aria-pressed={theme === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className={styles.themeHint}>
                Light is the default. System follows your OS preference.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Career Positioning</h2>
        <div className={styles.sectionBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Target Roles</span>
              <input
                className={styles.control}
                onChange={field("primaryRoles")}
                placeholder="Senior Backend Engineer, Systems Architect"
                value={form.primaryRoles}
              />
              <span className={styles.fieldHint}>Comma separated list of primary job titles.</span>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Target Geographies</span>
              <input
                className={styles.control}
                onChange={field("city")}
                placeholder="San Francisco, CA; Remote (US)"
                value={form.city}
              />
            </label>

            <div className={styles.twoCol}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Full Name</span>
                <input className={styles.control} onChange={field("fullName")} value={form.fullName} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Email</span>
                <input className={styles.control} onChange={field("email")} value={form.email} />
              </label>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Narrative &amp; Identity</h2>
        <div className={styles.sectionBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Headline</span>
              <input
                className={styles.control}
                onChange={field("headline")}
                placeholder="Senior Technical Lead & Systems Architect"
                value={form.headline}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Exit Story</span>
              <textarea
                className={styles.textarea}
                onChange={field("exitStory")}
                placeholder="Why you're looking, what you're optimizing for…"
                rows={3}
                value={form.exitStory}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Core Superpowers</span>
              <textarea
                className={styles.textarea}
                onChange={field("superpowers")}
                placeholder="Distributed systems, cross-functional leadership, scaling infrastructure…"
                rows={3}
                value={form.superpowers}
              />
              <span className={styles.fieldHint}>Comma separated list of key capabilities.</span>
            </label>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Resume Sources</h2>
        <div className={styles.sectionBody}>
          <div className={styles.resumeUploadPanel}>
            <div className={styles.panelIntro}>
              <p className={styles.fieldLabel}>Upload new source</p>
              <p className={styles.fieldHint}>
                Upload markdown or plain-text resume files. PDF and DOCX ingestion still needs backend parsing work.
              </p>
            </div>

            <div className={styles.resumeUploadFields}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Resume file</span>
                <input
                  accept=".md,.txt,text/markdown,text/plain"
                  className={styles.fileInput}
                  onChange={(event) =>
                    setUploadState((current) => ({
                      ...current,
                      file: event.target.files?.[0] ?? null,
                    }))
                  }
                  type="file"
                />
              </label>
              <div className={styles.twoCol}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Display label</span>
                  <input
                    className={styles.control}
                    onChange={(event) =>
                      setUploadState((current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                    placeholder="Frontend master resume"
                    value={uploadState.label}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Target roles</span>
                  <input
                    className={styles.control}
                    onChange={(event) =>
                      setUploadState((current) => ({
                        ...current,
                        targetRoles: event.target.value,
                      }))
                    }
                    placeholder="Frontend Engineer, Product Engineer"
                    value={uploadState.targetRoles}
                  />
                </label>
              </div>
              <label className={styles.checkboxRow}>
                <input
                  checked={uploadState.makeDefault}
                  onChange={(event) =>
                    setUploadState((current) => ({
                      ...current,
                      makeDefault: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span>Make this the default resume source</span>
              </label>
              <button
                className={styles.uploadButton}
                disabled={uploadingResume}
                onClick={() => void handleUploadResume()}
                type="button"
              >
                {uploadingResume ? "Uploading…" : "Upload Resume Source"}
              </button>
            </div>
          </div>

          <div className={styles.resumeSourceList}>
            {form.resumeSources.length ? (
              form.resumeSources.map((source, index) => (
                <article className={styles.resumeSourceCard} key={`${source.id}-${source.path}`}>
                  <div className={styles.resumeSourceHead}>
                    <div>
                      <p className={styles.fieldLabel}>Resume source {index + 1}</p>
                      <p className={styles.resumeSourcePath}>{source.path}</p>
                    </div>
                    <div className={styles.resumeSourceActions}>
                      <button
                        className={styles.pillButton}
                        data-active={source.default}
                        onClick={() => setDefaultResumeSource(index)}
                        type="button"
                      >
                        {source.default ? "Default" : "Set default"}
                      </button>
                      <button
                        className={styles.removeButton}
                        onClick={() => removeResumeSource(index)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className={styles.twoCol}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>ID</span>
                      <input
                        className={styles.control}
                        onChange={(event) => updateResumeSource(index, { id: event.target.value })}
                        value={source.id}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Label</span>
                      <input
                        className={styles.control}
                        onChange={(event) => updateResumeSource(index, { label: event.target.value })}
                        value={source.label}
                      />
                    </label>
                  </div>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Target roles</span>
                    <textarea
                      className={styles.textarea}
                      onChange={(event) =>
                        updateResumeSource(index, {
                          targetRoles: lineToList(event.target.value),
                        })
                      }
                      rows={2}
                      value={listToLine(source.targetRoles)}
                    />
                    <span className={styles.fieldHint}>
                      Optional. Helps you remember which base resume to use for which family of roles.
                    </span>
                  </label>
                </article>
              ))
            ) : (
              <div className={styles.emptyResumeState}>
                <p className={styles.fieldLabel}>No uploaded resume sources yet</p>
                <p className={styles.fieldHint}>
                  If you leave this empty, Resume Studio will still fall back to the root-level <code>cv.md</code>.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Compensation Targets</h2>
        <div className={styles.sectionBody}>
          <div className={styles.threeCol}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Target Range</span>
              <input
                className={styles.control}
                onChange={field("targetRange")}
                placeholder="$180k – $220k"
                value={form.targetRange}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Currency</span>
              <input
                className={styles.control}
                onChange={field("currency")}
                placeholder="USD"
                value={form.currency}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Minimum</span>
              <input
                className={styles.control}
                onChange={field("minimum")}
                placeholder="$160k"
                value={form.minimum}
              />
            </label>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Scoring Dimension Weights</h2>
        <div className={styles.sectionBody}>
          <div className={styles.weightGroup}>
            <div className={styles.weightRow}>
              <span className={styles.weightLabel}>Career Growth Potential</span>
              <span className={styles.weightValue}>{weights.careerGrowth}%</span>
              <input
                className={styles.slider}
                max={100}
                min={0}
                onChange={(e) => setWeights((current) => ({ ...current, careerGrowth: Number(e.target.value) }))}
                type="range"
                value={weights.careerGrowth}
              />
            </div>
            <div className={styles.weightRow}>
              <span className={styles.weightLabel}>Tech-Stack Alignment</span>
              <span className={styles.weightValue}>{weights.techStack}%</span>
              <input
                className={styles.slider}
                max={100}
                min={0}
                onChange={(e) => setWeights((current) => ({ ...current, techStack: Number(e.target.value) }))}
                type="range"
                value={weights.techStack}
              />
            </div>
            <div className={styles.weightRow}>
              <span className={styles.weightLabel}>Work-Life Balance (WLB)</span>
              <span className={styles.weightValue}>{weights.workLife}%</span>
              <input
                className={styles.slider}
                max={100}
                min={0}
                onChange={(e) => setWeights((current) => ({ ...current, workLife: Number(e.target.value) }))}
                type="range"
                value={weights.workLife}
              />
            </div>
          </div>
        </div>
      </section>

      <div className={styles.footer}>
        <button
          className={styles.btnDiscard}
          disabled={!dirty}
          onClick={() => setForm(createFormState(initialProfile))}
          type="button"
        >
          Discard Changes
        </button>
        <button
          className={styles.btnSave}
          disabled={saving || !dirty}
          onClick={() => void handleSave()}
          type="button"
        >
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
