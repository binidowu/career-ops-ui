/**
 * Career-Ops UI — Data Access Layer
 * 
 * Central module for reading data from the career-ops file system.
 * All file-system access is server-side only (Next.js server components / API routes).
 * 
 * The CAREER_OPS_PATH environment variable points to the career-ops CLI directory.
 */

import { access, readFile, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

/**
 * Returns the resolved path to the career-ops directory.
 * Throws if CAREER_OPS_PATH is not set.
 */
export function getCareerOpsPath(): string {
  const basePath = process.env.CAREER_OPS_PATH;
  if (!basePath) {
    throw new Error(
      "CAREER_OPS_PATH environment variable is not set. " +
      "Add it to .env.local pointing to your career-ops directory."
    );
  }
  return resolve(basePath);
}

/**
 * Resolves a relative path within the career-ops directory.
 */
export function resolveCareerOpsFile(...segments: string[]): string {
  return resolve(getCareerOpsPath(), ...segments);
}

/**
 * Resolves the first existing file from a list of candidate relative paths.
 */
export async function findFirstCareerOpsFile(
  candidates: string[][],
): Promise<string | null> {
  for (const segments of candidates) {
    const candidatePath = resolveCareerOpsFile(...segments);

    try {
      await access(candidatePath, constants.F_OK);
      return candidatePath;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Returns true when the given relative file exists inside the career-ops repo.
 */
export async function careerOpsFileExists(...segments: string[]) {
  try {
    await access(resolveCareerOpsFile(...segments), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads a UTF-8 file if it exists, otherwise returns null.
 */
export async function readCareerOpsTextFile(
  ...segments: string[]
): Promise<string | null> {
  try {
    return await readFile(resolveCareerOpsFile(...segments), "utf8");
  } catch {
    return null;
  }
}

/**
 * Returns the latest mtime for a file or directory tree, or a stable missing signature.
 */
export async function getCareerOpsSignature(...segments: string[]) {
  const targetPath = resolveCareerOpsFile(...segments);

  async function visit(currentPath: string): Promise<string> {
    try {
      const info = await stat(currentPath);

      if (!info.isDirectory()) {
        return `${currentPath}:${info.mtimeMs}:${info.size}`;
      }

      const children = await readdir(currentPath);
      const childSignatures = await Promise.all(
        children
          .sort()
          .map((child) => visit(resolve(currentPath, child))),
      );

      return `${currentPath}:${info.mtimeMs}:${childSignatures.join("|")}`;
    } catch {
      return `${currentPath}:missing`;
    }
  }

  return visit(targetPath);
}
