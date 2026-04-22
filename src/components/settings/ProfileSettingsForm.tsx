"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type { UserProfile } from "@/lib/types";

import styles from "./ProfileSettingsForm.module.css";

interface ProfileSettingsFormProps {
  hasExistingProfile: boolean;
  initialProfile: UserProfile;
}

function listToLine(values: string[]) {
  return values.join(", ");
}

function lineToList(value: string) {
  return value.split(/,|\n/).map((e) => e.trim()).filter(Boolean);
}

export default function ProfileSettingsForm({
  hasExistingProfile,
  initialProfile,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const notify = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(() => ({
    fullName: initialProfile.candidate.fullName,
    email: initialProfile.candidate.email,
    location: initialProfile.candidate.location,
    headline: initialProfile.narrative.headline,
    exitStory: initialProfile.narrative.exitStory,
    primaryRoles: listToLine(initialProfile.targetRoles.primary),
    superpowers: listToLine(initialProfile.narrative.superpowers),
    targetRange: initialProfile.compensation.targetRange,
    currency: initialProfile.compensation.currency,
    minimum: initialProfile.compensation.minimum,
    country: initialProfile.location.country,
    city: initialProfile.location.city,
    timezone: initialProfile.location.timezone,
  }));

  const [weights, setWeights] = useState({
    careerGrowth: 80,
    techStack: 95,
    workLife: 60,
  });

  const initial = useMemo(() => ({
    fullName: initialProfile.candidate.fullName,
    email: initialProfile.candidate.email,
    location: initialProfile.candidate.location,
    headline: initialProfile.narrative.headline,
    exitStory: initialProfile.narrative.exitStory,
    primaryRoles: listToLine(initialProfile.targetRoles.primary),
    superpowers: listToLine(initialProfile.narrative.superpowers),
    targetRange: initialProfile.compensation.targetRange,
    currency: initialProfile.compensation.currency,
    minimum: initialProfile.compensation.minimum,
    country: initialProfile.location.country,
    city: initialProfile.location.city,
    timezone: initialProfile.location.timezone,
  }), [initialProfile]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((c) => ({ ...c, [key]: e.target.value }));
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
    };

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: nextProfile }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to save profile.");
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

  return (
    <div className={styles.form}>
      {/* CAREER POSITIONING */}
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

      {/* NARRATIVE */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Narrative &amp; Identity</h2>
        <div className={styles.sectionBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Headline</span>
              <input
                className={styles.control}
                onChange={field("headline")}
                placeholder="Senior Technical Lead &amp; Systems Architect"
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

      {/* COMPENSATION */}
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

      {/* SCORING DIMENSION WEIGHTS */}
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
                onChange={(e) => setWeights((w) => ({ ...w, careerGrowth: Number(e.target.value) }))}
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
                onChange={(e) => setWeights((w) => ({ ...w, techStack: Number(e.target.value) }))}
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
                onChange={(e) => setWeights((w) => ({ ...w, workLife: Number(e.target.value) }))}
                type="range"
                value={weights.workLife}
              />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <div className={styles.footer}>
        <button
          className={styles.btnDiscard}
          disabled={!dirty}
          onClick={() => setForm(initial)}
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
