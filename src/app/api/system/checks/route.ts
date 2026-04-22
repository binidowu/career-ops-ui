import { runSystemCheck } from "@/lib/api/career-ops";
import type { SystemCheckId } from "@/lib/types";

function isSystemCheckId(value: unknown): value is SystemCheckId {
  return (
    value === "doctor" ||
    value === "verify" ||
    value === "sync-check" ||
    value === "liveness"
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    checkId?: unknown;
  };

  if (!isSystemCheckId(body.checkId)) {
    return Response.json(
      { error: "A valid system check id is required." },
      { status: 400 },
    );
  }

  try {
    const result = await runSystemCheck({ checkId: body.checkId });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to run the backend system check.",
      },
      { status: 500 },
    );
  }
}
