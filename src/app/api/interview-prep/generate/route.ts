import { generateInterviewPrepIntel } from "@/lib/api/career-ops";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    opportunityId?: unknown;
  };

  const opportunityId =
    typeof body.opportunityId === "string" ? body.opportunityId.trim() : "";

  if (!opportunityId) {
    return Response.json(
      { error: "An opportunity id is required to generate interview intel." },
      { status: 400 },
    );
  }

  try {
    const generated = await generateInterviewPrepIntel({ opportunityId });
    return Response.json(generated);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate the interview intel draft.",
      },
      { status: 500 },
    );
  }
}
