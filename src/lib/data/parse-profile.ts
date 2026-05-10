import type {
  ResumeSourceExtractionDiagnostic,
  UserProfile,
} from "@/lib/types";

import { parseYaml } from "./yaml-lite";

function toString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toOptionalString(value: unknown) {
  const stringValue = typeof value === "string" ? value : "";
  return stringValue || undefined;
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => (typeof entry === "string" ? entry : String(entry))).filter(Boolean)
    : [];
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArchetypeFit(
  value: unknown,
): "adjacent" | "primary" | "secondary" {
  if (value === "secondary" || value === "adjacent") {
    return value;
  }

  return "primary";
}

function toResumeSourceDiagnostic(
  value: unknown,
): ResumeSourceExtractionDiagnostic | null {
  const diagnostic = toRecord(value);
  const code = toString(diagnostic.code);
  const severity =
    diagnostic.severity === "error" || diagnostic.severity === "warning"
      ? diagnostic.severity
      : "info";
  const message = toString(diagnostic.message);

  if (
    ![
      "extracted_text_empty",
      "extracted_text_short",
      "normalized_markdown_generated",
      "unsupported_source_format",
    ].includes(code) ||
    !message
  ) {
    return null;
  }

  return {
    code: code as ResumeSourceExtractionDiagnostic["code"],
    message,
    severity,
  };
}

export function parseProfileYaml(text: string): UserProfile {
  const parsed = parseYaml(text);
  const candidate = toRecord(parsed.candidate);
  const targetRoles = toRecord(parsed.target_roles);
  const narrative = toRecord(parsed.narrative);
  const compensation = toRecord(parsed.compensation);
  const location = toRecord(parsed.location);
  const resumeSources = Array.isArray(parsed.resume_sources)
    ? parsed.resume_sources.map((entry) => {
        const record = toRecord(entry);

        return {
          id: toString(record.id),
          label: toString(record.label) || toString(record.id) || "Resume source",
          extractionDiagnostics: Array.isArray(record.extraction_diagnostics)
            ? record.extraction_diagnostics
                .map(toResumeSourceDiagnostic)
                .filter((item): item is ResumeSourceExtractionDiagnostic => Boolean(item))
            : [],
          originalPath: toOptionalString(record.original_path),
          path: toString(record.path),
          default:
            typeof record.default === "boolean"
              ? record.default
              : String(record.default).toLowerCase() === "true",
          targetRoles: toStringArray(record.target_roles),
        };
      }).filter((entry) => entry.id && entry.path)
    : [];

  const archetypes = Array.isArray(targetRoles.archetypes)
    ? targetRoles.archetypes.map((entry) => {
        const record = toRecord(entry);

        return {
          name: toString(record.name),
          level: toString(record.level),
          fit: toArchetypeFit(record.fit),
          track: toOptionalString(record.track),
          sellWhen: toOptionalString(record.sell_when),
        };
      })
    : [];

  const proofPoints = Array.isArray(narrative.proof_points)
    ? narrative.proof_points.map((entry) => {
        const record = toRecord(entry);

        return {
          name: toString(record.name),
          url: toString(record.url),
          heroMetric: toString(record.hero_metric),
          track: toOptionalString(record.track),
        };
      })
    : [];

  const alternateRanges = Array.isArray(compensation.alternate_ranges)
    ? compensation.alternate_ranges.map((entry) => {
        const record = toRecord(entry);

        return {
          track: toString(record.track),
          targetRange: toString(record.target_range),
          minimum: toString(record.minimum),
          note: toOptionalString(record.note),
        };
      })
    : [];

  return {
    candidate: {
      fullName: toString(candidate.full_name),
      email: toString(candidate.email),
      phone: toOptionalString(candidate.phone),
      location: toString(candidate.location),
      linkedin: toOptionalString(candidate.linkedin),
      portfolioUrl: toOptionalString(candidate.portfolio_url),
      github: toOptionalString(candidate.github),
      twitter: toOptionalString(candidate.twitter),
      canvaResumeDesignId: toOptionalString(candidate.canva_resume_design_id),
    },
    targetRoles: {
      primary: toStringArray(targetRoles.primary),
      archetypes,
    },
    narrative: {
      headline: toString(narrative.headline),
      exitStory: toString(narrative.exit_story),
      superpowers: toStringArray(narrative.superpowers),
      proofPoints,
    },
    compensation: {
      targetRange: toString(compensation.target_range),
      currency: toString(compensation.currency),
      minimum: toString(compensation.minimum),
      locationFlexibility: toOptionalString(compensation.location_flexibility),
      alternateRanges,
    },
    location: {
      country: toString(location.country),
      city: toString(location.city),
      timezone: toString(location.timezone),
      visaStatus: toOptionalString(location.visa_status),
      onsiteAvailability: toOptionalString(location.onsite_availability),
    },
    resumeSources,
  };
}
