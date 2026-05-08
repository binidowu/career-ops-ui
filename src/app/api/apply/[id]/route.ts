import {
  appendApplyActivity,
  getApplyData,
  saveApplyData,
  type ApplyTargetContact,
} from "@/lib/api/career-ops";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const data = await getApplyData(id);
  return Response.json(data);
}

function readContactPatch(value: unknown): Partial<ApplyTargetContact> | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const patch: Partial<ApplyTargetContact> = {};
  for (const key of ["name", "title", "linkedin", "email"] as const) {
    if (typeof v[key] === "string") patch[key] = v[key] as string;
  }
  return Object.keys(patch).length ? patch : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    coverLetterNotes?: unknown;
    outreachDraft?: unknown;
    outreachChannel?: unknown;
    outreachDrafts?: unknown;
    appliedDate?: unknown;
    privateNotes?: unknown;
    targetContact?: unknown;
    activity?: unknown;
  };

  const before = await getApplyData(id);
  const patch: Parameters<typeof saveApplyData>[1] = {};

  if (typeof body.coverLetterNotes === "string") {
    patch.coverLetterNotes = body.coverLetterNotes;
  }
  if (typeof body.outreachDraft === "string") {
    patch.outreachDraft = body.outreachDraft;
  }
  if (
    body.outreachChannel === "linkedin" ||
    body.outreachChannel === "email" ||
    body.outreachChannel === "twitter"
  ) {
    patch.outreachChannel = body.outreachChannel;
  }
  if (body.outreachDrafts && typeof body.outreachDrafts === "object") {
    const drafts = body.outreachDrafts as Record<string, unknown>;
    patch.outreachDrafts = {
      linkedin: typeof drafts.linkedin === "string" ? drafts.linkedin : before.outreachDrafts.linkedin,
      email: typeof drafts.email === "string" ? drafts.email : before.outreachDrafts.email,
      twitter: typeof drafts.twitter === "string" ? drafts.twitter : before.outreachDrafts.twitter,
    };
  }
  if (body.appliedDate === null || typeof body.appliedDate === "string") {
    patch.appliedDate = body.appliedDate as string | null;
  }
  if (typeof body.privateNotes === "string") {
    patch.privateNotes = body.privateNotes;
  }
  const contactPatch = readContactPatch(body.targetContact);
  if (contactPatch) {
    patch.targetContact = { ...before.targetContact, ...contactPatch };
  }

  if (!Object.keys(patch).length) {
    return Response.json(
      { error: "Provide at least one field to update." },
      { status: 400 },
    );
  }

  try {
    const result = await saveApplyData(id, patch);

    // Activity log captures only major progressions. Applied-date is logged here;
    // status changes go through /api/opportunities/[id]; drafts via /generate;
    // resume exports via /api/resumes/export. Channel/contact edits are not logged.
    if (
      patch.appliedDate !== undefined &&
      patch.appliedDate !== before.appliedDate &&
      patch.appliedDate
    ) {
      await appendApplyActivity(id, {
        event: `Applied date set to ${patch.appliedDate}`,
        actor: "You",
        kind: "applied-date",
      });
    }

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
