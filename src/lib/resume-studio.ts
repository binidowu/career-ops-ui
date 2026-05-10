import type { ParsedCvDocument } from "@/lib/data/parse-cv";
import type { Evaluation, Opportunity, ResumeDocument, UserProfile } from "@/lib/types";

export type ResumeDraftVariant = "balanced" | "technical" | "execution";

export interface ResumeDraftExperience {
  bullets: string[];
  heading: string;
  subheading: string;
}

export interface ResumeDraftProject {
  description: string;
  title: string;
}

export interface ResumeDraftSkillGroup {
  items: string[];
  label: string;
}

export interface ResumeDraft {
  contactLines: string[];
  educationHighlights: string[];
  experienceHighlights: ResumeDraftExperience[];
  fileName: string;
  fitHighlights: string[];
  focusKeywords: string[];
  format: "a4" | "letter";
  headline: string;
  name: string;
  notes: string[];
  profileReady: boolean;
  projectHighlights: ResumeDraftProject[];
  skillHighlights: ResumeDraftSkillGroup[];
  summary: string;
  targetLabel: string;
  variantLabel: string;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function cleanSentence(value: string) {
  return value
    .replace(/\|/g, " ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function takeLeadSentences(value: string, count: number) {
  const matches = cleanSentence(value).match(/[^.!?]+[.!?]?/g) ?? [];
  return matches
    .slice(0, count)
    .map((sentence) => sentence.trim())
    .join(" ");
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#/.]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function scoreText(text: string, keywords: string[]) {
  const haystack = text.toLowerCase();

  return keywords.reduce((score, keyword) => {
    if (!keyword) {
      return score;
    }

    if (haystack.includes(keyword.toLowerCase())) {
      return score + Math.max(1, tokenize(keyword).length);
    }

    return score;
  }, 0);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getDefaultResumeKeywords(
  opportunity: Opportunity,
  evaluation: Evaluation | null,
) {
  if (evaluation?.keywords.length) {
    return evaluation.keywords.slice(0, 8);
  }

  return [...new Set(tokenize(`${opportunity.role} ${opportunity.archetype ?? ""}`))].slice(
    0,
    6,
  );
}

function buildContactLines(profile: UserProfile | null, cv: ParsedCvDocument) {
  const profileLines = [
    profile?.candidate.location,
    profile?.candidate.email,
    profile?.candidate.phone,
    profile?.candidate.linkedin,
    profile?.candidate.github,
    profile?.candidate.portfolioUrl,
  ].filter((value): value is string => Boolean(value && value.trim()));

  if (profileLines.length) {
    return profileLines;
  }

  return Object.values(cv.contact).filter(Boolean);
}

function buildHeadline(
  profile: UserProfile | null,
  opportunity: Opportunity,
  variant: ResumeDraftVariant,
  tone: number,
  headlineOverride?: string,
) {
  if (headlineOverride?.trim()) {
    return headlineOverride.trim();
  }

  if (profile?.narrative.headline && tone < 65 && variant === "balanced") {
    return profile.narrative.headline;
  }

  if (variant === "technical") {
    return tone >= 60
      ? "AI / software engineer building agentic systems, RAG pipelines, and production-ready tooling"
      : "Software engineer with hands-on experience in agentic systems, RAG pipelines, and AI product delivery";
  }

  if (variant === "execution") {
    return tone >= 60
      ? "Software engineer shipping AI-powered tools, full-stack systems, and reliable operator workflows"
      : "Software engineer translating messy requirements into reliable AI-assisted and full-stack systems";
  }

  return tone >= 60
    ? `${opportunity.role} candidate with hands-on AI systems and full-stack delivery experience`
    : "Software engineer with hands-on experience building AI systems and full-stack applications";
}

function buildSummary(
  profile: UserProfile | null,
  cv: ParsedCvDocument,
  opportunity: Opportunity,
  evaluation: Evaluation | null,
  tone: number,
  variant: ResumeDraftVariant,
  summaryOverride?: string,
) {
  if (summaryOverride?.trim()) {
    return summaryOverride.trim();
  }

  const base =
    takeLeadSentences(profile?.narrative.exitStory || "", 2) ||
    takeLeadSentences(cv.summary, 2) ||
    "Software engineer with hands-on experience building AI systems and delivery-oriented full-stack products.";

  const evaluationLine = cleanSentence(evaluation?.summary || "");
  const roleLine =
    variant === "technical"
      ? "Best used for roles that value React delivery, AI tooling familiarity, and hands-on system building."
      : variant === "execution"
        ? `Strong fit for roles that value shipping, troubleshooting, and turning ambiguous requirements into working systems.`
        : `Targeting ${opportunity.role} roles with strong overlap in frontend delivery, API integration, and AI-assisted product development.`;
  const closingLine =
    tone >= 60
      ? evaluationLine || `Ready to contribute quickly on ${opportunity.company} problems with strong ownership.`
      : evaluationLine;

  return [base, roleLine, closingLine]
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

function buildFitHighlights(evaluation: Evaluation | null, keywords: string[]) {
  if (evaluation?.cvMatchItems.length) {
    return evaluation.cvMatchItems
      .slice(0, 4)
      .map(
        (item) =>
          `${item.requirement} — ${item.match}${item.source ? ` (${item.source})` : ""}`,
      );
  }

  if (keywords.length) {
    return keywords.slice(0, 4).map((keyword) => `Target keyword: ${keyword}`);
  }

  return ["Generate an evaluation report to surface tailored fit evidence here."];
}

function buildNotes(
  profile: UserProfile | null,
  evaluation: Evaluation | null,
  opportunity: Opportunity,
) {
  const profileNotes = profile?.narrative.superpowers.slice(0, 2) ?? [];
  const personalization = evaluation?.personalizationItems
    .slice(0, 3)
    .map((item) => `${item.section}: ${item.proposedChange}`) ?? [];
  const fallback = opportunity.notes ? [opportunity.notes] : [];

  return [...profileNotes, ...personalization, ...fallback].slice(0, 5);
}

function buildVariantLabel(variant: ResumeDraftVariant) {
  switch (variant) {
    case "technical":
      return "Technical emphasis";
    case "execution":
      return "Execution emphasis";
    default:
      return "Balanced emphasis";
  }
}

export function buildResumeDraft(input: {
  cv: ParsedCvDocument;
  evaluation: Evaluation | null;
  format: "a4" | "letter";
  opportunity: Opportunity;
  profile: UserProfile | null;
  selectedKeywords: string[];
  tone: number;
  variant: ResumeDraftVariant;
  headlineOverride?: string;
  summaryOverride?: string;
}) {
  const {
    cv,
    evaluation,
    format,
    opportunity,
    profile,
    selectedKeywords,
    tone,
    variant,
    headlineOverride,
    summaryOverride,
  } = input;
  const focusKeywords = selectedKeywords.length
    ? selectedKeywords
    : getDefaultResumeKeywords(opportunity, evaluation);
  const rankingKeywords = unique([
    ...focusKeywords,
    opportunity.role,
    opportunity.company,
    opportunity.archetype ?? "",
    ...(variant === "technical"
      ? ["python", "typescript", "api", "rag", "agentic", "langchain", "react"]
      : []),
    ...(variant === "execution"
      ? ["delivery", "troubleshooting", "documentation", "workflow", "operations"]
      : []),
  ].filter(Boolean));

  const experienceHighlights = [...cv.experiences]
    .sort((left, right) => {
      const leftScore = scoreText(
        `${left.company} ${left.role} ${left.location} ${left.bullets.join(" ")}`,
        rankingKeywords,
      );
      const rightScore = scoreText(
        `${right.company} ${right.role} ${right.location} ${right.bullets.join(" ")}`,
        rankingKeywords,
      );

      return rightScore - leftScore;
    })
    .slice(0, variant === "execution" ? 4 : 5)
    .map((experience) => ({
      heading: experience.company,
      subheading: [experience.role, experience.location, experience.period]
        .filter(Boolean)
        .join(" · "),
      bullets: [...experience.bullets]
        .sort(
          (left, right) =>
            scoreText(right, rankingKeywords) - scoreText(left, rankingKeywords),
        )
        .slice(0, variant === "technical" ? 4 : 5),
    }));

  const projectHighlights = [...cv.projects]
    .sort(
      (left, right) =>
        scoreText(`${right.title} ${right.description}`, rankingKeywords) -
        scoreText(`${left.title} ${left.description}`, rankingKeywords),
    )
    .slice(0, variant === "technical" ? 4 : 3);

  const skillHighlights = [...cv.skills]
    .sort(
      (left, right) =>
        scoreText(`${right.label} ${right.items.join(" ")}`, rankingKeywords) -
        scoreText(`${left.label} ${left.items.join(" ")}`, rankingKeywords),
    )
    .slice(0, variant === "technical" ? 6 : 5);

  const name = profile?.candidate.fullName || cv.name || "candidate";
  const companySlug = slugify(opportunity.company || "role");
  const fileName = `${slugify(name)}-${companySlug}-${opportunity.date || "resume"}.pdf`;
  const headline = buildHeadline(
    profile,
    opportunity,
    variant,
    tone,
    headlineOverride,
  );

  return {
    format,
    fileName,
    name,
    profileReady: Boolean(profile),
    targetLabel: `${opportunity.role} · ${opportunity.company}`,
    headline,
    contactLines: buildContactLines(profile, cv),
    summary: buildSummary(
      profile,
      cv,
      opportunity,
      evaluation,
      tone,
      variant,
      summaryOverride,
    ),
    focusKeywords,
    fitHighlights: buildFitHighlights(evaluation, focusKeywords),
    experienceHighlights,
    projectHighlights,
    skillHighlights,
    educationHighlights: cv.education.slice(0, 3),
    notes: buildNotes(profile, evaluation, opportunity),
    variantLabel: buildVariantLabel(variant),
  } satisfies ResumeDraft;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ---------------------------------------------------------------------------
// ayo-clean-v1 template helpers
// ---------------------------------------------------------------------------

function buildContactLine(lines: string[]): string {
  return lines
    .map((line) => {
      const isEmail = line.includes("@");
      const isUrl =
        line.includes("github.com") ||
        line.includes("linkedin.com") ||
        line.startsWith("http");
      const href = isEmail
        ? `mailto:${line}`
        : isUrl
          ? line.startsWith("http")
            ? line
            : `https://${line}`
          : null;
      const display = escapeHtml(
        line.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      );
      return href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${display}</a>`
        : `<span>${display}</span>`;
    })
    .join('<span class="contact-sep"> | </span>');
}

function renderExperienceBlock(block: {
  type: "experience";
  company: string;
  role: string;
  location: string;
  period: string;
  bullets: Array<{ text: string }>;
}): string {
  const bulletsHtml = block.bullets
    .map((b) => `<li>${escapeHtml(b.text)}</li>`)
    .join("");
  const meta = [block.location, block.period].filter(Boolean).join(" · ");
  return `<article class="entry">
    <div class="entry-head">
      <span class="entry-primary"><strong>${escapeHtml(block.role)}</strong><span class="entry-sep"> | </span>${escapeHtml(block.company)}</span>
      ${meta ? `<span class="entry-meta">${escapeHtml(meta)}</span>` : ""}
    </div>
    ${bulletsHtml ? `<ul class="sub-list">${bulletsHtml}</ul>` : ""}
  </article>`;
}

function renderProjectBlock(block: {
  type: "project";
  title: string;
  description: string;
  bullets: Array<{ text: string }>;
}): string {
  const bulletsHtml = block.bullets
    .map((b) => `<li>${escapeHtml(b.text)}</li>`)
    .join("");
  const heading = block.description
    ? `${escapeHtml(block.title)}<span class="entry-sep"> | </span><span class="entry-tech">${escapeHtml(block.description)}</span>`
    : escapeHtml(block.title);
  return `<li class="project-item">
    <div class="project-head"><strong>${heading}</strong></div>
    ${bulletsHtml ? `<ul class="sub-list">${bulletsHtml}</ul>` : ""}
  </li>`;
}

function renderSkillGroupBlock(block: {
  type: "skillGroup";
  label: string;
  items: string[];
}): string {
  return `<li><span class="skill-label">${escapeHtml(block.label)}:</span> ${escapeHtml(block.items.join(", "))}</li>`;
}

function renderListItemBlock(block: { type: "listItem"; text: string }): string {
  return `<li>${escapeHtml(block.text)}</li>`;
}

function renderTextBlock(block: { type: "text"; text: string }): string {
  return `<p class="summary-text">${escapeHtml(block.text)}</p>`;
}

function renderSection(section: ResumeDocument["sections"][number]): string {
  if (!section.enabled || !section.blocks.length) return "";

  const blocks = section.blocks;
  const firstType = blocks[0]?.type;

  // Project sections: top-level bullet list with sub-bullets
  const isProjectSection = blocks.every((b) => b.type === "project");
  // Experience sections: entry articles
  const isExpSection = blocks.every((b) => b.type === "experience");
  // Skill sections: inline label: items
  const isSkillSection = blocks.every((b) => b.type === "skillGroup");
  // List-item sections (education, certifications, awards…)
  const isListSection = blocks.every((b) => b.type === "listItem");
  // Summary / text sections
  const isTextSection = blocks.every((b) => b.type === "text") || firstType === "text";

  let innerHtml = "";

  if (isProjectSection) {
    innerHtml = `<ul class="project-list">${blocks.map((b) => renderProjectBlock(b as Parameters<typeof renderProjectBlock>[0])).join("")}</ul>`;
  } else if (isExpSection) {
    innerHtml = `<div class="entry-list">${blocks.map((b) => renderExperienceBlock(b as Parameters<typeof renderExperienceBlock>[0])).join("")}</div>`;
  } else if (isSkillSection) {
    innerHtml = `<ul class="skill-list">${blocks.map((b) => renderSkillGroupBlock(b as Parameters<typeof renderSkillGroupBlock>[0])).join("")}</ul>`;
  } else if (isListSection) {
    innerHtml = `<ul class="plain-list">${blocks.map((b) => renderListItemBlock(b as Parameters<typeof renderListItemBlock>[0])).join("")}</ul>`;
  } else if (isTextSection) {
    innerHtml = blocks.map((b) => renderTextBlock(b as Parameters<typeof renderTextBlock>[0])).join("");
  } else {
    // Mixed section — render each block by type
    innerHtml = blocks
      .map((b) => {
        if (b.type === "experience") return renderExperienceBlock(b);
        if (b.type === "project") return renderProjectBlock(b);
        if (b.type === "skillGroup") return renderSkillGroupBlock(b);
        if (b.type === "listItem") return renderListItemBlock(b);
        if (b.type === "text") return renderTextBlock(b);
        return "";
      })
      .join("");
  }

  return `<section class="section">
    <div class="section-label">${escapeHtml(section.label.toUpperCase())}</div>
    ${innerHtml}
  </section>`;
}

// ---------------------------------------------------------------------------
// Overflow estimator — returns approximate page count for pre-export warning
// ---------------------------------------------------------------------------

// Line height in points at 10pt body, 1.4 leading
const LINE_PT = 14;
// Characters that fit on a 7in content line at 10pt Arial (approx 95 chars)
const CHARS_PER_LINE = 95;

function estimateTextLines(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_LINE));
}

export function estimateResumePageCount(document: ResumeDocument): {
  estimatedPages: number;
  overflows: boolean;
  diagnostics: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }>;
} {
  // Header: name(24pt) + headline(14pt) + contact(12pt) + spacing(16pt) ≈ 66pt
  let totalPt = 66;

  for (const section of document.sections.filter((s) => s.enabled)) {
    // Section label + border + margin ≈ 28pt
    totalPt += 28;

    for (const block of section.blocks) {
      if (block.type === "text") {
        totalPt += estimateTextLines(block.text) * LINE_PT;
      } else if (block.type === "listItem") {
        totalPt += estimateTextLines(block.text) * LINE_PT;
      } else if (block.type === "skillGroup") {
        totalPt += LINE_PT;
      } else if (block.type === "experience") {
        // Entry header row + optional location
        totalPt += LINE_PT + (block.location ? LINE_PT : 0);
        for (const bullet of block.bullets) {
          totalPt += estimateTextLines(bullet.text) * LINE_PT;
        }
        // Gap between entries
        totalPt += 10;
      } else if (block.type === "project") {
        // Project title row
        totalPt += LINE_PT;
        for (const bullet of block.bullets) {
          totalPt += estimateTextLines(bullet.text) * LINE_PT;
        }
        totalPt += 8;
      }
    }

    // Section bottom margin
    totalPt += 14;
  }

  const pageHeightPt = document.format === "a4" ? 770 : 720;
  const estimatedPages = Math.ceil(totalPt / pageHeightPt);
  const overflows = totalPt > pageHeightPt * 2;

  const diagnostics: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }> = [];

  if (estimatedPages > 2) {
    diagnostics.push({
      code: "resume_overflow_pages",
      message: `Resume content estimates ${estimatedPages} pages. Consider shortening bullets or hiding sections.`,
      severity: "warning",
    });
  } else if (estimatedPages === 2) {
    diagnostics.push({
      code: "resume_two_pages",
      message: "Resume content fills approximately 2 pages.",
      severity: "info",
    });
  }

  return { estimatedPages, overflows, diagnostics };
}

// ---------------------------------------------------------------------------
// ayo-clean-v1 renderer
// ---------------------------------------------------------------------------

export function renderResumeDocumentHtml(document: ResumeDocument): string {
  const contactLineHtml = buildContactLine(document.contactLines);

  const enabledSections = [...document.sections]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const sectionsHtml = enabledSections.map(renderSection).join("");

  // Letter: 8.5in page, A4: 8.27in page — 0.6in side margins each = 7.3in / 7.07in content
  const pageSize = document.format === "a4"
    ? "@page { size: A4; }"
    : "@page { size: letter; }";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(document.targetLabel)} — Resume</title>
    <style>
      ${pageSize}
      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        background: #fff;
        color: #1a1a1a;
        font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
        font-size: 10pt;
        line-height: 1.4;
      }

      .page {
        width: ${document.format === "a4" ? "8.27in" : "8.5in"};
        margin: 0 auto;
        padding: 0.55in 0.6in 0.55in 0.6in;
      }

      /* ── Header ── */
      .doc-header {
        margin-bottom: 0.18in;
        padding-bottom: 0.1in;
        border-bottom: 1.5pt solid #1a1a1a;
      }
      .doc-name {
        font-size: 18pt;
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: -0.01em;
        color: #1a1a1a;
      }
      .doc-headline {
        font-size: 10.5pt;
        font-weight: 400;
        color: #444;
        margin-top: 3pt;
        margin-bottom: 4pt;
      }
      .doc-contact {
        font-size: 9pt;
        color: #333;
        margin-top: 4pt;
      }
      .doc-contact a { color: #1a1a1a; text-decoration: none; }
      .doc-contact a:hover { text-decoration: underline; }
      .contact-sep { color: #999; }

      /* ── Sections ── */
      .section { margin-bottom: 0.2in; }
      .section:last-child { margin-bottom: 0; }

      .section-label {
        font-size: 9.5pt;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: #1a1a1a;
        border-bottom: 1pt solid #1a1a1a;
        padding-bottom: 2pt;
        margin-bottom: 7pt;
      }

      /* ── Summary ── */
      .summary-text {
        font-size: 10pt;
        line-height: 1.45;
        color: #1a1a1a;
      }

      /* ── Experience entries ── */
      .entry-list { display: flex; flex-direction: column; gap: 10pt; }
      .entry { }
      .entry-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8pt;
      }
      .entry-primary {
        font-size: 10pt;
        font-weight: 400;
        flex: 1;
      }
      .entry-primary strong { font-weight: 700; }
      .entry-sep { color: #666; }
      .entry-tech { font-weight: 400; color: #444; }
      .entry-meta {
        font-size: 9pt;
        color: #555;
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ── Sub-bullets (experience / project) ── */
      .sub-list {
        list-style: none;
        margin: 4pt 0 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 2pt;
      }
      .sub-list li {
        position: relative;
        padding-left: 14pt;
        font-size: 9.5pt;
        line-height: 1.42;
        color: #1a1a1a;
      }
      .sub-list li::before {
        content: "○";
        position: absolute;
        left: 2pt;
        top: 0;
        font-size: 7pt;
        color: #555;
        line-height: 1.6;
      }

      /* ── Projects ── */
      .project-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 8pt;
        padding: 0;
      }
      .project-item { }
      .project-head {
        font-size: 10pt;
        padding-left: 12pt;
        position: relative;
      }
      .project-head::before {
        content: "●";
        position: absolute;
        left: 0;
        font-size: 7pt;
        top: 1pt;
        color: #1a1a1a;
      }
      .project-item .sub-list { margin-left: 12pt; }

      /* ── Skills ── */
      .skill-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 3pt;
        padding: 0;
      }
      .skill-list li {
        position: relative;
        padding-left: 12pt;
        font-size: 9.5pt;
        line-height: 1.42;
      }
      .skill-list li::before {
        content: "●";
        position: absolute;
        left: 0;
        font-size: 7pt;
        top: 1pt;
        color: #1a1a1a;
      }
      .skill-label { font-weight: 700; }

      /* ── Plain list (education, certs, awards…) ── */
      .plain-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 3pt;
        padding: 0;
      }
      .plain-list li { font-size: 9.5pt; line-height: 1.42; }

      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { padding: 0.55in 0.6in; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="doc-header">
        <div class="doc-name">${escapeHtml(document.name)}</div>
        ${document.headline ? `<div class="doc-headline">${escapeHtml(document.headline)}</div>` : ""}
        ${document.contactLines.length ? `<div class="doc-contact">${contactLineHtml}</div>` : ""}
      </header>
      ${sectionsHtml}
    </main>
  </body>
</html>`;
}

export function renderResumeHtml(draft: ResumeDraft) {
  const contactHtml = draft.contactLines
    .map((line) => {
      const isEmail = line.includes("@");
      const isLink =
        line.includes("github.com") ||
        line.includes("linkedin.com") ||
        line.startsWith("http");
      const href = isEmail
        ? `mailto:${line}`
        : isLink
          ? line.startsWith("http")
            ? line
            : `https://${line}`
          : undefined;
      return href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(line)}</a>`
        : `<span>${escapeHtml(line)}</span>`;
    })
    .join("\n");

  const experiencesHtml =
    draft.experienceHighlights.length > 0
      ? `<section class="section">
        <div class="section-label">EXPERIENCE VECTOR</div>
        <div class="entry-list">
          ${draft.experienceHighlights
            .map((entry) => {
              const subParts = entry.subheading.split(" · ");
              const role = subParts[0] ?? "";
              const period = subParts[subParts.length - 1] ?? "";
              return `<article class="entry">
              <div class="entry-head">
                <span class="entry-title"><strong>${escapeHtml(role)}</strong> | ${escapeHtml(entry.heading)}</span>
                <span class="entry-date">${escapeHtml(period)}</span>
              </div>
              <ul class="bullet-list">
                ${entry.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
              </ul>
            </article>`;
            })
            .join("")}
        </div>
      </section>`
      : "";

  const projectsHtml =
    draft.projectHighlights.length > 0
      ? `<section class="section">
        <div class="section-label">PROJECT LEDGER</div>
        <div class="project-list">
          ${draft.projectHighlights
            .map(
              (project) =>
                `<article class="project-item">
              <strong>${escapeHtml(project.title)}</strong>${project.description ? ` — <span class="project-desc">${escapeHtml(project.description)}</span>` : ""}
            </article>`,
            )
            .join("")}
        </div>
      </section>`
      : "";

  const educationHtml =
    draft.educationHighlights.length > 0
      ? `<section class="section">
        <div class="section-label">EDUCATION</div>
        <ul class="plain-list">
          ${draft.educationHighlights.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}
        </ul>
      </section>`
      : "";

  const skillsHtml =
    draft.skillHighlights.length > 0
      ? `<section class="section">
        <div class="section-label">TECHNICAL ONTOLOGY</div>
        <div class="ontology-grid">
          ${draft.skillHighlights
            .map(
              (group) =>
                `<div class="ontology-group">
              <div class="ontology-group-label">${escapeHtml(group.label)}</div>
              <div class="ontology-group-items">${escapeHtml(group.items.join(", "))}</div>
            </div>`,
            )
            .join("")}
        </div>
      </section>`
      : "";

  const pageWidth = draft.format === "letter" ? "8.5in" : "8.27in";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(draft.targetLabel)} Resume</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: #fff;
        color: #111;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 0.85rem;
        line-height: 1.5;
      }
      .page {
        max-width: ${pageWidth};
        margin: 0 auto;
        padding: 0.75in 0.8in;
      }
      .doc-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
        padding-bottom: 1.25rem;
        border-bottom: 1.5px solid #111;
        margin-bottom: 1.5rem;
      }
      .doc-identity { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
      .doc-name {
        font-size: 1.6rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #111;
        line-height: 1.15;
      }
      .doc-title {
        font-size: 1.25rem;
        font-weight: 400;
        color: #555;
      }
      .doc-contact {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.35rem;
        flex-shrink: 0;
        padding-top: 0.5rem;
      }
      .doc-contact span,
      .doc-contact a { 
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
        font-size: 0.75rem;
        color: #111;
        text-decoration: none;
        display: block;
      }
      .doc-contact a:hover { text-decoration: underline; }
      
      .section { margin-bottom: 1.5rem; }
      .section-label {
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
        font-size: 0.65rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #666;
        margin-bottom: 0.9rem;
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 0.45rem;
      }
      .section:last-child {
        border-top: 1px solid #ddd;
        padding-top: 1.5rem;
        margin-top: 2rem;
        margin-bottom: 0;
      }
      .section:last-child .section-label {
        border-bottom: none;
        padding-bottom: 0;
        margin-bottom: 1rem;
      }
      
      .section p { font-size: 0.82rem; color: #222; line-height: 1.55; }
      
      .entry-list { display: flex; flex-direction: column; gap: 1.5rem; }
      .entry { display: flex; flex-direction: column; gap: 0.5rem; }
      .entry-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 1rem;
        margin-bottom: 0.25rem;
      }
      .entry-title { font-size: 0.95rem; font-weight: 400; color: #555; flex: 1; }
      .entry-title strong { font-weight: 700; color: #111; }
      .entry-desc { font-style: italic; color: #555; }
      .entry-date { 
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
        font-size: 0.75rem; 
        color: #111; 
        white-space: nowrap; 
        flex-shrink: 0;
      }
      
      .bullet-list { list-style: none; display: grid; gap: 0.3rem; margin: 0; padding: 0; }
      .bullet-list li {
        position: relative;
        padding-left: 1.1rem;
        font-size: 0.82rem;
        color: #222;
        line-height: 1.55;
      }
      .bullet-list li::before {
        content: "—";
        position: absolute;
        left: 0;
        color: #aaa;
        font-size: 0.7em;
        top: 0.15em;
      }
      
      .project-list { display: flex; flex-direction: column; gap: 0.5rem; }
      .project-item { font-size: 0.85rem; color: #333; line-height: 1.5; }
      .project-item strong { font-weight: 700; color: #111; }
      .project-desc { font-style: normal; color: #333; }
      
      .plain-list { list-style: none; display: flex; flex-direction: column; gap: 0.25rem; }
      .plain-list li { font-size: 0.85rem; color: #333; line-height: 1.5; }
      
      .ontology-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.5rem;
      }
      .ontology-group { display: flex; flex-direction: column; gap: 0.35rem; }
      .ontology-group-label {
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
        font-size: 0.6rem;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #666;
      }
      .ontology-group-items { font-size: 0.75rem; color: #333; line-height: 1.5; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { padding: 0; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="doc-header">
        <div class="doc-identity">
          <div class="doc-name">${escapeHtml(draft.name)}</div>
          ${draft.headline ? `<div class="doc-title">${escapeHtml(draft.headline)}</div>` : ""}
        </div>
        <div class="doc-contact">
          ${contactHtml}
        </div>
      </header>

      ${
        draft.summary
          ? `<section class="section">
        <div class="section-label">PROFESSIONAL SYNOPSIS</div>
        <p>${escapeHtml(draft.summary)}</p>
      </section>`
          : ""
      }

      ${experiencesHtml}
      ${projectsHtml}
      ${educationHtml}
      ${skillsHtml}
    </main>
  </body>
</html>`;
}
