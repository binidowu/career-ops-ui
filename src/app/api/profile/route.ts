import { getProfile, getProfileTemplate, saveProfile } from "@/lib/api/career-ops";
import type { UserProfile } from "@/lib/types";

export async function GET() {
  const [profile, template] = await Promise.all([
    getProfile(),
    getProfileTemplate(),
  ]);
  return Response.json({ profile, template });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    profile?: UserProfile;
  };

  if (!body.profile) {
    return Response.json(
      { error: "A profile payload is required." },
      { status: 400 },
    );
  }

  try {
    const profile = await saveProfile(body.profile);
    return Response.json({ profile });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save profile.",
      },
      { status: 400 },
    );
  }
}
