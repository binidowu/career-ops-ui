import { generateResumeDraft } from "@/lib/api/career-ops";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    format?: unknown;
    opportunityId?: unknown;
    resumeSourceId?: unknown;
    tone?: unknown;
    variant?: unknown;
  };

  const opportunityId =
    typeof body.opportunityId === "string" ? body.opportunityId.trim() : "";
  const resumeSourceId =
    typeof body.resumeSourceId === "string" ? body.resumeSourceId.trim() : "";
  const format = body.format === "a4" ? "a4" : "letter";
  const tone =
    typeof body.tone === "number" && Number.isFinite(body.tone)
      ? Math.min(100, Math.max(0, body.tone))
      : 50;
  const variant =
    body.variant === "technical" || body.variant === "execution"
      ? body.variant
      : "balanced";

  if (!opportunityId) {
    return Response.json(
      { error: "An opportunity id is required to generate a resume draft." },
      { status: 400 },
    );
  }

  try {
    const generated = await generateResumeDraft({
      opportunityId,
      resumeSourceId: resumeSourceId || undefined,
      format,
      tone,
      variant,
    });

    return Response.json(generated);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate the tailored resume draft.",
      },
      { status: 500 },
    );
  }
}
