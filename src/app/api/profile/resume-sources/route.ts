import { Buffer } from "node:buffer";

import { uploadResumeSourceFile } from "@/lib/api/career-ops";

export const runtime = "nodejs";

function lineToList(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/,|\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const label = formData.get("label");
  const makeDefault = formData.get("makeDefault");
  const targetRoles = lineToList(formData.get("targetRoles"));

  if (!(file instanceof File)) {
    return Response.json(
      { error: "A resume file is required." },
      { status: 400 },
    );
  }

  try {
    const source = await uploadResumeSourceFile({
      fileName: file.name,
      fileBuffer: Buffer.from(await file.arrayBuffer()),
      label: typeof label === "string" ? label.trim() : "",
      makeDefault: makeDefault === "true",
      targetRoles,
    });

    return Response.json({ source });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload the resume source.",
      },
      { status: 400 },
    );
  }
}
