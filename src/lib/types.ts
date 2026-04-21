/**
 * Career-Ops UI — Shared Type Definitions
 * 
 * Core data types used across the application.
 * These mirror the data structures in the career-ops CLI system.
 */

/** Canonical statuses from templates/states.yml */
export type OpportunityStatus =
  | "Evaluated"
  | "Applied"
  | "Responded"
  | "Interview"
  | "Offer"
  | "Rejected"
  | "Discarded"
  | "SKIP"
  | "Unknown";

/** Canonical state definition from templates/states.yml */
export interface StateDefinition {
  id: string;
  label: OpportunityStatus;
  aliases: string[];
  description: string;
  dashboardGroup: string;
}

/** A tracked job opportunity from applications.md */
export interface Opportunity {
  /** Stable route id for the web UI */
  id: string;
  /** Sequential number (e.g., 1, 2, 3...) */
  num: number;
  /** Date evaluated (YYYY-MM-DD) */
  date: string;
  /** Company name */
  company: string;
  /** Job role / title */
  role: string;
  /** Numeric score (1.0 - 5.0) */
  score: number | null;
  /** Original score text from tracker */
  scoreRaw: string;
  /** Canonical status from states.yml */
  status: OpportunityStatus;
  /** Raw status text from tracker */
  statusRaw: string;
  /** Whether a PDF was generated */
  hasPdf: boolean;
  /** Relative path to the evaluation report */
  reportPath: string | null;
  /** Report number from markdown link */
  reportNumber: string | null;
  /** Free-text notes */
  notes: string;
  /** Original job posting URL if available */
  jobUrl: string | null;
  /** Enriched archetype from report */
  archetype: string | null;
  /** Enriched one-line summary from report */
  summary: string | null;
  /** Enriched remote/location signal from report */
  remote: string | null;
  /** Enriched compensation estimate from report */
  compensation: string | null;
}

/** Letter grade derived from numeric score */
export type Grade = "A" | "B" | "C" | "D" | "F";

/** Evaluation dimension from the 10-dimension scoring model */
export interface DimensionScore {
  name: string;
  score: number;
  weight: "gate-pass" | "high" | "medium" | "low";
  summary: string;
}

export interface CvMatchItem {
  requirement: string;
  match: string;
  source: string;
}

export interface CompensationDatum {
  dataPoint: string;
  value: string;
  source: string;
}

export interface PersonalizationItem {
  index: string;
  section: string;
  current: string;
  proposedChange: string;
  why: string;
}

export interface InterviewPrepItem {
  index: string;
  requirement: string;
  story: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface EvaluationSection {
  heading: string;
  body: string;
}

/** Full evaluation report for an opportunity */
export interface Evaluation {
  /** The opportunity this evaluation belongs to */
  opportunityNum: number | null;
  /** Overall score */
  score: number;
  /** Letter grade */
  grade: Grade;
  /** Detected archetype (e.g., "AI Platform / LLMOps") */
  archetype: string;
  /** Brief summary */
  summary: string;
  /** Metadata date from the report header */
  date: string | null;
  /** Source URL from the report header */
  url: string | null;
  /** Generated PDF path from the report header */
  pdfPath: string | null;
  /** Batch id from the report header, when present */
  batchId: string | null;
  /** Role summary table */
  roleSummary: Record<string, string>;
  /** Per-dimension scores */
  dimensions: DimensionScore[];
  /** CV match items */
  cvMatchItems: CvMatchItem[];
  /** Gap items with severity */
  gapItems: Array<{
    gap: string;
    severity: "critical" | "moderate" | "minor";
    mitigation: string;
  }>;
  /** Seniority positioning strategy */
  seniorityStrategy: string;
  /** Detected level from the report */
  detectedLevel: string | null;
  /** Candidate natural level from the report */
  candidateLevel: string | null;
  /** Compensation analysis */
  compensationAnalysis: string;
  /** Compensation data table */
  compensationItems: CompensationDatum[];
  /** Personalization notes */
  personalizationNotes: string;
  /** Personalization plan table */
  personalizationItems: PersonalizationItem[];
  /** Interview prep content */
  interviewPrep: string;
  /** Interview plan table */
  interviewItems: InterviewPrepItem[];
  /** Extracted keywords */
  keywords: string[];
  /** When the evaluation was generated */
  generatedAt: string;
  /** Ordered report sections as parsed from the source markdown */
  sections: EvaluationSection[];
}

/** User profile from config/profile.yml */
export interface UserProfile {
  candidate: {
    fullName: string;
    email: string;
    phone?: string;
    location: string;
    linkedin?: string;
    portfolioUrl?: string;
    github?: string;
    twitter?: string;
    canvaResumeDesignId?: string;
  };
  targetRoles: {
    primary: string[];
    archetypes: Array<{
      name: string;
      level: string;
      fit: "primary" | "secondary" | "adjacent";
      track?: string;
      sellWhen?: string;
    }>;
  };
  narrative: {
    headline: string;
    exitStory: string;
    superpowers: string[];
    proofPoints: Array<{
      name: string;
      url: string;
      heroMetric: string;
      track?: string;
    }>;
  };
  compensation: {
    targetRange: string;
    currency: string;
    minimum: string;
    locationFlexibility?: string;
    alternateRanges?: Array<{
      track: string;
      targetRange: string;
      minimum: string;
      note?: string;
    }>;
  };
  location: {
    country: string;
    city: string;
    timezone: string;
    visaStatus?: string;
    onsiteAvailability?: string;
  };
}

/** Dashboard statistics */
export interface DashboardStats {
  totalEvaluated: number;
  newThisWeek: number;
  averageScore: number | null;
  statusCounts: Record<OpportunityStatus, number>;
  topScoring: Opportunity[];
  followUpsDue: Opportunity[];
  reportCount: number;
  profileReady: boolean;
}

/** Derive letter grade from numeric score */
export function scoreToGrade(score: number): Grade {
  if (score >= 4.5) return "A";
  if (score >= 4.0) return "B";
  if (score >= 3.0) return "C";
  if (score >= 2.0) return "D";
  return "F";
}
