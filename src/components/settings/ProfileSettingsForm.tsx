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

function listToMultiline(values: string[]) {
  return values.join("\n");
}

function multilineToList(value: string) {
  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
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
    primaryRoles: listToMultiline(initialProfile.targetRoles.primary),
    superpowers: listToMultiline(initialProfile.narrative.superpowers),
    targetRange: initialProfile.compensation.targetRange,
    currency: initialProfile.compensation.currency,
    minimum: initialProfile.compensation.minimum,
    country: initialProfile.location.country,
    city: initialProfile.location.city,
    timezone: initialProfile.location.timezone,
  }));

  const dirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify({
      fullName: initialProfile.candidate.fullName,
      email: initialProfile.candidate.email,
      location: initialProfile.candidate.location,
      headline: initialProfile.narrative.headline,
      exitStory: initialProfile.narrative.exitStory,
      primaryRoles: listToMultiline(initialProfile.targetRoles.primary),
      superpowers: listToMultiline(initialProfile.narrative.superpowers),
      targetRange: initialProfile.compensation.targetRange,
      currency: initialProfile.compensation.currency,
      minimum: initialProfile.compensation.minimum,
      country: initialProfile.location.country,
      city: initialProfile.location.city,
      timezone: initialProfile.location.timezone,
    });
  }, [form, initialProfile]);

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
        primary: multilineToList(form.primaryRoles),
      },
      narrative: {
        ...initialProfile.narrative,
        headline: form.headline.trim(),
        exitStory: form.exitStory.trim(),
        superpowers: multilineToList(form.superpowers),
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profile: nextProfile }),
      });

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save profile.");
      }

      notify({
        title: hasExistingProfile ? "Profile updated" : "Profile created",
        description:
          "The Career-Ops profile source file has been written and the settings page has been refreshed.",
        dismissAfter: 4000,
      });
      router.refresh();
    } catch (error) {
      notify({
        title: "Profile save failed",
        description:
          error instanceof Error ? error.message : "Unable to write profile.yml.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.form}>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <p className={styles.label}>Candidate profile</p>
          <h2>Identity and contact context</h2>
        </div>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Full name</span>
            <input
              className={styles.control}
              onChange={(event) =>
                setForm((current) => ({ ...current, fullName: event.target.value }))
              }
              value={form.fullName}
            />
          </label>

          <label className={styles.field}>
            <span>Email</span>
            <input
              className={styles.control}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              value={form.email}
            />
          </label>

          <label className={styles.field}>
            <span>Display location</span>
            <input
              className={styles.control}
              onChange={(event) =>
                setForm((current) => ({ ...current, location: event.target.value }))
              }
              value={form.location}
            />
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <p className={styles.label}>Narrative</p>
          <h2>Headline and role targeting</h2>
        </div>

        <label className={styles.field}>
          <span>Headline</span>
          <input
            className={styles.control}
            onChange={(event) =>
              setForm((current) => ({ ...current, headline: event.target.value }))
            }
            value={form.headline}
          />
        </label>

        <label className={styles.field}>
          <span>Exit story</span>
          <textarea
            className={styles.textarea}
            onChange={(event) =>
              setForm((current) => ({ ...current, exitStory: event.target.value }))
            }
            rows={4}
            value={form.exitStory}
          />
        </label>

        <label className={styles.field}>
          <span>Primary roles</span>
          <textarea
            className={styles.textarea}
            onChange={(event) =>
              setForm((current) => ({ ...current, primaryRoles: event.target.value }))
            }
            placeholder="One role per line"
            rows={4}
            value={form.primaryRoles}
          />
        </label>

        <label className={styles.field}>
          <span>Superpowers</span>
          <textarea
            className={styles.textarea}
            onChange={(event) =>
              setForm((current) => ({ ...current, superpowers: event.target.value }))
            }
            placeholder="One proof point or capability per line"
            rows={4}
            value={form.superpowers}
          />
        </label>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <p className={styles.label}>Logistics</p>
          <h2>Compensation and location defaults</h2>
        </div>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Target range</span>
            <input
              className={styles.control}
              onChange={(event) =>
                setForm((current) => ({ ...current, targetRange: event.target.value }))
              }
              value={form.targetRange}
            />
          </label>

          <label className={styles.field}>
            <span>Currency</span>
            <input
              className={styles.control}
              onChange={(event) =>
                setForm((current) => ({ ...current, currency: event.target.value }))
              }
              value={form.currency}
            />
          </label>

          <label className={styles.field}>
            <span>Minimum</span>
            <input
              className={styles.control}
              onChange={(event) =>
                setForm((current) => ({ ...current, minimum: event.target.value }))
              }
              value={form.minimum}
            />
          </label>

          <label className={styles.field}>
            <span>Country</span>
            <input
              className={styles.control}
              onChange={(event) =>
                setForm((current) => ({ ...current, country: event.target.value }))
              }
              value={form.country}
            />
          </label>

          <label className={styles.field}>
            <span>City</span>
            <input
              className={styles.control}
              onChange={(event) =>
                setForm((current) => ({ ...current, city: event.target.value }))
              }
              value={form.city}
            />
          </label>

          <label className={styles.field}>
            <span>Timezone</span>
            <input
              className={styles.control}
              onChange={(event) =>
                setForm((current) => ({ ...current, timezone: event.target.value }))
              }
              value={form.timezone}
            />
          </label>
        </div>
      </section>

      <div className={styles.footer}>
        <p className={styles.helper}>
          {dirty
            ? "You have unsaved changes."
            : hasExistingProfile
              ? "This form reflects the current profile.yml file."
              : "Saving will create config/profile.yml in the connected workspace."}
        </p>

        <button
          className={styles.save}
          disabled={saving || !dirty}
          onClick={() => void handleSave()}
          type="button"
        >
          {saving ? "Saving…" : hasExistingProfile ? "Save profile" : "Create profile"}
        </button>
      </div>
    </div>
  );
}
