export interface CvExperience {
  bullets: string[];
  company: string;
  location: string;
  period: string;
  role: string;
}

export interface CvProject {
  description: string;
  title: string;
}

export interface CvSkillGroup {
  items: string[];
  label: string;
}

export interface ParsedCvDocument {
  awards: string[];
  certifications: string[];
  contact: Record<string, string>;
  education: string[];
  experiences: CvExperience[];
  name: string;
  projects: CvProject[];
  publications: string[];
  skills: CvSkillGroup[];
  summary: string;
  volunteering: string[];
}

const SECTION_ALIASES = {
  summary: ["Professional Summary", "Summary", "Profile", "About"],
  experience: [
    "Work Experience",
    "Experience",
    "Professional Experience",
    "Employment History",
    "Employment",
  ],
  projects: [
    "Projects",
    "Selected Work",
    "Portfolio",
    "Case Studies",
    "Personal Projects",
    "Side Projects",
  ],
  education: ["Education", "Academic Background"],
  skills: [
    "Skills",
    "Technical Skills",
    "Core Skills",
    "Core Competencies",
    "Technologies",
  ],
  certifications: ["Certifications", "Licenses", "Credentials"],
  awards: ["Awards", "Honors"],
  publications: ["Publications"],
  volunteering: ["Volunteer Experience", "Volunteering", "Community"],
} as const;

function extractSection(markdown: string, heading: string) {
  const expression = new RegExp(
    `^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
    "im",
  );
  return expression.exec(markdown)?.[1]?.trim() ?? "";
}

function extractAliasedSection(
  markdown: string,
  aliases: readonly string[],
) {
  for (const alias of aliases) {
    const section = extractSection(markdown, alias);
    if (section) {
      return section;
    }
  }

  return "";
}

function normalizeLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseListItems(section: string) {
  return normalizeLines(section)
    .filter((line) => /^[-•*◦]\s/.test(line))
    .map((line) => line.replace(/^[-•*◦]\s+/, "").trim())
    .filter(Boolean);
}

function parseHeaderContact(markdown: string) {
  const header = markdown.split(/^##\s+/m)[0] ?? "";
  const contactEntries = [...header.matchAll(/\*\*([^*]+):\*\*\s*(.+)$/gm)];

  return contactEntries.reduce<Record<string, string>>((record, match) => {
    const key = match[1]?.trim() ?? "";
    const value = match[2]?.trim() ?? "";

    if (key && value) {
      record[key] = value;
    }

    return record;
  }, {});
}

function parseExperiences(section: string) {
  if (!section) {
    return [] as CvExperience[];
  }

  return section
    .split(/^###\s+/m)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = normalizeLines(block);
      const [companyLine = "", roleLine = "", periodLine = ""] = lines;
      const bullets = lines
        .slice(3)
        .filter((line) => /^[-•*◦]\s/.test(line))
        .map((line) => line.replace(/^[-•*◦]\s+/, "").trim());

      const [company, location = ""] = companyLine.split(/\s+--\s+/);

      return {
        company: company.trim(),
        location: location.trim(),
        role: roleLine.replace(/\*\*/g, "").trim(),
        period: periodLine.trim(),
        bullets,
      };
    })
    .filter((experience) => experience.company || experience.role);
}

function parseProjects(section: string) {
  return parseListItems(section)
    .map((line) => {
      const match = /^\*\*(.+?)\*\*\s+--\s+(.+)$/.exec(line);

      if (match) {
        return {
          title: match[1].trim(),
          description: match[2].trim(),
        };
      }

      return {
        title: line,
        description: "",
      };
    });
}

function parseSkills(section: string) {
  return parseListItems(section)
    .map((line) => {
      const match = /^\*\*(.+?):\*\*\s+(.+)$|^\*\*(.+?)\*\*:\s+(.+)$/.exec(line);

      if (match) {
        return {
          label: (match[1] || match[3]).trim(),
          items: (match[2] || match[4])
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        };
      }

      return {
        label: "General",
        items: line
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
    });
}

function parseEducation(section: string) {
  return parseListItems(section);
}

function parseSimpleListSection(section: string) {
  const listItems = parseListItems(section);
  return listItems.length ? listItems : normalizeLines(section);
}

export function parseCvMarkdown(markdown: string): ParsedCvDocument {
  const heading =
    /^#\s+CV\s+--\s+(.+)$/m.exec(markdown)?.[1]?.trim() ??
    /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ??
    "Candidate";

  return {
    name: heading,
    contact: parseHeaderContact(markdown),
    summary: extractAliasedSection(markdown, SECTION_ALIASES.summary),
    experiences: parseExperiences(
      extractAliasedSection(markdown, SECTION_ALIASES.experience),
    ),
    projects: parseProjects(
      extractAliasedSection(markdown, SECTION_ALIASES.projects),
    ),
    education: parseEducation(
      extractAliasedSection(markdown, SECTION_ALIASES.education),
    ),
    skills: parseSkills(extractAliasedSection(markdown, SECTION_ALIASES.skills)),
    certifications: parseSimpleListSection(
      extractAliasedSection(markdown, SECTION_ALIASES.certifications),
    ),
    awards: parseSimpleListSection(
      extractAliasedSection(markdown, SECTION_ALIASES.awards),
    ),
    publications: parseSimpleListSection(
      extractAliasedSection(markdown, SECTION_ALIASES.publications),
    ),
    volunteering: parseSimpleListSection(
      extractAliasedSection(markdown, SECTION_ALIASES.volunteering),
    ),
  };
}
