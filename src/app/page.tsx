import DashboardOverview from "@/components/dashboard/DashboardOverview";
import {
  getDashboardStats,
  getOpportunities,
  getWorkspaceSignals,
} from "@/lib/api/career-ops";

export default async function Home() {
  const [stats, opportunities, workspace] = await Promise.all([
    getDashboardStats(),
    getOpportunities(),
    getWorkspaceSignals(),
  ]);

  return (
    <DashboardOverview
      opportunities={opportunities}
      stats={stats}
      workspace={workspace}
    />
  );
}
