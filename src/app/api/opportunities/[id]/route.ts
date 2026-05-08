import {
  appendApplyActivity,
  getOpportunity,
  updateOpportunity,
} from "@/lib/api/career-ops";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await getOpportunity(id);

  if (!result.opportunity) {
    return Response.json({ error: "Opportunity not found." }, { status: 404 });
  }

  return Response.json(result);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    notes?: unknown;
    status?: unknown;
  };

  const notes =
    typeof body.notes === "string" ? body.notes.trim() : undefined;
  const status =
    typeof body.status === "string" ? body.status.trim() : undefined;

  if (notes === undefined && status === undefined) {
    return Response.json(
      { error: "Provide a status and/or notes value." },
      { status: 400 },
    );
  }

  try {
    const before = await getOpportunity(id);
    const result = await updateOpportunity(id, { notes, status });

    if (status && before.opportunity && before.opportunity.status !== status) {
      await appendApplyActivity(id, {
        event:
          status === "Applied"
            ? "Application submitted via portal"
            : `Status moved to ${status}`,
        actor: "You",
        kind: status === "Applied" ? "submission" : "status-change",
      });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update opportunity.",
      },
      { status: 400 },
    );
  }
}
