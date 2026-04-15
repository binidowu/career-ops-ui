import { getOpportunities } from "@/lib/api/career-ops";

export async function GET() {
  const opportunities = await getOpportunities();
  return Response.json({ opportunities });
}
