import { appendApplyActivity, exportResumeDraftDocument } from "@/lib/api/career-ops";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const { buffer, fileName, overflowDiagnostics, estimatedPages } = await exportResumeDraftDocument(id);

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

    const headers: Record<string, string> = {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/pdf",
      "X-Resume-Estimated-Pages": String(estimatedPages),
    };

    if (overflowDiagnostics.some((d) => d.severity === "warning")) {
      headers["X-Resume-Overflow-Warning"] = overflowDiagnostics
        .filter((d) => d.severity === "warning")
        .map((d) => d.message)
        .join("; ");
    }

    return new Response(new Uint8Array(buffer), { headers });
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
