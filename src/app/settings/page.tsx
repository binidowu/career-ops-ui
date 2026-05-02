import SettingsShell, {
  type ReadinessSnapshot,
} from "@/components/settings/SettingsShell";
import {
  getDashboardStats,
  getOpportunities,
  getPipelineInbox,
  getProfile,
  getWorkspaceSignals,
} from "@/lib/api/career-ops";
import type { UserProfile } from "@/lib/types";

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

  const readiness: ReadinessSnapshot = {
    profileReady: workspace.profileReady,
    resumeReady: workspace.resumeReady,
    resumeSourceCount: workspace.resumeSourceCount,
    trackerReady: workspace.trackerReady,
    reportsReady: workspace.reportsReady,
    cvReady: workspace.cvReady,
    pendingQueue: pipelineInbox.pending.length,
    trackedRoles: stats.totalEvaluated,
    reportCount: stats.reportCount,
    workspacePath: workspace.careerOpsPath,
  };

  // Touch unused returns to keep server fetches stable for future use.
  void opportunities;

  return (
    <SettingsShell
      hasExistingProfile={Boolean(profile)}
      initialProfile={editableProfile}
      readiness={readiness}
    />
  );
}
