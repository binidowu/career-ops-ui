import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { generateResumeDraft } from "@/lib/api/career-ops";
import { getCareerOpsPath, resolveCareerOpsFile } from "@/lib/data";
import { renderResumeHtml } from "@/lib/resume-studio";

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  const body = (await request.json()) as {
    experienceOverrides?: unknown;
    format?: unknown;
    headlineOverride?: unknown;
    opportunityId?: unknown;
    resumeSourceId?: unknown;
    selectedKeywords?: unknown;
    summaryOverride?: unknown;
    tone?: unknown;
    variant?: unknown;
  };

  const opportunityId =
    typeof body.opportunityId === "string" ? body.opportunityId.trim() : "";
  const format = body.format === "letter" ? "letter" : "a4";
  const selectedKeywords = Array.isArray(body.selectedKeywords)
    ? body.selectedKeywords
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    : [];
  const tone =
    typeof body.tone === "number" && Number.isFinite(body.tone)
      ? Math.min(100, Math.max(0, body.tone))
      : 50;
  const variant =
    body.variant === "technical" || body.variant === "execution"
      ? body.variant
      : "balanced";
  const headlineOverride =
    typeof body.headlineOverride === "string" ? body.headlineOverride.trim() : "";
  const resumeSourceId =
    typeof body.resumeSourceId === "string" ? body.resumeSourceId.trim() : "";
  const summaryOverride =
    typeof body.summaryOverride === "string" ? body.summaryOverride.trim() : "";
  const experienceOverrides = Array.isArray(body.experienceOverrides)
    ? (body.experienceOverrides as unknown[])
        .filter(
          (entry): entry is { index: number; bullets: string[] } =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as Record<string, unknown>).index === "number" &&
            Array.isArray((entry as Record<string, unknown>).bullets),
        )
        .map((entry) => ({
          index: entry.index,
          bullets: (entry.bullets as unknown[])
            .filter((b): b is string => typeof b === "string")
            .map((b) => b.trim())
            .filter(Boolean),
        }))
    : [];

  if (!opportunityId) {
    return Response.json(
      { error: "An opportunity id is required for export." },
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
      headlineOverride,
      summaryOverride,
    });
    const draft = {
      ...generated.draft,
      focusKeywords: selectedKeywords.length ? selectedKeywords : generated.draft.focusKeywords,
    };

    for (const override of experienceOverrides) {
      if (draft.experienceHighlights[override.index] && override.bullets.length > 0) {
        draft.experienceHighlights[override.index].bullets = override.bullets;
      }
    }

    const html = renderResumeHtml(draft);
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
