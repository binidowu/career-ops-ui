import Link from "next/link";
import { notFound } from "next/navigation";

import GenerateInterviewIntelButton from "@/components/interview/GenerateInterviewIntelButton";
import StoryBankEditor from "@/components/interview/StoryBankEditor";
import { getInterviewPrepWorkspace, getOpportunity } from "@/lib/api/career-ops";

import styles from "./page.module.css";

function buildPrepChecklist(input: {
  gaps: Array<{ gap: string; mitigation: string }>;
  interviewItems: Array<{ requirement: string; story: string }>;
  keywords: string[];
}) {
  const items: string[] = [];

  for (const item of input.interviewItems) {
    if (item.requirement) {
      items.push(`Rehearse a concise answer for: ${item.requirement}`);
    }
    if (item.story) {
      items.push(`Practice the STAR arc for: ${item.story}`);
    }
  }

  for (const gap of input.gaps) {
    if (gap.mitigation) {
      items.push(`Close the gap on "${gap.gap}" by leading with: ${gap.mitigation}`);
    } else if (gap.gap) {
      items.push(`Prepare a confident framing for the gap: ${gap.gap}`);
    }
  }

  for (const keyword of input.keywords) {
    items.push(`Be ready to speak concretely about ${keyword}.`);
  }

  return [...new Set(items)].slice(0, 10);
}

function splitInterviewSummary(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function renderReportParagraphs(content: string) {
  return content
    .replace(/^#\s+.+$/m, "")
    .trim();
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
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

interface IntelSection {
  body: string;
  title: string;
}

function parseIntelDocument(content: string) {
  const body = renderReportParagraphs(content);
  const sectionMatches = [...body.matchAll(/^##\s+(.+)$/gm)];
  const introEnd = sectionMatches[0]?.index ?? body.length;
  const intro = body.slice(0, introEnd).trim();

  const metadata = intro
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLabeledLine)
    .filter((item): item is NonNullable<typeof item> => item !== null);

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
  const rows = lines
    .slice(2)
    .map(cellsFromLine)
    .filter((row) => row.length >= header.length);

  if (!header.length || !rows.length) {
    return null;
  }

  return { header, rows };
}

function parseQuestionGroups(body: string) {
  const groups = body
    .split(/^###\s+/m)
    .map((block) => block.trim())
    .filter(Boolean);

  return groups.map((group) => {
    const lines = group.split("\n").map((line) => line.trim()).filter(Boolean);
    const title = cleanInlineMarkdown(lines[0] ?? "Questions");
    const cards: Array<{ angle: string; prompt: string; reason: string }> = [];
    let current: { angle: string; prompt: string; reason: string } | null = null;
    let activeField: "angle" | "prompt" | "reason" | null = null;

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

function parseBackgroundCards(body: string) {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  const cards: Array<{ concern: string; framing: string }> = [];
  let current: { concern: string; framing: string } | null = null;
  let activeField: "concern" | "framing" | null = null;

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

function parseChecklistItems(body: string) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- [ ]"))
    .map((line) => {
      const cleaned = cleanInlineMarkdown(line.replace(/^- \[ \]\s*/, ""));
      const [title, reason] = cleaned.split(/\s+—\s+why:\s+/i);
      return {
        title: title?.trim() ?? cleaned,
        reason: reason?.trim() ?? "",
      };
    });
}

function parseTableFromBody(body: string) {
  const lines = body.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("|"));
  return parseMarkdownTableRows(lines);
}

function parseBulletDefinitions(body: string) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => {
      const parsed = parseLabeledLine(line);
      return parsed ?? { label: "", value: cleanInlineMarkdown(line.replace(/^- /, "")) };
    });
}

function renderFallbackProse(body: string, keyPrefix: string) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => cleanInlineMarkdown(paragraph))
    .filter(Boolean)
    .map((paragraph, index) => (
      <p className={styles.intelParagraph} key={`${keyPrefix}-${index}`}>
        {paragraph}
      </p>
    ));
}

function renderIntelContent(content: string) {
  const document = parseIntelDocument(content);

  return (
    <div className={styles.intelDocument}>
      {document.metadata.length ? (
        <section className={styles.intelMetaGrid}>
          {document.metadata.map((item) => (
            <div className={styles.intelMetaItem} key={item.label}>
              <span className={styles.intelMetaLabel}>{item.label}</span>
              <span className={styles.intelMetaValue}>{item.value}</span>
            </div>
          ))}
        </section>
      ) : null}

      {document.sections.map((section) => {
        if (section.title === "Likely Questions") {
          const groups = parseQuestionGroups(section.body);
          return (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              <div className={styles.intelQuestionGroups}>
                {groups.map((group) => (
                  <div className={styles.intelQuestionGroup} key={group.title}>
                    <h4 className={styles.intelSubheading}>{group.title}</h4>
                    <div className={styles.intelQuestionGrid}>
                      {group.cards.map((card) => (
                        <article className={styles.intelQuestionCard} key={card.prompt}>
                          <p className={styles.intelQuestionPrompt}>{card.prompt}</p>
                          <dl className={styles.intelCardMeta}>
                            <div>
                              <dt>Why this is likely</dt>
                              <dd>{card.reason}</dd>
                            </div>
                            <div>
                              <dt>Best angle</dt>
                              <dd>{card.angle}</dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (section.title === "Background Framing") {
          const cards = parseBackgroundCards(section.body);
          return (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              <div className={styles.intelConcernGrid}>
                {cards.map((card) => (
                  <article className={styles.intelConcernCard} key={card.concern}>
                    <p className={styles.intelConcernLabel}>Likely concern</p>
                    <p className={styles.intelConcernText}>{card.concern}</p>
                    <p className={styles.intelConcernLabel}>Recommended framing</p>
                    <p className={styles.intelConcernResponse}>{card.framing}</p>
                  </article>
                ))}
              </div>
            </section>
          );
        }

        if (section.title === "Technical Prep Checklist") {
          const items = parseChecklistItems(section.body);
          return (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              <div className={styles.intelChecklistGrid}>
                {items.map((item) => (
                  <article className={styles.intelChecklistCard} key={item.title}>
                    <p className={styles.intelChecklistAction}>{item.title}</p>
                    {item.reason ? <p className={styles.intelChecklistReason}>{item.reason}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          );
        }

        if (section.title === "Process Overview" || section.title === "Company Signals") {
          const definitions = parseBulletDefinitions(section.body);
          return (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              <div className={styles.intelDefinitionList}>
                {definitions.map((item, index) => (
                  <div className={styles.intelDefinitionRow} key={`${section.title}-${index}`}>
                    {item.label ? <span className={styles.intelDefinitionLabel}>{item.label}</span> : null}
                    <span className={styles.intelDefinitionValue}>{item.value}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (section.title === "Questions To Ask Them") {
          const items = section.body
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("- "))
            .map((line) => cleanInlineMarkdown(line.replace(/^- /, "")));

          return (
            <section className={styles.intelSection} key={section.title}>
              <h3 className={styles.intelSectionHeading}>{section.title}</h3>
              <ol className={styles.intelAskList}>
                {items.map((item) => (
                  <li key={item}>{item}</li>
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
                <div className={styles.intelTableWrap}>
                  <table className={styles.intelTable}>
                    <thead>
                      <tr>
                        {table.header.map((cell) => (
                          <th key={cell}>{cell}</th>
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

export default async function OpportunityInterviewPrepPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { opportunity, evaluation } = await getOpportunity(id);

  if (!opportunity) notFound();

  const prepWorkspace = await getInterviewPrepWorkspace({
    company: opportunity.company,
    role: opportunity.role,
  });

  const hasPrep = Boolean(
    evaluation && (evaluation.interviewItems.length || evaluation.interviewPrep.trim()),
  );
  const prepChecklist = evaluation
    ? buildPrepChecklist({
        gaps: evaluation.gapItems,
        interviewItems: evaluation.interviewItems,
        keywords: evaluation.keywords,
      })
    : [];
  const prepSummary = evaluation ? splitInterviewSummary(evaluation.interviewPrep) : [];
  const matchedReportParagraphs = prepWorkspace.matchedReport
    ? renderIntelContent(prepWorkspace.matchedReport.content)
    : null;

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.head}>
        <p className={styles.breadcrumb}>
          <Link href="/pipeline">Pipeline</Link>
          {" // "}
          <Link href={`/pipeline/${opportunity.id}`}>Analysis Dossier</Link>
          {" // "}
          Interview Prep
        </p>

        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Interview workspace</p>
            <h1>
              {opportunity.company} · {opportunity.role}
            </h1>
            <p className={styles.subtitle}>
              Turn the report into a usable prep surface: what to rehearse, which stories map best,
              and where your weak spots will probably get tested.
            </p>
            <div className={styles.metaRow}>
              <span className={styles.pill}>{opportunity.status}</span>
              {typeof opportunity.score === "number" ? (
                <span className={styles.pill}>Score {(opportunity.score * 20).toFixed(0)}/100</span>
              ) : null}
              {evaluation?.detectedLevel ? <span className={styles.pill}>{evaluation.detectedLevel}</span> : null}
              {evaluation?.candidateLevel ? <span className={styles.pill}>You: {evaluation.candidateLevel}</span> : null}
            </div>
          </div>

          <div className={styles.heroActions}>
            <Link className={styles.btnPrimary} href={`/resumes?opportunity=${opportunity.id}`}>
              Tailor resume
            </Link>
            <Link className={styles.btnOutline} href={`/pipeline/${opportunity.id}`}>
              Open dossier
            </Link>
            {opportunity.jobUrl ? (
              <a
                className={styles.btnOutline}
                href={opportunity.jobUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open posting ↗
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {!evaluation ? (
        <section className={styles.emptyState}>
          <p className={styles.eyebrow}>No evaluation yet</p>
          <h2>This role does not have parsed report data to build prep from.</h2>
          <p>
            Once a report lands in <code>reports/</code>, this workspace will assemble the prep
            notes and story map here.
          </p>
        </section>
      ) : !hasPrep ? (
        <section className={styles.emptyState}>
          <p className={styles.eyebrow}>Prep signals missing</p>
          <h2>The evaluation exists, but there is no dedicated interview-prep section in it yet.</h2>
          <p>
            You can still use the dossier and resume tools for this role, but richer interview
            intelligence has not been generated for it yet.
          </p>
        </section>
      ) : (
        <div className={styles.layout}>
          <div className={styles.main}>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardLabel}>Prep overview</span>
                <span className={styles.cardTitle}>What the report suggests you should emphasize</span>
              </div>
              <div className={styles.cardBody}>
                {prepSummary.length ? (
                  prepSummary.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                ) : (
                  <p>{evaluation.interviewPrep}</p>
                )}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardLabel}>Company-specific intel</span>
                <span className={styles.cardTitle}>
                  {prepWorkspace.matchedReport ? prepWorkspace.matchedReport.title : "Research report not generated yet"}
                </span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.inlineActions}>
                  <div className={styles.inlineCopy}>
                    <p className={styles.inlineKicker}>Prep brief generator</p>
                    <p className={styles.inlineHint}>
                      Rebuilds this briefing from the parsed evaluation report and your current
                      story bank.
                    </p>
                  </div>
                  <GenerateInterviewIntelButton opportunityId={opportunity.id} />
                </div>
                {prepWorkspace.matchedReport ? (
                  <div className={styles.intelDocument}>{matchedReportParagraphs}</div>
                ) : (
                  <>
                    <p>
                      No company-specific interview intel report exists in <code>interview-prep/</code>
                      {" "}for this role yet.
                    </p>
                    <p>
                      Use <strong>Generate Fresh Intel</strong> to create one from the existing
                      evaluation report, then come back here to refine your story bank and rehearse
                      against the generated prompts.
                    </p>
                  </>
                )}
              </div>
            </section>

            {evaluation.interviewItems.length ? (
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardLabel}>Story map</span>
                  <span className={styles.cardTitle}>Which STAR stories already match likely requirements</span>
                </div>
                <div className={styles.storyGrid}>
                  {evaluation.interviewItems.map((item) => (
                    <article className={styles.storyCard} key={`${item.index}-${item.requirement}`}>
                      <p className={styles.storyRequirement}>{item.requirement || "Role signal"}</p>
                      <h3>{item.story || "Story still needs drafting"}</h3>
                      <dl className={styles.starGrid}>
                        <div>
                          <dt>S</dt>
                          <dd>{item.situation || "Not captured yet."}</dd>
                        </div>
                        <div>
                          <dt>T</dt>
                          <dd>{item.task || "Not captured yet."}</dd>
                        </div>
                        <div>
                          <dt>A</dt>
                          <dd>{item.action || "Not captured yet."}</dd>
                        </div>
                        <div>
                          <dt>R</dt>
                          <dd>{item.result || "Not captured yet."}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardLabel}>Rehearsal plan</span>
                <span className={styles.cardTitle}>Concrete prompts to work through before the interview</span>
              </div>
              <div className={styles.checklist}>
                {prepChecklist.length ? (
                  prepChecklist.map((item) => (
                    <label className={styles.checkItem} key={item}>
                      <input type="checkbox" />
                      <span>{item}</span>
                    </label>
                  ))
                ) : (
                  <p>No structured checklist could be derived yet.</p>
                )}
              </div>
            </section>

            <StoryBankEditor
              initialContent={prepWorkspace.storyBankContent}
              path={prepWorkspace.storyBankPath}
            />
          </div>

          <aside className={styles.rail}>
            <section className={styles.railCard}>
              <div className={styles.cardHead}>
                <span className={styles.cardLabel}>Pressure points</span>
                <span className={styles.cardTitle}>What could come up</span>
              </div>
              <div className={styles.railBody}>
                <div className={styles.statRow}>
                  <span>Stories mapped</span>
                  <strong>{evaluation.interviewItems.length}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>Gaps flagged</span>
                  <strong>{evaluation.gapItems.length}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>CV matches</span>
                  <strong>{evaluation.cvMatchItems.length}</strong>
                </div>
              </div>
            </section>

            {evaluation.gapItems.length ? (
              <section className={styles.railCard}>
                <div className={styles.cardHead}>
                  <span className={styles.cardLabel}>Risk areas</span>
                  <span className={styles.cardTitle}>Questions you should expect to navigate carefully</span>
                </div>
                <div className={styles.railBody}>
                  <ul className={styles.gapList}>
                    {evaluation.gapItems.map((gap) => (
                      <li key={`${gap.gap}-${gap.mitigation}`}>
                        <strong>{gap.gap}</strong>
                        <span>{gap.mitigation || "Prepare a forward-looking framing."}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}

            {evaluation.keywords.length ? (
              <section className={styles.railCard}>
                <div className={styles.cardHead}>
                  <span className={styles.cardLabel}>Keywords</span>
                  <span className={styles.cardTitle}>Vocabulary to keep active in answers</span>
                </div>
                <div className={styles.keywordList}>
                  {evaluation.keywords.map((keyword) => (
                    <span className={styles.keyword} key={keyword}>{keyword}</span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.railCard}>
              <div className={styles.cardHead}>
                <span className={styles.cardLabel}>Prep assets</span>
                <span className={styles.cardTitle}>{prepWorkspace.reports.length} report{prepWorkspace.reports.length === 1 ? "" : "s"}</span>
              </div>
              <div className={styles.railBody}>
                <div className={styles.statRow}>
                  <span>Story bank</span>
                  <strong>{prepWorkspace.storyBankContent.trim() ? "Ready" : "Empty"}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>Matched intel report</span>
                  <strong>{prepWorkspace.matchedReport ? "Found" : "Missing"}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>Available prep docs</span>
                  <strong>{prepWorkspace.reports.length}</strong>
                </div>
              </div>
            </section>
          </aside>
        </div>
      )}
    </article>
  );
}
