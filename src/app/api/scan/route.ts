import { runPortalScan } from "@/lib/api/career-ops";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    company?: unknown;
    dryRun?: unknown;
  };

  try {
    const result = await runPortalScan({
      company: typeof body.company === "string" ? body.company.trim() : undefined,
      dryRun: body.dryRun === true,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to run the backend portal scanner.",
      },
      { status: 500 },
    );
  }
}
