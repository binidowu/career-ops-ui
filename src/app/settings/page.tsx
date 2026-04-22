import OperationsPanel from "@/components/settings/OperationsPanel";
import ProfileSettingsForm from "@/components/settings/ProfileSettingsForm";
import {
  getDashboardStats,
  getOpportunities,
  getPipelineInbox,
  getProfile,
  getWorkspaceSignals,
} from "@/lib/api/career-ops";
import type { UserProfile } from "@/lib/types";

import styles from "./settings.module.css";

function createBlankProfile(): UserProfile {
  return {
    candidate: { fullName: "", email: "", location: "" },
    targetRoles: { primary: [], archetypes: [] },
    narrative: { headline: "", exitStory: "", superpowers: [], proofPoints: [] },
    compensation: { targetRange: "", currency: "", minimum: "" },
    location: { country: "", city: "", timezone: "" },
    resumeSources: [],
  };
}

export default async function SettingsPage() {
  const [profile, stats, workspace, opportunities, pipelineInbox] = await Promise.all([
    getProfile(),
    getDashboardStats(),
    getWorkspaceSignals(),
    getOpportunities(),
    getPipelineInbox(),
  ]);
  const editableProfile = profile ?? createBlankProfile();
  const urlsAvailableForLiveness = opportunities.filter((opportunity) => opportunity.jobUrl).length;

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.pageHead}>
        <h1>Career-Ops Configuration Hub</h1>
        <p className={styles.subtitle}>
          Calibrate the AI with your career context, target roles, preferred scoring weights, and
          backend verification flows.
        </p>
      </header>

      <ProfileSettingsForm
        hasExistingProfile={Boolean(profile)}
        initialProfile={editableProfile}
      />

      <OperationsPanel
        snapshot={{
          pendingQueue: pipelineInbox.pending.length,
          reportCount: stats.reportCount,
          resumeSourceCount: workspace.resumeSourceCount,
          trackedRoles: stats.totalEvaluated,
          urlsAvailableForLiveness,
          workspacePath: workspace.careerOpsPath,
        }}
      />
    </article>
  );
}
