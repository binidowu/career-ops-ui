import type { UserProfile } from "@/lib/types";

function quote(value: string) {
  return JSON.stringify(value ?? "");
}

function emitStringList(items: string[], indent = "  ") {
  if (!items.length) {
    return `${indent}[]`;
  }

  return items.map((item) => `${indent}- ${quote(item)}`).join("\n");
}

export function serializeProfileYaml(profile: UserProfile) {
  const archetypes = profile.targetRoles.archetypes
    .map(
      (archetype) => [
        "    - name: " + quote(archetype.name),
        "      level: " + quote(archetype.level),
        "      fit: " + quote(archetype.fit),
        archetype.track ? "      track: " + quote(archetype.track) : null,
        archetype.sellWhen
          ? "      sell_when: " + quote(archetype.sellWhen)
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  const proofPoints = profile.narrative.proofPoints
    .map(
      (proofPoint) => [
        "    - name: " + quote(proofPoint.name),
        "      url: " + quote(proofPoint.url),
        "      hero_metric: " + quote(proofPoint.heroMetric),
        proofPoint.track ? "      track: " + quote(proofPoint.track) : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  const alternateRanges = profile.compensation.alternateRanges?.length
    ? [
        "  alternate_ranges:",
        ...profile.compensation.alternateRanges.map((range) =>
          [
            "    - track: " + quote(range.track),
            "      target_range: " + quote(range.targetRange),
            "      minimum: " + quote(range.minimum),
            range.note ? "      note: " + quote(range.note) : null,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      ].join("\n")
    : null;

  return [
    "# Career-Ops Profile Configuration",
    "# This file is maintained by the Career-Ops web UI.",
    "",
    "candidate:",
    `  full_name: ${quote(profile.candidate.fullName)}`,
    `  email: ${quote(profile.candidate.email)}`,
    profile.candidate.phone
      ? `  phone: ${quote(profile.candidate.phone)}`
      : null,
    `  location: ${quote(profile.candidate.location)}`,
    profile.candidate.linkedin
      ? `  linkedin: ${quote(profile.candidate.linkedin)}`
      : null,
    profile.candidate.portfolioUrl
      ? `  portfolio_url: ${quote(profile.candidate.portfolioUrl)}`
      : null,
    profile.candidate.github
      ? `  github: ${quote(profile.candidate.github)}`
      : null,
    profile.candidate.twitter
      ? `  twitter: ${quote(profile.candidate.twitter)}`
      : null,
    profile.candidate.canvaResumeDesignId
      ? `  canva_resume_design_id: ${quote(profile.candidate.canvaResumeDesignId)}`
      : null,
    "",
    "target_roles:",
    "  primary:",
    emitStringList(profile.targetRoles.primary, "    "),
    "  archetypes:",
    archetypes || "    []",
    "",
    "narrative:",
    `  headline: ${quote(profile.narrative.headline)}`,
    `  exit_story: ${quote(profile.narrative.exitStory)}`,
    "  superpowers:",
    emitStringList(profile.narrative.superpowers, "    "),
    "  proof_points:",
    proofPoints || "    []",
    "",
    "compensation:",
    `  target_range: ${quote(profile.compensation.targetRange)}`,
    `  currency: ${quote(profile.compensation.currency)}`,
    `  minimum: ${quote(profile.compensation.minimum)}`,
    profile.compensation.locationFlexibility
      ? `  location_flexibility: ${quote(profile.compensation.locationFlexibility)}`
      : null,
    alternateRanges,
    "",
    "location:",
    `  country: ${quote(profile.location.country)}`,
    `  city: ${quote(profile.location.city)}`,
    `  timezone: ${quote(profile.location.timezone)}`,
    profile.location.visaStatus
      ? `  visa_status: ${quote(profile.location.visaStatus)}`
      : null,
    profile.location.onsiteAvailability
      ? `  onsite_availability: ${quote(profile.location.onsiteAvailability)}`
      : null,
    "",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
