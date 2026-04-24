import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "career-ops-session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "AUTH_SECRET is not set or is too short. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
      "and add it to .env.local.",
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

/**
 * Validates that the auth configuration is coherent when auth is enabled.
 * Returns a human-readable error string or null if everything is fine.
 */
export function getAuthConfigError(): string | null {
  if (!isAuthEnabled()) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return "AUTH_PASSWORD is set but AUTH_SECRET is missing. " +
      "Generate AUTH_SECRET with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";
  }
  if (secret.length < 32) {
    return "AUTH_SECRET is too short (must be at least 32 characters). " +
      "Generate a new one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";
  }
  return null;
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
