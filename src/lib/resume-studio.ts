import type { ParsedCvDocument } from "@/lib/data/parse-cv";
import type { Evaluation, Opportunity, UserProfile } from "@/lib/types";

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
  experienceHighlights: ResumeDraftExperience[];
  fileName: string;
  fitHighlights: string[];
  focusKeywords: string[];
  format: "a4" | "letter";
  headline: string;
  notes: string[];
  profileReady: boolean;
  projectHighlights: ResumeDraftProject[];
  skillHighlights: ResumeDraftSkillGroup[];
  summary: string;
  targetLabel: string;
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

function buildSummary(
  profile: UserProfile | null,
  cv: ParsedCvDocument,
  opportunity: Opportunity,
  evaluation: Evaluation | null,
  keywords: string[],
) {
  const base =
    profile?.narrative.headline ||
    cv.summary.replace(/\s+/g, " ").trim() ||
    "Builder of practical software systems with a bias toward shipping and clarity.";
  const keywordClause = keywords.length
    ? `Targeting ${opportunity.role} opportunities with emphasis on ${keywords
        .slice(0, 4)
        .join(", ")}.`
    : `Targeting ${opportunity.role} opportunities.`;
  const evaluationClause = evaluation?.summary
    ? `Role fit signal: ${evaluation.summary.replace(/\s+/g, " ").trim()}`
    : "";

  return [base, keywordClause, evaluationClause].filter(Boolean).join(" ");
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

export function buildResumeDraft(input: {
  cv: ParsedCvDocument;
  evaluation: Evaluation | null;
  format: "a4" | "letter";
  opportunity: Opportunity;
  profile: UserProfile | null;
  selectedKeywords: string[];
}) {
  const { cv, evaluation, format, opportunity, profile, selectedKeywords } = input;
  const focusKeywords = selectedKeywords.length
    ? selectedKeywords
    : getDefaultResumeKeywords(opportunity, evaluation);
  const rankingKeywords = [
    ...focusKeywords,
    opportunity.role,
    opportunity.company,
    opportunity.archetype ?? "",
  ].filter(Boolean);

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
    .slice(0, 3)
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
        .slice(0, 3),
    }));

  const projectHighlights = [...cv.projects]
    .sort(
      (left, right) =>
        scoreText(`${right.title} ${right.description}`, rankingKeywords) -
        scoreText(`${left.title} ${left.description}`, rankingKeywords),
    )
    .slice(0, 4);

  const skillHighlights = [...cv.skills]
    .sort(
      (left, right) =>
        scoreText(`${right.label} ${right.items.join(" ")}`, rankingKeywords) -
        scoreText(`${left.label} ${left.items.join(" ")}`, rankingKeywords),
    )
    .slice(0, 4);

  const name = profile?.candidate.fullName || cv.name || "candidate";
  const companySlug = slugify(opportunity.company || "role");
  const fileName = `${slugify(name)}-${companySlug}-${opportunity.date || "resume"}.pdf`;

  return {
    format,
    fileName,
    profileReady: Boolean(profile),
    targetLabel: `${opportunity.role} · ${opportunity.company}`,
    headline:
      profile?.narrative.headline ||
      `${opportunity.role} candidate with delivery-focused technical range`,
    contactLines: buildContactLines(profile, cv),
    summary: buildSummary(profile, cv, opportunity, evaluation, focusKeywords),
    focusKeywords,
    fitHighlights: buildFitHighlights(evaluation, focusKeywords),
    experienceHighlights,
    projectHighlights,
    skillHighlights,
    notes: buildNotes(profile, evaluation, opportunity),
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

export function renderResumeHtml(draft: ResumeDraft) {
  const keywordTags = draft.focusKeywords
    .map((keyword) => `<span class="chip">${escapeHtml(keyword)}</span>`)
    .join("");
  const contact = draft.contactLines
    .map((line) => `<span>${escapeHtml(line)}</span>`)
    .join('<span class="dot">·</span>');
  const fitHighlights = draft.fitHighlights
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const experiences = draft.experienceHighlights
    .map(
      (item) => `
        <section class="entry">
          <div class="entry-head">
            <h3>${escapeHtml(item.heading)}</h3>
            <p>${escapeHtml(item.subheading)}</p>
          </div>
          <ul>${item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
        </section>
      `,
    )
    .join("");
  const projects = draft.projectHighlights
    .map(
      (project) => `
        <li><strong>${escapeHtml(project.title)}</strong>${project.description ? ` — ${escapeHtml(project.description)}` : ""}</li>
      `,
    )
    .join("");
  const skills = draft.skillHighlights
    .map(
      (group) => `
        <li><strong>${escapeHtml(group.label)}:</strong> ${escapeHtml(group.items.join(", "))}</li>
      `,
    )
    .join("");
  const notes = draft.notes
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(draft.targetLabel)} Resume</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #18181b;
        background: #fff;
        font-size: 11px;
        line-height: 1.55;
      }
      .page { max-width: ${draft.format === "letter" ? "8in" : "7.27in"}; margin: 0 auto; padding: 0.1in 0; }
      .header { margin-bottom: 18px; }
      .header h1 { font-size: 28px; line-height: 1.1; margin: 0 0 6px; }
      .headline { font-size: 12px; font-weight: 600; color: #3f3f46; margin: 0 0 8px; }
      .contact { display: flex; flex-wrap: wrap; gap: 6px; color: #52525b; font-size: 10px; }
      .dot { color: #a1a1aa; }
      .target { margin-top: 10px; padding: 8px 10px; background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; }
      .summary { margin-top: 12px; color: #27272a; }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .chip { padding: 3px 8px; border: 1px solid #d4d4d8; border-radius: 999px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
      .grid { display: grid; grid-template-columns: 1.4fr 0.9fr; gap: 20px; }
      .section { margin-bottom: 16px; }
      .section h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; margin: 0 0 8px; }
      .entry { margin-bottom: 12px; }
      .entry-head h3 { font-size: 12px; margin: 0; }
      .entry-head p { margin: 3px 0 0; color: #52525b; }
      ul { margin: 8px 0 0; padding-left: 18px; }
      li { margin-bottom: 4px; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="header">
        <h1>${escapeHtml(draft.fileName.replace(/-\d{4}-\d{2}-\d{2}\.pdf$/, "").replace(/-/g, " "))}</h1>
        <p class="headline">${escapeHtml(draft.headline)}</p>
        <div class="contact">${contact}</div>
        <div class="target">
          <strong>Tailored target:</strong> ${escapeHtml(draft.targetLabel)}
        </div>
        <p class="summary">${escapeHtml(draft.summary)}</p>
        <div class="chips">${keywordTags}</div>
      </header>
      <section class="grid">
        <div>
          <section class="section">
            <h2>Fit Evidence</h2>
            <ul>${fitHighlights}</ul>
          </section>
          <section class="section">
            <h2>Experience Highlights</h2>
            ${experiences}
          </section>
          <section class="section">
            <h2>Selected Projects</h2>
            <ul>${projects}</ul>
          </section>
        </div>
        <aside>
          <section class="section">
            <h2>Skills</h2>
            <ul>${skills}</ul>
          </section>
          <section class="section">
            <h2>Tailoring Notes</h2>
            <ul>${notes}</ul>
          </section>
        </aside>
      </section>
    </main>
  </body>
</html>`;
}
