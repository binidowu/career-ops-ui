import { enqueuePipelineUrls, getPipelineInbox } from "@/lib/api/career-ops";

export async function GET() {
  const inbox = await getPipelineInbox();
  return Response.json(inbox);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    entries?: unknown;
  };

  const entries = Array.isArray(body.entries)
    ? body.entries
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  if (!entries.length) {
    return Response.json(
      { error: "Provide one or more pipeline entries." },
      { status: 400 },
    );
  }

  try {
    const result = await enqueuePipelineUrls({ entries });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to queue the pipeline entries.",
      },
      { status: 400 },
    );
  }
}
