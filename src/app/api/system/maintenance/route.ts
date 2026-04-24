import { runMaintenanceCommand } from "@/lib/api/career-ops";
import type { MaintenanceCommandId, MaintenanceMode } from "@/lib/types";

const VALID_COMMAND_IDS: MaintenanceCommandId[] = [
  "normalize",
  "dedup",
  "merge",
  "update-check",
  "update-apply",
  "rollback",
];

const READ_ONLY_COMMANDS: MaintenanceCommandId[] = ["update-check"];

function isMaintenanceCommandId(value: unknown): value is MaintenanceCommandId {
  return VALID_COMMAND_IDS.includes(value as MaintenanceCommandId);
}

function isMaintenanceMode(value: unknown): value is MaintenanceMode {
  return value === "preview" || value === "apply";
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    commandId?: unknown;
    mode?: unknown;
  };

  if (!isMaintenanceCommandId(body.commandId)) {
    return Response.json(
      { error: "A valid maintenance command id is required." },
      { status: 400 },
    );
  }

  const mode: MaintenanceMode = READ_ONLY_COMMANDS.includes(body.commandId)
    ? "apply"
    : isMaintenanceMode(body.mode)
      ? body.mode
      : "preview";

  try {
    const result = await runMaintenanceCommand({ commandId: body.commandId, mode });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to run the maintenance command.",
      },
      { status: 500 },
    );
  }
}
