import { processPendingPipelineBatch } from "@/lib/api/career-ops";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    limit?: unknown;
  };

  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? body.limit
      : 3;

  try {
    const result = await processPendingPipelineBatch({ limit });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process pending pipeline items.",
      },
      { status: 500 },
    );
  }
}
