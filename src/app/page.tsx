import DashboardOverview from "@/components/dashboard/DashboardOverview";
import {
  getDashboardStats,
  getOpportunities,
  getPipelineInbox,
  getWorkspaceSignals,
} from "@/lib/api/career-ops";
import type { DashboardStats } from "@/lib/types";

const EMPTY_STATS: DashboardStats = {
  totalEvaluated: 0,
  newThisWeek: 0,
  averageScore: null,
  statusCounts: {
    Evaluated: 0,
    Applied: 0,
    Responded: 0,
    Interview: 0,
    Offer: 0,
    Rejected: 0,
    Discarded: 0,
    SKIP: 0,
    Unknown: 0,
  },
  topScoring: [],
  followUpsDue: [],
  reportCount: 0,
  profileReady: false,
};

const EMPTY_PIPELINE = { pending: [], processed: [], path: "data/pipeline.md" };

const EMPTY_WORKSPACE = {
  trackerReady: false,
  profileReady: false,
  reportsReady: false,
  cvReady: false,
  resumeReady: false,
  resumePath: "cv.md",
  resumeSourceCount: 0,
  resumeSourcesConfigured: 0,
  careerOpsPath: "",
  trackerPath: "data/applications.md",
  profilePath: "config/profile.yml",
  cvPath: "cv.md",
};

function safeWarn(label: string, error: unknown) {
  console.warn(`${label} unavailable:`, error instanceof Error ? error.message : error);
}

export default async function Home() {
  const [stats, opportunities, pipelineInbox, workspace] = await Promise.all([
    getDashboardStats().catch((e) => {
      safeWarn("Dashboard stats", e);
      return EMPTY_STATS;
    }),
    getOpportunities().catch((e) => {
      safeWarn("Opportunities", e);
      return [];
    }),
    getPipelineInbox().catch((e) => {
      safeWarn("Pipeline inbox", e);
      return EMPTY_PIPELINE;
    }),
    getWorkspaceSignals().catch((e) => {
      safeWarn("Workspace signals", e);
      return EMPTY_WORKSPACE;
    }),
  ]);

  return (
    <DashboardOverview
      opportunities={opportunities}
      pipelineInbox={pipelineInbox}
      stats={stats}
      workspace={workspace}
    />
  );
}
