import DashboardOverview from "@/components/dashboard/DashboardOverview";
import {
  getDashboardStats,
  getOpportunities,
  getPipelineInbox,
  getWorkspaceSignals,
} from "@/lib/api/career-ops";

export default async function Home() {
  const [stats, opportunities, pipelineInbox, workspace] = await Promise.all([
    getDashboardStats(),
    getOpportunities(),
    getPipelineInbox(),
    getWorkspaceSignals(),
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
