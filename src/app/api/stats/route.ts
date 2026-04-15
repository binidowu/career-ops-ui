import { getDashboardStats, getWorkspaceSignals } from "@/lib/api/career-ops";

export async function GET() {
  const [stats, workspace] = await Promise.all([
    getDashboardStats(),
    getWorkspaceSignals(),
  ]);

  return Response.json({ stats, workspace });
}
