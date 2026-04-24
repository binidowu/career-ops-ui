import { cookies } from "next/headers";

import {
  createSessionToken,
  getAuthConfigError,
  getAuthPassword,
  isAuthEnabled,
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
  sessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    return Response.json({ error: "Auth is not configured." }, { status: 400 });
  }

  const configError = getAuthConfigError();
  if (configError) {
    return Response.json(
      { error: `Server configuration error: ${configError}` },
      { status: 500 },
    );
  }

  const body = (await request.json()) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";

  if (!password || password !== getAuthPassword()) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  const token = await createSessionToken();
  const jar = await cookies();

  jar.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_DURATION_SECONDS));

  return Response.json({ ok: true });
}
