"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type { ResumeSource, SystemCheckId, SystemCheckResult, UserProfile } from "@/lib/types";

import {
  AccountSection,
  AIWorkerSection,
  ArchetypesSection,
  CompensationSection,
  PositioningSection,
  ProofPointsSection,
  ReadinessSection,
  ResumesSection,
  ScannerSection,
  SystemChecksSection,
} from "./SettingsSections";
import { Btn } from "./SettingsPrimitives";
import shellStyles from "./SettingsShell.module.css";

export interface ReadinessSnapshot {
  profileReady: boolean;
  resumeReady: boolean;
  resumeSourceCount: number;
  trackerReady: boolean;
  reportsReady: boolean;
  cvReady: boolean;
  pendingQueue: number;
  trackedRoles: number;
  reportCount: number;
  workspacePath: string;
}

export interface SettingsAccount {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  timezone: string;
  visa: string;
  linkedin: string;
  github: string;
  portfolio: string;
  onsite: string;
}

export interface PositioningState {
  targetRoles: string[];
  targetGeos: string[];
  headline: string;
  narrative: string;
  strengths: string;
  excites: string;
  drains: string;
  dealbreakers: string;
  achievement: string;
}

export interface ArchetypeRow {
  name: string;
  level: string;
  fit: "primary" | "secondary" | "adjacent";
  track: string;
  sellWhen: string;
}

export interface ProofRow {
  name: string;
  url: string;
  heroMetric: string;
  track: string;
  notes: string;
}

export interface CompensationState {
  compMin: string;
  compMax: string;
  minimum: string;
  currency: string;
  remote: string;
  relocation: string;
  locations: string[];
  locationFlexibility: string;
  country: string;
  city: string;
}

export interface ScannerState {
  positiveKeywords: string[];
  negativeKeywords: string[];
  seniorityKeywords: string[];
  searchQueries: string[];
  companies: Array<{ name: string; url: string; enabled: boolean; notes: string }>;
}

const NAV_SECTIONS = [
  { id: "sec-readiness", label: "Setup Readiness" },
  { id: "sec-account", label: "Account & Identity" },
  { id: "sec-positioning", label: "Career Positioning" },
  { id: "sec-archetypes", label: "Role Archetypes" },
  { id: "sec-resumes", label: "Resume Sources" },
  { id: "sec-proof", label: "Proof Points" },
  { id: "sec-comp", label: "Compensation & Location" },
  { id: "sec-scanner", label: "Scanner Config" },
  { id: "sec-ai", label: "AI & Worker" },
  { id: "sec-checks", label: "System Checks" },
] as const;

interface SettingsShellProps {
  hasExistingProfile: boolean;
  initialProfile: UserProfile;
  readiness: ReadinessSnapshot;
}

function profileToAccount(profile: UserProfile): SettingsAccount {
  return {
    fullName: profile.candidate.fullName,
    email: profile.candidate.email,
    phone: profile.candidate.phone ?? "",
    location: profile.candidate.location,
    timezone: profile.location.timezone,
    visa: profile.location.visaStatus ?? "",
    linkedin: profile.candidate.linkedin ?? "",
    github: profile.candidate.github ?? "",
    portfolio: profile.candidate.portfolioUrl ?? "",
    onsite: profile.location.onsiteAvailability ?? "",
  };
}

function profileToPositioning(profile: UserProfile): PositioningState {
  return {
    targetRoles: [...profile.targetRoles.primary],
    targetGeos: [],
    headline: profile.narrative.headline,
    narrative: profile.narrative.exitStory,
    strengths: profile.narrative.superpowers.join(", "),
    excites: "",
    drains: "",
    dealbreakers: "",
    achievement: "",
  };
}

function profileToArchetypes(profile: UserProfile): ArchetypeRow[] {
  return profile.targetRoles.archetypes.map((entry) => ({
    name: entry.name,
    level: entry.level || "Senior",
    fit: entry.fit,
    track: entry.track ?? "Engineering",
    sellWhen: entry.sellWhen ?? "",
  }));
}

function profileToProofPoints(profile: UserProfile): ProofRow[] {
  return profile.narrative.proofPoints.map((entry) => ({
    name: entry.name,
    url: entry.url,
    heroMetric: entry.heroMetric,
    track: entry.track ?? "",
    notes: "",
  }));
}

function profileToCompensation(profile: UserProfile): CompensationState {
  const [compMin = "", compMax = ""] = profile.compensation.targetRange
    .split(/\s*[-–—]\s*/)
    .map((s) => s.trim());
  return {
    compMin,
    compMax,
    minimum: profile.compensation.minimum,
    currency: profile.compensation.currency,
    remote: "",
    relocation: "",
    locations: [],
    locationFlexibility: profile.compensation.locationFlexibility ?? "",
    country: profile.location.country,
    city: profile.location.city,
  };
}

function profileToResumes(profile: UserProfile): ResumeSource[] {
  return (profile.resumeSources ?? []).map((source) => ({
    ...source,
    targetRoles: [...source.targetRoles],
  }));
}

const DEFAULT_SCANNER: ScannerState = {
  positiveKeywords: [],
  negativeKeywords: [],
  seniorityKeywords: [],
  searchQueries: [],
  companies: [],
};

interface FormSnapshot {
  account: SettingsAccount;
  positioning: PositioningState;
  archetypes: ArchetypeRow[];
  resumes: ResumeSource[];
  proofPoints: ProofRow[];
  compensation: CompensationState;
  scanner: ScannerState;
}

function buildSnapshot(profile: UserProfile, scanner: ScannerState): FormSnapshot {
  return {
    account: profileToAccount(profile),
    positioning: profileToPositioning(profile),
    archetypes: profileToArchetypes(profile),
    resumes: profileToResumes(profile),
    proofPoints: profileToProofPoints(profile),
    compensation: profileToCompensation(profile),
    scanner,
  };
}

function ensureDefaultResumeSource(sources: ResumeSource[]): ResumeSource[] {
  if (sources.length === 0) return [];
  if (sources.some((source) => source.default)) return sources;
  return sources.map((source, index) => ({ ...source, default: index === 0 }));
}

export default function SettingsShell({
  hasExistingProfile,
  initialProfile,
  readiness,
}: SettingsShellProps) {
  const router = useRouter();
  const notify = useToast();

  const [scanner, setScanner] = useState<ScannerState>(DEFAULT_SCANNER);
  const [account, setAccount] = useState<SettingsAccount>(() => profileToAccount(initialProfile));
  const [positioning, setPositioning] = useState<PositioningState>(() =>
    profileToPositioning(initialProfile),
  );
  const [archetypes, setArchetypes] = useState<ArchetypeRow[]>(() =>
    profileToArchetypes(initialProfile),
  );
  const [resumes, setResumes] = useState<ResumeSource[]>(() => profileToResumes(initialProfile));
  const [proofPoints, setProofPoints] = useState<ProofRow[]>(() =>
    profileToProofPoints(initialProfile),
  );
  const [compensation, setCompensation] = useState<CompensationState>(() =>
    profileToCompensation(initialProfile),
  );

  const [activeSection, setActiveSection] = useState<string>(NAV_SECTIONS[0].id);
  const [saving, setSaving] = useState(false);

  const initialSnapshot = useMemo<FormSnapshot>(
    () => buildSnapshot(initialProfile, DEFAULT_SCANNER),
    [initialProfile],
  );

  const currentSnapshot = useMemo<FormSnapshot>(
    () => ({ account, positioning, archetypes, resumes, proofPoints, compensation, scanner }),
    [account, positioning, archetypes, resumes, proofPoints, compensation, scanner],
  );

  const dirty = JSON.stringify(currentSnapshot) !== JSON.stringify(initialSnapshot);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Scroll spy
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach((node) => {
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  const registerSection = useCallback((id: string, node: HTMLElement | null) => {
    sectionRefs.current[id] = node;
  }, []);

  const scrollTo = (id: string) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const discard = () => {
    setAccount(profileToAccount(initialProfile));
    setPositioning(profileToPositioning(initialProfile));
    setArchetypes(profileToArchetypes(initialProfile));
    setResumes(profileToResumes(initialProfile));
    setProofPoints(profileToProofPoints(initialProfile));
    setCompensation(profileToCompensation(initialProfile));
    setScanner(DEFAULT_SCANNER);
    notify({
      title: "Changes discarded",
      description: "Form values reverted to last saved settings.",
      tone: "neutral",
      dismissAfter: 3000,
    });
  };

  const save = async () => {
    setSaving(true);
    const next: UserProfile = {
      ...initialProfile,
      candidate: {
        ...initialProfile.candidate,
        fullName: account.fullName.trim(),
        email: account.email.trim(),
        phone: account.phone.trim() || undefined,
        location: account.location.trim(),
        linkedin: account.linkedin.trim() || undefined,
        github: account.github.trim() || undefined,
        portfolioUrl: account.portfolio.trim() || undefined,
      },
      targetRoles: {
        primary: positioning.targetRoles.map((entry) => entry.trim()).filter(Boolean),
        archetypes: archetypes
          .filter((row) => row.name.trim())
          .map((row) => ({
            name: row.name.trim(),
            level: row.level.trim(),
            fit: row.fit,
            track: row.track.trim() || undefined,
            sellWhen: row.sellWhen.trim() || undefined,
          })),
      },
      narrative: {
        headline: positioning.headline.trim(),
        exitStory: positioning.narrative.trim(),
        superpowers: positioning.strengths
          .split(/[\n,]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
        proofPoints: proofPoints
          .filter((row) => row.name.trim())
          .map((row) => ({
            name: row.name.trim(),
            url: row.url.trim(),
            heroMetric: row.heroMetric.trim(),
            track: row.track.trim() || undefined,
          })),
      },
      compensation: {
        ...initialProfile.compensation,
        targetRange: [compensation.compMin.trim(), compensation.compMax.trim()]
          .filter(Boolean)
          .join(" – "),
        currency: compensation.currency.trim(),
        minimum: compensation.minimum.trim(),
        locationFlexibility: compensation.locationFlexibility.trim() || undefined,
      },
      location: {
        ...initialProfile.location,
        country: compensation.country.trim(),
        city: compensation.city.trim(),
        timezone: account.timezone.trim(),
        visaStatus: account.visa.trim() || undefined,
        onsiteAvailability: account.onsite.trim() || undefined,
      },
      resumeSources: ensureDefaultResumeSource(
        resumes
          .map((source, index) => ({
            id: source.id.trim() || `resume-${index + 1}`,
            label: source.label.trim() || `Resume ${index + 1}`,
            path: source.path.trim(),
            default: Boolean(source.default),
            targetRoles: source.targetRoles.map((role) => role.trim()).filter(Boolean),
          }))
          .filter((source) => source.path),
      ),
    };

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: next }),
      });
      const data = (await response.json()) as { error?: string; profile?: UserProfile };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save profile.");
      }
      notify({
        title: hasExistingProfile ? "Settings saved" : "Settings created",
        description: "Your Career-Ops profile has been updated.",
        dismissAfter: 4000,
      });
      router.refresh();
    } catch (error) {
      notify({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save settings.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setSaving(false);
    }
  };

  const runSystemCheck = async (checkId: SystemCheckId) => {
    const response = await fetch("/api/system/checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkId }),
    });
    const data = (await response.json()) as SystemCheckResult & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Unable to run the backend check.");
    }
    return data;
  };

  return (
    <>
      <div className={shellStyles.layout}>
        <nav className={shellStyles.sidebar} aria-label="Settings sections">
          <span className={shellStyles.sidebarLabel}>Settings</span>
          {NAV_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              data-active={activeSection === section.id}
              className={shellStyles.navItem}
              onClick={() => scrollTo(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <main className={shellStyles.main}>
          <div className={shellStyles.pageHead}>
            <span className={shellStyles.eyebrow}>Configuration</span>
            <h1>Settings</h1>
            <p>
              Configure your profile, career positioning, and system behaviour. Changes take effect
              on next save.
            </p>
          </div>

          <ReadinessSection
            id="sec-readiness"
            registerRef={(node) => registerSection("sec-readiness", node)}
            readiness={readiness}
          />

          <AccountSection
            id="sec-account"
            registerRef={(node) => registerSection("sec-account", node)}
            value={account}
            onChange={setAccount}
          />

          <PositioningSection
            id="sec-positioning"
            registerRef={(node) => registerSection("sec-positioning", node)}
            value={positioning}
            onChange={setPositioning}
          />

          <ArchetypesSection
            id="sec-archetypes"
            registerRef={(node) => registerSection("sec-archetypes", node)}
            value={archetypes}
            onChange={setArchetypes}
          />

          <ResumesSection
            id="sec-resumes"
            registerRef={(node) => registerSection("sec-resumes", node)}
            value={resumes}
            onChange={setResumes}
          />

          <ProofPointsSection
            id="sec-proof"
            registerRef={(node) => registerSection("sec-proof", node)}
            value={proofPoints}
            onChange={setProofPoints}
          />

          <CompensationSection
            id="sec-comp"
            registerRef={(node) => registerSection("sec-comp", node)}
            value={compensation}
            onChange={setCompensation}
          />

          <ScannerSection
            id="sec-scanner"
            registerRef={(node) => registerSection("sec-scanner", node)}
            value={scanner}
            onChange={setScanner}
          />

          <AIWorkerSection
            id="sec-ai"
            registerRef={(node) => registerSection("sec-ai", node)}
            workspacePath={readiness.workspacePath}
          />

          <SystemChecksSection
            id="sec-checks"
            registerRef={(node) => registerSection("sec-checks", node)}
            runCheck={runSystemCheck}
          />
        </main>
      </div>

      {(dirty || saving) ? (
        <div className={shellStyles.saveBar} role="status" aria-live="polite">
          <span className={shellStyles.saveBarMessage}>
            <span className={shellStyles.saveBarDot} aria-hidden />
            You have unsaved changes
          </span>
          <Btn variant="ghost" size="sm" onClick={discard} disabled={saving}>
            Discard
          </Btn>
          <Btn variant="accent" size="sm" loading={saving} onClick={save}>
            Save settings
          </Btn>
        </div>
      ) : null}
    </>
  );
}
