"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import styles from "./InterviewIntelDocument.module.css";

interface InterviewIntelDocumentProps {
  content: string;
}

interface IntelMetaItem {
  label: string;
  value: string;
}

interface IntelSection {
  body: string;
  title: string;
}

interface QuestionCard {
  angle: string;
  prompt: string;
  reason: string;
}

interface QuestionGroup {
  cards: QuestionCard[];
  title: string;
}

interface ConcernCard {
  concern: string;
  framing: string;
}

interface ChecklistItem {
  reason: string;
  title: string;
}

interface RoundCard {
  duration: string;
  prepare: string;
  testing: string;
  title: string;
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

function stripBoilerplate(text: string) {
  return text
    .replace(/\s*\[inferred from evaluation\]/gi, "")
    .replace(/\s*\[inferred\]/gi, "")
    .trim();
}

function parseLabeledLine(line: string) {
  const normalized = line.replace(/^-+\s*/, "").trim();
  const match = /^\*\*(.+?):\*\*\s*(.+)$/.exec(normalized);
  if (!match) return null;
  return {
    label: cleanInlineMarkdown(match[1]),
    value: cleanInlineMarkdown(match[2]),
  };
}

function parseIntelDocument(content: string) {
  const body = content.replace(/^#\s+.+$/m, "").trim();
  const sectionMatches = [...body.matchAll(/^##\s+(.+)$/gm)];
  const introEnd = sectionMatches[0]?.index ?? body.length;
  const intro = body.slice(0, introEnd).trim();

  const metadata = intro
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseLabeledLine)
    .filter((item): item is IntelMetaItem => item !== null);

  const sections: IntelSection[] = sectionMatches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = sectionMatches[index + 1]?.index ?? body.length;
    return {
      title: cleanInlineMarkdown(match[1]),
      body: body.slice(start, end).trim(),
    };
  });

  return { metadata, sections };
}

function parseMarkdownTableRows(lines: string[]) {
  if (lines.length < 2) return null;
  const cellsFromLine = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cleanInlineMarkdown(cell.trim()));
  const header = cellsFromLine(lines[0]);
  const rows = lines.slice(2).map(cellsFromLine).filter((row) => row.length >= header.length);
  if (!header.length || !rows.length) return null;
  return { header, rows };
}

function parseQuestionGroups(body: string): QuestionGroup[] {
  const groups = body.split(/^###\s+/m).map((b) => b.trim()).filter(Boolean);
  return groups.map((group) => {
    const lines = group.split("\n").map((l) => l.trim()).filter(Boolean);
    const title = stripBoilerplate(cleanInlineMarkdown(lines[0] ?? "Questions"));
    const cards: QuestionCard[] = [];
    let current: QuestionCard | null = null;
    let activeField: keyof QuestionCard | null = null;

    for (const line of lines.slice(1)) {
      if (line.startsWith("- **Question:**")) {
        if (current) cards.push(current);
        current = {
          prompt: cleanInlineMarkdown(line.replace(/^- \*\*Question:\*\*\s*/, "")),
          reason: "",
          angle: "",
        };
        activeField = "prompt";
        continue;
      }
      if (line.startsWith("**Why this is likely:**")) {
        if (!current) continue;
        current.reason = cleanInlineMarkdown(line.replace(/^\*\*Why this is likely:\*\*\s*/, ""));
        activeField = "reason";
        continue;
      }
      if (line.startsWith("**Best angle for you:**")) {
        if (!current) continue;
        current.angle = cleanInlineMarkdown(line.replace(/^\*\*Best angle for you:\*\*\s*/, ""));
        activeField = "angle";
        continue;
      }
      if (current && activeField) {
        current[activeField] = cleanInlineMarkdown(`${current[activeField]} ${line}`);
      }
    }
    if (current) cards.push(current);
    return { title, cards };
  });
}

function parseBackgroundCards(body: string): ConcernCard[] {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const cards: ConcernCard[] = [];
  let current: ConcernCard | null = null;
  let activeField: keyof ConcernCard | null = null;

  for (const line of lines) {
    if (line.startsWith("- **Likely concern:**")) {
      if (current) cards.push(current);
      current = {
        concern: cleanInlineMarkdown(line.replace(/^- \*\*Likely concern:\*\*\s*/, "")),
        framing: "",
      };
      activeField = "concern";
      continue;
    }
    if (line.startsWith("**Recommended framing:**")) {
      if (!current) continue;
      current.framing = cleanInlineMarkdown(line.replace(/^\*\*Recommended framing:\*\*\s*/, ""));
      activeField = "framing";
      continue;
    }
    if (current && activeField) {
      current[activeField] = cleanInlineMarkdown(`${current[activeField]} ${line}`);
    }
  }
  if (current) cards.push(current);
  return cards;
}

function parseChecklistItems(body: string): ChecklistItem[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- [ ]"))
    .map((line) => {
      const cleaned = cleanInlineMarkdown(line.replace(/^- \[ \]\s*/, ""));
      const [title, reason] = cleaned.split(/\s+—\s+why:\s+/i);
      return { title: title?.trim() ?? cleaned, reason: reason?.trim() ?? "" } satisfies ChecklistItem;
    });
}

function parseTableFromBody(body: string) {
  const lines = body.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("|"));
  return parseMarkdownTableRows(lines);
}

function parseBulletDefinitions(body: string) {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((line) => {
      const parsed = parseLabeledLine(line);
      return parsed ?? { label: "", value: cleanInlineMarkdown(line.replace(/^- /, "")) };
    });
}

function parseRoundCards(body: string): RoundCard[] {
  const groups = body.split(/^###\s+/m).map((b) => b.trim()).filter(Boolean);
  return groups.map((group) => {
    const lines = group.split("\n").map((l) => l.trim()).filter(Boolean);
    const title = stripBoilerplate(cleanInlineMarkdown(lines[0] ?? "Round"));
    const duration = lines
      .find((l) => l.startsWith("- **Estimated duration:**"))
      ?.replace(/^- \*\*Estimated duration:\*\*\s*/, "");
    const testing = lines
      .find((l) => l.startsWith("- **What they are likely testing:**"))
      ?.replace(/^- \*\*What they are likely testing:\*\*\s*/, "");
    const prepare = lines
      .find((l) => l.startsWith("- **How to prepare:**"))
      ?.replace(/^- \*\*How to prepare:\*\*\s*/, "");
    return {
      title,
      duration: cleanInlineMarkdown(duration ?? ""),
      testing: cleanInlineMarkdown(testing ?? ""),
      prepare: cleanInlineMarkdown(prepare ?? ""),
    } satisfies RoundCard;
  });
}

function renderFallbackProse(body: string, keyPrefix: string): ReactNode[] {
  const blocks = body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b && !/^-{3,}$/.test(b));

  return blocks.flatMap((block, blockIndex) => {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l && !/^-{3,}$/.test(l));
    if (!lines.length) return [];

    const bulletLines = lines.filter((l) => /^- /.test(l));
    if (bulletLines.length > 0 && bulletLines.length === lines.length) {
      return [
        <ul className={styles.proseBullets} key={`${keyPrefix}-${blockIndex}`}>
          {bulletLines.map((line, i) => (
            <li key={i}>{cleanInlineMarkdown(line.replace(/^- /, ""))}</li>
          ))}
        </ul>,
      ];
    }

    const cleaned = cleanInlineMarkdown(block).replace(/^-{3,}$/gm, "").trim();
    if (!cleaned) return [];
    return [
      <p className={styles.proseParagraph} key={`${keyPrefix}-${blockIndex}`}>
        {cleaned}
      </p>,
    ];
  });
}

/* ── Expected Interview Shape — horizontal stage strip ───────── */

function ExpectedRoundsStrip({ rounds, title }: { rounds: RoundCard[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section className={styles.intelSection}>
      <h3 className={styles.intelSectionHeading}>{title}</h3>
      <div className={styles.stageStrip}>
        {rounds.map((round, index) => (
          <button
            className={styles.stageCard}
            data-active={active === index}
            key={index}
            onClick={() => setActive(active === index ? null : index)}
            type="button"
          >
            <div className={styles.stageCardHead}>
              <span className={styles.stageIndex}>
                STAGE {String(index + 1).padStart(2, "0")}
              </span>
              {round.duration ? (
                <span className={styles.stageDuration}>{round.duration}</span>
              ) : null}
            </div>
            <p className={styles.stageTitle}>{round.title}</p>
            {round.testing ? (
              <p className={styles.stageTesting}>{round.testing}</p>
            ) : null}
          </button>
        ))}
      </div>

      {active !== null && rounds[active] && (
        <div className={styles.stageDetail} key={active}>
          <div className={styles.stageDetailHead}>
            <span className={styles.stageDetailLabel}>
              STAGE {String(active + 1).padStart(2, "0")} · {rounds[active].title}
            </span>
          </div>
          {rounds[active].testing ? (
            <div className={styles.stageDetailBlock}>
              <p className={styles.stageDetailKey}>What they are likely testing</p>
              <p className={styles.stageDetailValue}>{rounds[active].testing}</p>
            </div>
          ) : null}
          {rounds[active].prepare ? (
            <div className={styles.stageDetailBlock}>
              <p className={styles.stageDetailKey}>How to prepare</p>
              <p className={styles.stageDetailValue}>{rounds[active].prepare}</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

/* ── Likely Questions — category nav + stacked cards ─────────── */

function QuestionSection({ groups, title }: { groups: QuestionGroup[]; title: string }) {
  const [activeGroup, setActiveGroup] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  function selectGroup(index: number) {
    if (index === activeGroup) return;
    setActiveGroup(index);
    setAnimKey((k) => k + 1);
  }

  const current = groups[activeGroup];

  return (
    <section className={styles.intelSection}>
      <h3 className={styles.intelSectionHeading}>{title}</h3>
      <div className={styles.questionLayout}>
        {/* Left nav */}
        <nav className={styles.questionNav} aria-label="Question categories">
          <p className={styles.questionNavHint}>
            Predicted from JD overlap and candidate profile.
          </p>
          <ul className={styles.questionCategoryList} role="list">
            {groups.map((group, index) => (
              <li key={index}>
                <button
                  aria-pressed={index === activeGroup}
                  className={styles.questionCategoryBtn}
                  data-active={index === activeGroup}
                  onClick={() => selectGroup(index)}
                  type="button"
                >
                  <span className={styles.questionCategoryName}>{group.title}</span>
                  <span className={styles.questionCategoryCount}>{group.cards.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Right: stacked question cards */}
        <div className={styles.questionCards} key={animKey}>
          {current?.cards.map((card, i) => (
            <article className={styles.questionCard} key={`${card.prompt}-${i}`}>
              <div className={styles.questionCardTag}>
                <span className={styles.questionCardTagLabel}>{current.title}</span>
                <span className={styles.questionCardTagIndex}>
                  Q_{String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <p className={styles.questionPrompt}>{card.prompt}</p>
              {(card.reason || card.angle) ? (
                <div className={styles.questionMeta}>
                  {card.reason ? (
                    <div className={styles.questionMetaBlock}>
                      <p className={styles.questionMetaKey}>Why this is likely</p>
                      <p className={styles.questionMetaValue}>{card.reason}</p>
                    </div>
                  ) : null}
                  {card.angle ? (
                    <div className={styles.questionMetaBlock}>
                      <p className={styles.questionMetaKey}>Best angle</p>
                      <p className={styles.questionMetaValue}>{card.angle}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Background Framing — flagged concern cards ───────────────── */

function ConcernSection({ cards, title }: { cards: ConcernCard[]; title: string }) {
  function shortFlag(text: string, index: number): string {
    const firstSentence = text.split(/[.!?]/)[0] ?? text;
    const words = firstSentence.trim().toUpperCase().split(/\s+/).slice(0, 4).join(" ");
    return `FLAG_${String(index + 1).padStart(2, "0")}: ${words}`;
  }

  return (
    <section className={styles.intelSection}>
      <h3 className={styles.intelSectionHeading}>{title}</h3>
      <div className={styles.concernList}>
        {cards.map((card, index) => (
          <article className={styles.concernCard} key={index}>
            <div className={styles.concernCardHead}>
              <span className={styles.concernFlag}>{shortFlag(card.concern, index)}</span>
              <span className={styles.concernWarning} aria-label="Risk flag">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M8 2L14 13H2L8 2Z"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinejoin="round"
                  />
                  <line x1="8" y1="7" x2="8" y2="10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                  <circle cx="8" cy="12" r="0.6" fill="currentColor" />
                </svg>
              </span>
            </div>
            <p className={styles.concernText}>{card.concern}</p>
            {card.framing ? (
              <div className={styles.concernMitigation}>
                <p className={styles.concernMitigationKey}>Mitigation</p>
                <p className={styles.concernMitigationValue}>{card.framing}</p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

/* ── Main document component ─────────────────────────────────── */

export default function InterviewIntelDocument({ content }: InterviewIntelDocumentProps) {
  const doc = parseIntelDocument(content);

  return (
    <div className={styles.intelDocument}>
      {doc.metadata.length ? (
        <section className={styles.metaStrip}>
          {doc.metadata.map((item) => (
            <div className={styles.metaItem} key={item.label}>
              <span className={styles.metaLabel}>{item.label}</span>
              <span className={styles.metaValue}>{item.value}</span>
            </div>
          ))}
        </section>
      ) : null}

      {doc.sections.map((section) => {
        if (section.title === "Expected Interview Shape") {
          const rounds = parseRoundCards(section.body);
          return rounds.length ? (
            <ExpectedRoundsStrip key={section.title} rounds={rounds} title={section.title} />
          ) : (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              {renderFallbackProse(section.body, section.title)}
            </section>
          );
        }

        if (section.title === "Likely Questions") {
          const groups = parseQuestionGroups(section.body).filter((g) => g.cards.length);
          return groups.length ? (
            <QuestionSection key={section.title} groups={groups} title={section.title} />
          ) : (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              {renderFallbackProse(section.body, section.title)}
            </section>
          );
        }

        if (section.title === "Background Framing") {
          const cards = parseBackgroundCards(section.body);
          return cards.length ? (
            <ConcernSection key={section.title} cards={cards} title={section.title} />
          ) : (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              {renderFallbackProse(section.body, section.title)}
            </section>
          );
        }

        if (section.title === "Technical Prep Checklist") {
          const items = parseChecklistItems(section.body);
          return items.length ? (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              <div className={styles.checklistGrid}>
                {items.map((item, i) => (
                  <article className={styles.checklistItem} key={`${item.title}-${i}`}>
                    <p className={styles.checklistAction}>{item.title}</p>
                    {item.reason ? <p className={styles.checklistReason}>{item.reason}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null;
        }

        if (section.title === "Process Overview" || section.title === "Company Signals") {
          const definitions = parseBulletDefinitions(section.body);
          return (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              <div className={styles.definitionTable}>
                {definitions.map((item, index) => (
                  <div className={styles.definitionRow} key={`${section.title}-${index}`}>
                    {item.label ? (
                      <span className={styles.definitionLabel}>{item.label}</span>
                    ) : null}
                    <span className={styles.definitionValue}>{item.value}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (section.title === "Questions To Ask Them") {
          const items = section.body
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.startsWith("- "))
            .map((l) => cleanInlineMarkdown(l.replace(/^- /, "")));
          return (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              <ol className={styles.askList}>
                {items.map((item, i) => (
                  <li key={`${item}-${i}`}>{item}</li>
                ))}
              </ol>
            </section>
          );
        }

        if (section.title === "Story Bank Mapping" || section.title === "Evaluation Story Map") {
          const table = parseTableFromBody(section.body);
          return (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              {table ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {table.header.map((cell, i) => (
                          <th key={`h-${i}`}>{cell}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`}>
                          {table.header.map((_, cellIndex) => (
                            <td key={`${rowIndex}-${cellIndex}`}>{row[cellIndex] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                renderFallbackProse(section.body, section.title)
              )}
            </section>
          );
        }

        return (
          <section className={styles.intelSection} key={section.title}>
            <h3 className={styles.intelSectionHeading}>{section.title}</h3>
            {renderFallbackProse(section.body, section.title)}
          </section>
        );
      })}
    </div>
  );
}
