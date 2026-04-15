import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { getCvDocument, getOpportunity, getProfile } from "@/lib/api/career-ops";
import { getCareerOpsPath, resolveCareerOpsFile } from "@/lib/data";
import { buildResumeDraft, renderResumeHtml } from "@/lib/resume-studio";

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  const body = (await request.json()) as {
    format?: unknown;
    opportunityId?: unknown;
    selectedKeywords?: unknown;
  };

  const opportunityId =
    typeof body.opportunityId === "string" ? body.opportunityId.trim() : "";
  const format = body.format === "letter" ? "letter" : "a4";
  const selectedKeywords = Array.isArray(body.selectedKeywords)
    ? body.selectedKeywords
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    : [];

  if (!opportunityId) {
    return Response.json(
      { error: "An opportunity id is required for export." },
      { status: 400 },
    );
  }

  const [{ opportunity, evaluation }, cv, profile] = await Promise.all([
    getOpportunity(opportunityId),
    getCvDocument(),
    getProfile(),
  ]);

  if (!opportunity || !evaluation) {
    return Response.json(
      { error: "The selected opportunity does not have a parsed evaluation yet." },
      { status: 400 },
    );
  }

  if (!cv) {
    return Response.json(
      { error: "cv.md is missing from the connected career-ops workspace." },
      { status: 400 },
    );
  }

  const draft = buildResumeDraft({
    cv,
    evaluation,
    opportunity,
    profile,
    format,
    selectedKeywords,
  });

  const html = renderResumeHtml(draft);

  try {
    const workdir = await mkdtemp(join(tmpdir(), "career-ops-ui-resume-"));
    const htmlPath = join(workdir, draft.fileName.replace(/\.pdf$/, ".html"));
    const pdfPath = join(workdir, draft.fileName);

    await mkdir(workdir, { recursive: true });
    await writeFile(htmlPath, html, "utf8");

    await execFileAsync(
      "node",
      [resolveCareerOpsFile("generate-pdf.mjs"), htmlPath, pdfPath, `--format=${format}`],
      {
        cwd: getCareerOpsPath(),
      },
    );

    const pdf = await readFile(pdfPath);

    return new Response(pdf, {
      headers: {
        "Content-Disposition": `attachment; filename="${draft.fileName}"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to render the resume PDF in the connected workspace.",
      },
      { status: 500 },
    );
  }
}
