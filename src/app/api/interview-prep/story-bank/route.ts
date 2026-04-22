import { saveInterviewPrepStoryBank } from "@/lib/api/career-ops";

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    content?: unknown;
  };

  if (typeof body.content !== "string") {
    return Response.json(
      { error: "A string story bank payload is required." },
      { status: 400 },
    );
  }

  try {
    const result = await saveInterviewPrepStoryBank(body.content);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save the interview story bank.",
      },
      { status: 400 },
    );
  }
}
