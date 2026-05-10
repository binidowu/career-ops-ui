import {
  rewriteResumeDraftContent,
  type ResumeDraftRewriteInstruction,
  type ResumeDraftRewriteScope,
} from "@/lib/api/career-ops";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    scope?: unknown;
    sectionId?: unknown;
    blockId?: unknown;
    bulletId?: unknown;
    instruction?: unknown;
  };

  const scope = (body.scope as ResumeDraftRewriteScope) || "bullet";
  const validScopes: ResumeDraftRewriteScope[] = ["document", "section", "bullet"];
  if (!validScopes.includes(scope)) {
    return Response.json(
      { error: `Invalid scope "${scope}". Use "document", "section", or "bullet".` },
      { status: 400 },
    );
  }

  if (scope === "bullet" && (!body.sectionId || !body.blockId || !body.bulletId)) {
    return Response.json(
      { error: "sectionId, blockId, and bulletId are required for bullet-scope rewrites." },
      { status: 400 },
    );
  }

  if (scope === "section" && !body.sectionId) {
    return Response.json(
      { error: "sectionId is required for section-scope rewrites." },
      { status: 400 },
    );
  }

  try {
    const document = await rewriteResumeDraftContent({
      id,
      scope,
      sectionId: typeof body.sectionId === "string" ? body.sectionId : undefined,
      blockId: typeof body.blockId === "string" ? body.blockId : undefined,
      bulletId: typeof body.bulletId === "string" ? body.bulletId : undefined,
      instruction: typeof body.instruction === "string"
        ? (body.instruction as ResumeDraftRewriteInstruction)
        : undefined,
    });

    return Response.json({ document });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to rewrite resume content." },
      { status: error instanceof Error && error.message.includes("not found") ? 404 : 500 },
    );
  }
}
