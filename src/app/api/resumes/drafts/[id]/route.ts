import { getResumeDraftById, patchResumeDraft } from "@/lib/api/career-ops";
import type { ResumeDraftOp } from "@/lib/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const document = await getResumeDraftById(id);

    if (!document) {
      return Response.json({ error: "Resume draft not found." }, { status: 404 });
    }

    return Response.json({ document });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load resume draft." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as { ops?: unknown };

  if (!Array.isArray(body.ops) || !body.ops.length) {
    return Response.json({ error: "Provide a non-empty ops array." }, { status: 400 });
  }

  const ops = body.ops as ResumeDraftOp[];

  try {
    const document = await patchResumeDraft(id, ops);
    return Response.json({ document });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to patch resume draft." },
      { status: error instanceof Error && error.message.includes("not found") ? 404 : 500 },
    );
  }
}
