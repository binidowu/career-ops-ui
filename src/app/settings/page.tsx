import ProfileSettingsForm from "@/components/settings/ProfileSettingsForm";
import { getProfile, getWorkspaceSignals } from "@/lib/api/career-ops";
import type { UserProfile } from "@/lib/types";

import styles from "./settings.module.css";

function createBlankProfile(): UserProfile {
  return {
    candidate: { fullName: "", email: "", location: "" },
    targetRoles: { primary: [], archetypes: [] },
    narrative: { headline: "", exitStory: "", superpowers: [], proofPoints: [] },
    compensation: { targetRange: "", currency: "", minimum: "" },
    location: { country: "", city: "", timezone: "" },
  };
}

export default async function SettingsPage() {
  const [profile, workspace] = await Promise.all([getProfile(), getWorkspaceSignals()]);
  const editableProfile = profile ?? createBlankProfile();

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.pageHead}>
        <h1>Career-Ops Configuration Hub</h1>
        <p className={styles.subtitle}>
          Calibrate the AI with your career context, target roles, and preferred scoring weights.
        </p>
      </header>

      <ProfileSettingsForm
        hasExistingProfile={Boolean(profile)}
        initialProfile={editableProfile}
      />
    </article>
  );
}
