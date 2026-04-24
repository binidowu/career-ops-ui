import {
  abandonPipelineProcessJob,
  getLatestPipelineProcessJob,
  getPipelineProcessJob,
  startPendingPipelineProcess,
} from "@/lib/api/career-ops";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId")?.trim();

  const job = jobId
    ? await getPipelineProcessJob(jobId)
    : await getLatestPipelineProcessJob();

  if (!job) {
    return Response.json({ job: null });
  }

  return Response.json({ job });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    directUrl?: unknown;
    limit?: unknown;
  };

  const directUrl =
    typeof body.directUrl === "string" && body.directUrl.trim()
      ? body.directUrl.trim()
      : undefined;

  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? body.limit
      : 3;

  try {
    const result = await startPendingPipelineProcess({ directUrl, limit });
    return Response.json(result, { status: result.started ? 202 : 200 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process pending pipeline items.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    jobId?: unknown;
  };

  if (body.action !== "clear-stale") {
    return Response.json({ error: "Unsupported pipeline process action." }, { status: 400 });
  }

  try {
    const job = await abandonPipelineProcessJob({
      id: typeof body.jobId === "string" ? body.jobId : undefined,
      reason:
        "This pipeline processor was cleared after it appeared to stall. Start a fresh batch when ready.",
    });

    return Response.json({ job });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to clear the pipeline processor.",
      },
      { status: 500 },
    );
  }
}
