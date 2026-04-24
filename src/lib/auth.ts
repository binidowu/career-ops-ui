import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "career-ops-session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "AUTH_SECRET is not set or is too short. Add a 32+ character secret to .env.local.",
    );
  }
  return new TextEncoder().encode(raw);
}

export function getAuthPassword(): string {
  return process.env.AUTH_PASSWORD ?? "";
}

export function isAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_PASSWORD);
}

export async function createSessionToken(): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secret = getSecret();
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
