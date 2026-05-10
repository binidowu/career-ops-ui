import { appendApplyActivity, exportResumeDraftDocument } from "@/lib/api/career-ops";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const { buffer, fileName, format: _format } = await exportResumeDraftDocument(id);

    // Best-effort activity log — do not fail the export if this throws.
    try {
      const opportunityIdMatch = fileName.match(/^[^-]+-(.+?)-\d{4}-\d{2}-\d{2}\.pdf$/);
      if (opportunityIdMatch) {
        await appendApplyActivity(opportunityIdMatch[1], {
          event: `Tailored resume exported (${fileName})`,
          actor: "Resume Studio",
          kind: "resume-generated",
        });
      }
    } catch {
      // Non-fatal.
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to export the resume document.",
      },
      { status: error instanceof Error && error.message.includes("not found") ? 404 : 500 },
    );
  }
}
