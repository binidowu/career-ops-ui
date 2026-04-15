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
  contact: Record<string, string>;
  education: string[];
  experiences: CvExperience[];
  name: string;
  projects: CvProject[];
  skills: CvSkillGroup[];
  summary: string;
}

function extractSection(markdown: string, heading: string) {
  const expression = new RegExp(
    `^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`,
    "im",
  );
  return expression.exec(markdown)?.[1]?.trim() ?? "";
}

function normalizeLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
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
        .filter((line) => line.startsWith("- "))
        .map((line) => line.replace(/^- /, "").trim());

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
  return normalizeLines(section)
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim())
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
  return normalizeLines(section)
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim())
    .map((line) => {
      const match = /^\*\*(.+?)\*\*:\s+(.+)$/.exec(line);

      if (match) {
        return {
          label: match[1].trim(),
          items: match[2]
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
  return normalizeLines(section)
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim());
}

export function parseCvMarkdown(markdown: string): ParsedCvDocument {
  const heading =
    /^#\s+CV\s+--\s+(.+)$/m.exec(markdown)?.[1]?.trim() ??
    /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ??
    "Candidate";

  return {
    name: heading,
    contact: parseHeaderContact(markdown),
    summary: extractSection(markdown, "Professional Summary"),
    experiences: parseExperiences(extractSection(markdown, "Work Experience")),
    projects: parseProjects(extractSection(markdown, "Projects")),
    education: parseEducation(extractSection(markdown, "Education")),
    skills: parseSkills(extractSection(markdown, "Skills")),
  };
}
