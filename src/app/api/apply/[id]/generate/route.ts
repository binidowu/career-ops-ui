import { generateApplyDraft, type ApplyDraftKind } from "@/lib/api/career-ops";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    kind?: unknown;
  };

  const kind: ApplyDraftKind | null =
    body.kind === "cover-letter" || body.kind === "outreach" ? body.kind : null;

  if (!kind) {
    return Response.json(
      { error: "Choose cover-letter or outreach draft generation." },
      { status: 400 },
    );
  }

  try {
    const generated = await generateApplyDraft({ opportunityId: id, kind });
    return Response.json(generated);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate the apply draft.",
      },
      { status: 500 },
    );
  }
}
