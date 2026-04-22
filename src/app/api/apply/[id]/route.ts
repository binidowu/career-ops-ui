import { getApplyData, saveApplyData } from "@/lib/api/career-ops";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const data = await getApplyData(id);
  return Response.json(data);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    coverLetterNotes?: unknown;
    outreachDraft?: unknown;
    appliedDate?: unknown;
  };

  const patch: Parameters<typeof saveApplyData>[1] = {};

  if (typeof body.coverLetterNotes === "string") {
    patch.coverLetterNotes = body.coverLetterNotes;
  }
  if (typeof body.outreachDraft === "string") {
    patch.outreachDraft = body.outreachDraft;
  }
  if (body.appliedDate === null || typeof body.appliedDate === "string") {
    patch.appliedDate = body.appliedDate as string | null;
  }

  if (!Object.keys(patch).length) {
    return Response.json(
      { error: "Provide at least one field to update." },
      { status: 400 },
    );
  }

  try {
    const result = await saveApplyData(id, patch);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save apply data.",
      },
      { status: 500 },
    );
  }
}
