export interface BriefRound {
  duration: string;
  focus: string;
  prepare: string;
  title: string;
}

export interface BriefQuestionCard {
  angle: string;
  prompt: string;
  reason: string;
}

export interface BriefQuestionGroup {
  cards: BriefQuestionCard[];
  title: string;
}

export interface BriefConcern {
  concern: string;
  framing: string;
}

export interface BriefSection {
  body: string;
  title: string;
}

export interface BriefMetaItem {
  label: string;
  value: string;
}

export interface ParsedBrief {
  metadata: BriefMetaItem[];
  sections: BriefSection[];
}

export function cleanBriefInline(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\s*\[inferred from evaluation\]/gi, "")
    .replace(/\s*\[inferred from JD\]/gi, "")
    .replace(/\s*\[inferred\]/gi, "")
    .replace(/^-{3,}$/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function normalizeBriefTitle(value: string): string {
  return cleanBriefInline(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stripBoilerplate(text: string): string {
  return text
    .replace(/\s*\[inferred from evaluation\]/gi, "")
    .replace(/\s*\[inferred\]/gi, "")
    .trim();
}

function parseLabeledLine(line: string): BriefMetaItem | null {
  const normalized = line.replace(/^-+\s*/, "").trim();
  const match = /^(?:[-*]\s*)?\*\*(.+?):\*\*\s*(.+)$/.exec(normalized);
  if (!match) return null;
  return {
    label: cleanBriefInline(match[1]),
    value: cleanBriefInline(match[2]),
  };
}

export function parseBrief(content: string): ParsedBrief {
  const body = content.replace(/^#\s+.+$/m, "").replace(/^---$/gm, "").trim();
  const sectionMatches = [...body.matchAll(/^##\s+(.+)$/gm)];
  const introEnd = sectionMatches[0]?.index ?? body.length;
  const intro = body.slice(0, introEnd).trim();

  const metadata = intro
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseLabeledLine)
    .filter((item): item is BriefMetaItem => item !== null);

  const sections: BriefSection[] = sectionMatches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = sectionMatches[index + 1]?.index ?? body.length;
    return {
      title: cleanBriefInline(match[1]),
      body: body.slice(start, end).trim(),
    };
  });

  return { metadata, sections };
}

export function findBriefSection(
  brief: ParsedBrief,
  predicate: (normalizedTitle: string) => boolean,
): BriefSection | undefined {
  return brief.sections.find((section) => predicate(normalizeBriefTitle(section.title)));
}

export function parseBriefRounds(body: string): BriefRound[] {
  const groups = body.split(/^###\s+/m).map((b) => b.trim()).filter(Boolean);
  return groups
    .map((group) => {
      const lines = group.split("\n").map((l) => l.trim()).filter(Boolean);
      const title = stripBoilerplate(cleanBriefInline(lines[0] ?? "Round"));
      const duration = lines
        .find((l) => /^- \*\*(Estimated duration|Duration):\*\*/i.test(l))
        ?.replace(/^- \*\*(Estimated duration|Duration):\*\*\s*/i, "");
      const focus = lines
        .find((l) => l.startsWith("- **What they are likely testing:**"))
        ?.replace(/^- \*\*What they are likely testing:\*\*\s*/, "");
      const prepare = lines
        .find((l) => l.startsWith("- **How to prepare:**"))
        ?.replace(/^- \*\*How to prepare:\*\*\s*/, "");
      return {
        title,
        duration: cleanBriefInline(duration ?? ""),
        focus: cleanBriefInline(focus ?? ""),
        prepare: cleanBriefInline(prepare ?? ""),
      };
    })
    .filter((round) => Boolean(round.title) || Boolean(round.focus));
}

export function parseBriefQuestionGroups(body: string): BriefQuestionGroup[] {
  const groups = body.split(/^###\s+/m).map((b) => b.trim()).filter(Boolean);
  return groups
    .map((group) => {
      const lines = group.split("\n").map((l) => l.trim()).filter(Boolean);
      const title = stripBoilerplate(cleanBriefInline(lines[0] ?? "Questions"));
      const cards: BriefQuestionCard[] = [];
      let current: BriefQuestionCard | null = null;
      let activeField: keyof BriefQuestionCard | null = null;

      for (const line of lines.slice(1)) {
        if (/no strong prompts could be derived/i.test(line)) {
          continue;
        }
        if (line.startsWith("- **Question:**")) {
          if (current) cards.push(current);
          current = {
            prompt: cleanBriefInline(line.replace(/^- \*\*Question:\*\*\s*/, "")),
            reason: "",
            angle: "",
          };
          activeField = "prompt";
          continue;
        }
        if (line.startsWith("**Why this is likely:**")) {
          if (!current) continue;
          current.reason = cleanBriefInline(line.replace(/^\*\*Why this is likely:\*\*\s*/, ""));
          activeField = "reason";
          continue;
        }
        if (line.startsWith("**Best angle for you:**")) {
          if (!current) continue;
          current.angle = cleanBriefInline(line.replace(/^\*\*Best angle for you:\*\*\s*/, ""));
          activeField = "angle";
          continue;
        }
        if (current && activeField) {
          current[activeField] = cleanBriefInline(`${current[activeField]} ${line}`);
        }
      }
      if (current) cards.push(current);
      return { title, cards };
    })
    .filter((group) => group.cards.length > 0);
}

export function parseBriefConcerns(body: string): BriefConcern[] {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const cards: BriefConcern[] = [];
  let current: BriefConcern | null = null;
  let activeField: keyof BriefConcern | null = null;

  for (const line of lines) {
    if (line.startsWith("- **Likely concern:**")) {
      if (current) cards.push(current);
      current = {
        concern: cleanBriefInline(line.replace(/^- \*\*Likely concern:\*\*\s*/, "")),
        framing: "",
      };
      activeField = "concern";
      continue;
    }
    if (line.startsWith("**Recommended framing:**")) {
      if (!current) continue;
      current.framing = cleanBriefInline(line.replace(/^\*\*Recommended framing:\*\*\s*/, ""));
      activeField = "framing";
      continue;
    }
    if (current && activeField) {
      current[activeField] = cleanBriefInline(`${current[activeField]} ${line}`);
    }
  }
  if (current) cards.push(current);
  return cards;
}

export function extractBriefRounds(content: string): BriefRound[] {
  const brief = parseBrief(content);
  const section = findBriefSection(
    brief,
    (title) => title.includes("expected interview") || title.includes("round by round"),
  );
  return section ? parseBriefRounds(section.body) : [];
}

export function extractBriefQuestionGroups(content: string): BriefQuestionGroup[] {
  const brief = parseBrief(content);
  const section = findBriefSection(brief, (title) => title.includes("likely questions"));
  return section ? parseBriefQuestionGroups(section.body) : [];
}

export function extractBriefConcerns(content: string): BriefConcern[] {
  const brief = parseBrief(content);
  const section = findBriefSection(
    brief,
    (title) => title.includes("background framing") || title.includes("red flag"),
  );
  return section ? parseBriefConcerns(section.body) : [];
}
