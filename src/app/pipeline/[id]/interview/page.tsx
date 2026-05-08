import Link from "next/link";
import { notFound } from "next/navigation";

import GenerateInterviewIntelButton from "@/components/interview/GenerateInterviewIntelButton";
import InterviewIntelDocument from "@/components/interview/InterviewIntelDocument";
import StoryBankEditor from "@/components/interview/StoryBankEditor";
import { getInterviewPrepWorkspace, getOpportunity } from "@/lib/api/career-ops";
import {
  extractBriefConcerns,
  extractBriefQuestionGroups,
  extractBriefRounds,
  type BriefConcern,
  type BriefQuestionGroup,
  type BriefRound,
} from "@/lib/intel/brief-parser";
import type {
  OpportunityIntelQuestion,
  OpportunityIntelRound,
} from "@/lib/types";

import styles from "./page.module.css";

const STAGES = ["Evaluated", "Applied", "Responded", "Interview", "Offer", "Rejected"];

function cleanText(value: string | null | undefined) {
  return (
    value
      ?.replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/\s*\[inferred from evaluation\]/gi, "")
      .replace(/\s*\[inferred\]/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || ""
  );
}

function isUseful(value: string | null | undefined) {
  const cleaned = cleanText(value);
  return Boolean(cleaned) && !/^(unknown|n\/a|none|null|unavailable|-+)$/i.test(cleaned);
}

function truncateText(value: string, maxLength = 180) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).replace(/\s+\S*$/, "")}...`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatFitScore(score: number | null | undefined) {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  return score.toFixed(1);
}

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

function buildStoryMap(input: {
  evaluation: NonNullable<Awaited<ReturnType<typeof getOpportunity>>["evaluation"]> | null;
  intel: Awaited<ReturnType<typeof getOpportunity>>["intel"] | null;
}) {
  if (input.intel?.interviewPrep.stories.length) {
    return input.intel.interviewPrep.stories
      .map((story, index) => ({
        action: cleanText(story.action),
        index: String(index + 1),
        requirement: cleanText(story.requirement) || "Role signal",
        result: cleanText(story.result),
        situation: cleanText(story.situation),
        story: cleanText(story.story) || "Story still needs drafting",
        task: cleanText(story.task),
      }))
      .filter((story) => isUseful(story.requirement) || isUseful(story.story));
  }

  return (
    input.evaluation?.interviewItems.map((item) => ({
      action: cleanText(item.action),
      index: item.index,
      requirement: cleanText(item.requirement) || "Role signal",
      result: cleanText(item.result),
      situation: cleanText(item.situation),
      story: cleanText(item.story) || "Story still needs drafting",
      task: cleanText(item.task),
    })) ?? []
  );
}

function buildConcerns(input: {
  evaluation: NonNullable<Awaited<ReturnType<typeof getOpportunity>>["evaluation"]> | null;
  intel: Awaited<ReturnType<typeof getOpportunity>>["intel"] | null;
  opportunityNotes: string | null | undefined;
}) {
  if (input.intel?.backgroundFraming.length) {
    return input.intel.backgroundFraming.map((frame, index) => ({
      body: cleanText(frame.concern) || cleanText(frame.likelyQuestion),
      mitigation: cleanText(frame.recommendedAnswer),
      number: `Concern ${pad2(index + 1)}`,
      title: cleanText(frame.likelyQuestion) || "Prepare concise framing",
    }));
  }

  if (input.evaluation?.gapItems.length) {
    return input.evaluation.gapItems.map((gap, index) => ({
      body: cleanText(gap.gap),
      mitigation: cleanText(gap.mitigation),
      number: `Concern ${pad2(index + 1)}`,
      title: "Prepare careful background framing",
    }));
  }

  return isUseful(input.opportunityNotes)
    ? [
        {
          body: cleanText(input.opportunityNotes),
          mitigation: "Turn this into a direct, practical answer before the interview.",
          number: "Concern 01",
          title: "Resolve tracker note before rehearsal",
        },
      ]
    : [];
}

function buildRounds(
  rounds: OpportunityIntelRound[] | undefined,
  briefRounds: BriefRound[] = [],
) {
  const source = rounds?.length ? rounds : briefRounds;
  if (!source.length) return [];
  return source
    .map((round) => ({
      duration: cleanText(round.duration),
      focus: cleanText(round.focus),
      prepare: cleanText(round.prepare),
      title: cleanText(round.title) || "Interview round",
    }))
    .filter((round) => isUseful(round.title) || isUseful(round.focus));
}

interface QuestionCard {
  angle: string;
  prompt: string;
  reason: string;
  type: string;
}

function buildQuestionGroups(
  questions: OpportunityIntelQuestion[] | undefined,
  briefGroups: BriefQuestionGroup[] = [],
): Array<{ title: string; cards: QuestionCard[] }> {
  if (questions?.length) {
    const normalized: QuestionCard[] = questions.map((question) => ({
      angle: cleanText(question.angle),
      prompt: cleanText(question.prompt),
      reason: cleanText(question.reason),
      type: cleanText(question.type) || "General",
    }));

    const groupOrder: string[] = [];
    const grouped = new Map<string, QuestionCard[]>();

    for (const card of normalized) {
      if (!isUseful(card.prompt)) continue;
      const key = card.type || "General";
      if (!grouped.has(key)) {
        grouped.set(key, []);
        groupOrder.push(key);
      }
      grouped.get(key)!.push(card);
    }

    return groupOrder.map((title) => ({ cards: grouped.get(title) ?? [], title }));
  }

  return briefGroups
    .map((group) => ({
      title: group.title || "General",
      cards: group.cards
        .map((card) => ({
          angle: cleanText(card.angle),
          prompt: cleanText(card.prompt),
          reason: cleanText(card.reason),
          type: group.title || "General",
        }))
        .filter((card) => isUseful(card.prompt)),
    }))
    .filter((group) => group.cards.length > 0);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^-{3,}$/gm, "")
    .trim();
}

function splitInterviewSummary(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => stripMarkdown(paragraph))
    .filter((paragraph) => paragraph && !/^\s*\|.+\|\s*$/m.test(paragraph));
}

function sanitizeInterviewBriefContent(value: string) {
  return value
    .replace(/\s*Any question marked `?\[inferred from evaluation\]`?.+?\n\n/gi, "\n\n")
    .replace(/\s*\[inferred from evaluation\]/gi, "")
    .replace(/\s*\[inferred from JD\]/gi, "")
    .replace(/\s*\[inferred\]/gi, "")
    .replace(/^- No strong prompts could be derived for this category yet\.\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default async function OpportunityInterviewPrepPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { opportunity, evaluation, intel } = await getOpportunity(id);

  if (!opportunity) notFound();

  const prepWorkspace = await getInterviewPrepWorkspace({
    company: opportunity.company,
    role: opportunity.role,
  });

  const rawBrief = prepWorkspace.matchedReport?.content ?? null;
  const briefRounds = rawBrief ? extractBriefRounds(rawBrief) : [];
  const briefQuestionGroups = rawBrief ? extractBriefQuestionGroups(rawBrief) : [];
  const briefConcerns: BriefConcern[] = rawBrief ? extractBriefConcerns(rawBrief) : [];

  const rounds = buildRounds(intel?.interviewPrep.rounds, briefRounds);
  const questionGroups = buildQuestionGroups(
    intel?.interviewPrep.likelyQuestions,
    briefQuestionGroups,
  );

  const hasPrep = Boolean(
    evaluation &&
      (evaluation.interviewItems.length ||
        intel?.interviewPrep.checklist.length ||
        intel?.interviewPrep.likelyQuestions.length ||
        intel?.interviewPrep.rounds.length ||
        prepWorkspace.matchedReport?.content),
  );
  const prepChecklist = intel?.interviewPrep.checklist.length
    ? intel.interviewPrep.checklist.map(cleanText).filter(Boolean).slice(0, 10)
    : evaluation
    ? buildPrepChecklist({
        gaps: evaluation.gapItems,
        interviewItems: evaluation.interviewItems,
        keywords: evaluation.keywords,
      })
    : [];
  const prepSummary =
    evaluation && evaluation.interviewItems.length
      ? splitInterviewSummary(evaluation.interviewPrep)
      : [];
  const matchedReportContent = prepWorkspace.matchedReport?.content
    ? sanitizeInterviewBriefContent(prepWorkspace.matchedReport.content)
    : null;
  const stories = buildStoryMap({ evaluation, intel });
  let concerns = buildConcerns({ evaluation, intel, opportunityNotes: opportunity.notes });
  if (!concerns.length && briefConcerns.length) {
    concerns = briefConcerns.map((concern, index) => ({
      body: cleanText(concern.concern),
      mitigation: cleanText(concern.framing),
      number: `Concern ${pad2(index + 1)}`,
      title: "Prepare careful background framing",
    }));
  }
  const questionCount =
    questionGroups.reduce((sum, group) => sum + group.cards.length, 0) ||
    (intel?.interviewPrep.likelyQuestions.length ?? 0);
  const roundCount = rounds.length || (intel?.interviewPrep.rounds.length ?? 0);
  const activeKeywords = intel?.interviewPrep.vocabulary.length
    ? intel.interviewPrep.vocabulary
    : evaluation?.keywords ?? [];
  const fitScore = formatFitScore(opportunity.score);
  const briefExcludeTitles: string[] = [];
  if (rounds.length) {
    briefExcludeTitles.push("Expected Interview Shape", "Round-by-round focus");
  }
  if (questionGroups.length) {
    briefExcludeTitles.push("Likely Questions");
  }
  if (concerns.length) {
    briefExcludeTitles.push("Background Framing", "Red Flag Framing");
  }
  if (stories.length) {
    briefExcludeTitles.push("Story Bank Mapping", "Evaluation Story Map");
  }
  if (prepChecklist.length) {
    briefExcludeTitles.push("Technical Prep Checklist", "Prep Checklist");
  }

  return (
    <article className={`app-page ${styles.page}`}>
      <header className={styles.head}>
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <Link href="/pipeline">Pipeline</Link>
              {" // "}
              <Link href={`/pipeline/${opportunity.id}`}>Analysis Dossier</Link>
              {" // "}
              Interview Prep
            </p>
            <h1>
              {opportunity.company} · {opportunity.role}
            </h1>
            <p className={styles.subtitle}>
              Turn the report into a usable prep surface: what to rehearse, which stories map best,
              and where your weak spots will probably get tested.
            </p>
          </div>

          <div className={styles.heroActions}>
            <Link className={styles.btnPrimary} href={`/resumes?opportunity=${opportunity.id}`}>
              Tailor Resume
            </Link>
            <Link className={styles.btnOutline} href={`/pipeline/${opportunity.id}`}>
              Open Dossier
            </Link>
            {opportunity.jobUrl ? (
              <a
                className={styles.btnOutline}
                href={opportunity.jobUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open Posting ↗
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <div className={styles.statusGroup}>
        <div className={styles.statusBadgeRow}>
          <span className={styles.statusPill} data-tone="accent">
            {opportunity.status}
          </span>
          {fitScore ? <span className={styles.scoreTag}>Score {fitScore}/5</span> : null}
          {intel?.roleSnapshot.workMode ? (
            <span className={styles.metaTag}>{intel.roleSnapshot.workMode}</span>
          ) : null}
          {intel?.roleSnapshot.archetype ? (
            <span className={styles.metaTag}>{truncateText(intel.roleSnapshot.archetype, 48)}</span>
          ) : null}
        </div>

        <div className={styles.stageStrip} aria-label="Application stage">
          {STAGES.map((stage, index) => (
            <div className={styles.stageStep} key={stage}>
              <span data-active={opportunity.status === stage}>{stage}</span>
              {index < STAGES.length - 1 ? <b aria-hidden="true">›</b> : null}
            </div>
          ))}
        </div>
      </div>

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
            <section className={`${styles.card} ${styles.overviewCard}`}>
              <div className={styles.overviewHead}>
                <span className={styles.cardLabel}>Prep Overview</span>
                {fitScore ? (
                  <span className={styles.overviewScore}>
                    <span className={styles.overviewScoreValue}>{fitScore}</span>
                    <span className={styles.overviewScoreUnit}>/5</span>
                  </span>
                ) : null}
              </div>
              <p className={styles.overviewLead}>
                What the report suggests you should emphasize
              </p>
              <div className={styles.overviewBody}>
                {prepSummary.length ? (
                  prepSummary.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                ) : intel?.recommendation.summary ? (
                  <p>{intel.recommendation.summary}</p>
                ) : (
                  <p>
                    Use the generated brief to rehearse likely questions, map stories, and resolve
                    background concerns.
                  </p>
                )}
              </div>
            </section>

            {rounds.length ? (
              <section className={styles.sectionGroup}>
                <h3 className={styles.sectionHeading}>Expected Interview Shape</h3>
                <div className={styles.roundsGrid}>
                  {rounds.map((round, index) => (
                    <article className={styles.roundCard} key={`${round.title}-${index}`}>
                      <div className={styles.roundCardHead}>
                        <span className={styles.roundIndex}>Round {pad2(index + 1)}</span>
                        {round.duration ? (
                          <span className={styles.roundDuration}>{round.duration}</span>
                        ) : null}
                      </div>
                      <p className={styles.roundTitle}>{round.title}</p>
                      {round.focus ? <p className={styles.roundBody}>{round.focus}</p> : null}
                      {round.prepare ? (
                        <p className={styles.roundPrepare}>
                          <span>How to prepare</span>
                          {round.prepare}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {questionGroups.length ? (
              <section className={styles.sectionGroup}>
                <h3 className={styles.sectionHeading}>Likely Questions</h3>
                <div className={styles.questionStack}>
                  {questionGroups
                    .flatMap((group) => group.cards.map((card) => ({ card, group: group.title })))
                    .map(({ card, group }, globalIndex) => (
                      <article
                        className={styles.questionCard}
                        key={`${group}-${card.prompt}-${globalIndex}`}
                      >
                        <div className={styles.questionCardHead}>
                          <span className={styles.questionCategory}>{group}</span>
                          <span className={styles.questionId}>Q_{pad2(globalIndex + 1)}</span>
                        </div>
                        <p className={styles.questionPrompt}>{card.prompt}</p>
                        {card.reason || card.angle ? (
                          <div className={styles.questionMetaGrid}>
                            {card.reason ? (
                              <div className={styles.questionMetaBlock}>
                                <span className={styles.questionMetaKey}>Why this is likely</span>
                                <p className={styles.questionMetaValue}>{card.reason}</p>
                              </div>
                            ) : null}
                            {card.angle ? (
                              <div className={styles.questionMetaBlock}>
                                <span className={styles.questionMetaKey}>Best angle</span>
                                <p className={styles.questionMetaValue}>{card.angle}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    ))}
                </div>
              </section>
            ) : null}

            {concerns.length ? (
              <section className={styles.sectionGroup}>
                <h3 className={styles.sectionHeading}>Background Framing</h3>
                <div className={styles.concernList}>
                  {concerns.map((concern) => (
                    <article className={styles.concernCard} key={`${concern.number}-${concern.body}`}>
                      <div className={styles.concernCardHead}>
                        <span className={styles.concernNumber}>{concern.number}</span>
                        <svg
                          aria-hidden="true"
                          className={styles.concernIcon}
                          fill="none"
                          height="15"
                          viewBox="0 0 16 16"
                          width="15"
                        >
                          <path
                            d="M8 1.5L1.5 13.5h13L8 1.5z"
                            stroke="currentColor"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M8 6v3.5M8 11.25v.5"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </div>
                      <strong className={styles.concernTitle}>{concern.title}</strong>
                      <p className={styles.concernBody}>{concern.body}</p>
                      {concern.mitigation ? (
                        <div className={styles.concernMitigation}>
                          <span className={styles.concernMitLabel}>Mitigation</span>
                          <p>{concern.mitigation}</p>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {stories.length ? (
              <section className={styles.sectionGroup}>
                <h3 className={styles.sectionHeading}>Story Map</h3>
                <p className={styles.sectionLede}>
                  Which STAR stories already match likely requirements.
                </p>
                <div className={styles.storyGrid}>
                  {stories.map((item) => (
                    <article className={styles.storyCard} key={`${item.index}-${item.requirement}`}>
                      <p className={styles.storyRequirement}>{item.requirement || "Role signal"}</p>
                      <h4 className={styles.storyTitle}>{item.story || "Story still needs drafting"}</h4>
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

            {prepChecklist.length ? (
              <section className={styles.sectionGroup}>
                <h3 className={styles.sectionHeading}>Rehearsal Plan</h3>
                <p className={styles.sectionLede}>
                  Concrete prompts to work through before the interview.
                </p>
                <div className={styles.checklist}>
                  {prepChecklist.map((item) => (
                    <label className={styles.checkItem} key={item}>
                      <input type="checkbox" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {matchedReportContent ? (
              <section className={styles.sectionGroup}>
                <h3 className={styles.sectionHeading}>Additional Context</h3>
                <p className={styles.sectionLede}>
                  Process notes, company signals, and questions to ask — pulled from the matched
                  report in <code>interview-prep/</code>.
                </p>
                <div className={styles.briefSurface}>
                  <InterviewIntelDocument
                    content={matchedReportContent}
                    excludeSectionTitles={briefExcludeTitles}
                  />
                </div>
              </section>
            ) : null}

            <StoryBankEditor
              initialContent={prepWorkspace.storyBankContent}
              path={prepWorkspace.storyBankPath}
            />
          </div>

          <aside className={styles.rail}>
            <section className={`${styles.railCard} ${styles.railLeadCard}`}>
              <div className={styles.railCardHead}>
                <span className={styles.railLabel}>Pressure Map</span>
                <h2 className={styles.railTitle}>What the conversation is likely to probe.</h2>
                <p className={styles.railLead}>
                  Use this side rail like field notes while you rehearse through the generated
                  brief.
                </p>
              </div>
              <div className={styles.railMetricGrid}>
                <div className={styles.railMetricCard}>
                  <span className={styles.railMetricValue}>{stories.length}</span>
                  <span className={styles.railMetricLabel}>Stories already mapped</span>
                </div>
                <div className={styles.railMetricCard}>
                  <span className={styles.railMetricValue}>{concerns.length}</span>
                  <span className={styles.railMetricLabel}>Risk areas to frame carefully</span>
                </div>
                <div className={styles.railMetricCard}>
                  <span className={styles.railMetricValue}>
                    {questionCount || roundCount || evaluation.cvMatchItems.length}
                  </span>
                  <span className={styles.railMetricLabel}>
                    {questionCount
                      ? "Likely questions normalized"
                      : roundCount
                      ? "Rounds outlined"
                      : "Resume-to-posting matches surfaced"}
                  </span>
                </div>
              </div>
            </section>

            {activeKeywords.length ? (
              <section className={styles.railCard}>
                <div className={styles.railCardHead}>
                  <span className={styles.railLabel}>Vocabulary</span>
                  <h2 className={styles.railTitle}>Terms worth keeping active in your answers.</h2>
                  <p className={styles.railSupport}>
                    Keep these words close to the surface so your examples sound native to the role
                    rather than translated after the fact.
                  </p>
                </div>
                <div className={styles.railKeywordList}>
                  {activeKeywords.map((keyword) => (
                    <span className={styles.keyword} key={keyword}>
                      {keyword}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.railCard}>
              <div className={styles.railCardHead}>
                <span className={styles.railLabel}>Prep Assets</span>
                <p className={styles.railSupport}>
                  {prepWorkspace.reports.length} report
                  {prepWorkspace.reports.length === 1 ? "" : "s"} currently supporting this prep
                  workspace.
                </p>
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

            <GenerateInterviewIntelButton opportunityId={opportunity.id} />
          </aside>
        </div>
      )}
    </article>
  );
}
