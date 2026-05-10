"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  Btn,
  CmdLabel,
  Container,
  Field,
  Input,
  Wordmark,
} from "@/components/public/primitives";
import publicStyles from "@/components/public/public.module.css";

// ─── Types & constants ───────────────────────────────────────────────────

type StepKey =
  | "welcome"
  | "identity"
  | "targets"
  | "positioning"
  | "sources"
  | "proofs"
  | "preferences"
  | "review";

interface Step {
  key: StepKey;
  label: string;
  short: string;
  code: string;
}

const STEPS: Step[] = [
  { key: "welcome", label: "Setup overview", short: "Overview", code: "overview" },
  { key: "identity", label: "Identity", short: "Identity", code: "identity" },
  { key: "targets", label: "Role targets", short: "Targets", code: "role-targets" },
  { key: "positioning", label: "Positioning", short: "Positioning", code: "positioning" },
  { key: "sources", label: "Resume sources", short: "Resumes", code: "resume-sources" },
  { key: "proofs", label: "Proof points", short: "Proofs", code: "proof-points" },
  { key: "preferences", label: "Search preferences", short: "Prefs", code: "search-preferences" },
  { key: "review", label: "Review & finish", short: "Review", code: "review" },
];

const SKIPPABLE: StepKey[] = ["positioning", "proofs", "preferences"];

interface OnboardingData {
  identity: {
    name: string;
    email: string;
    phone: string;
    city: string;
    linkedin: string;
    github: string;
    portfolio: string;
    other: string;
  };
  targets: {
    roles: string[];
    archetypes: string[];
    seniority: string;
    industries: string[];
    workStyle: string;
    locations: string[];
  };
  positioning: {
    headline: string;
    summary: string;
    strengths: string;
    transition: string;
  };
  sources: ResumeSource[];
  proofs: ProofPoint[];
  preferences: {
    targetComp: string;
    minComp: string;
    currency: string;
    flex: string;
    relocate: string;
    dealbreakers: string;
    positive: string;
    negative: string;
  };
}

interface ResumeSource {
  id: string;
  label: string;
  file: string;
  roles: string;
  isDefault: boolean;
  status: "parsed" | "parsing";
  evidence: number;
}

interface ProofPoint {
  id: string;
  name: string;
  url: string;
  track: string;
  metric: string;
  notes: string;
}

const DEFAULT_DATA: OnboardingData = {
  identity: {
    name: "",
    email: "",
    phone: "",
    city: "",
    linkedin: "",
    github: "",
    portfolio: "",
    other: "",
  },
  targets: {
    roles: [],
    archetypes: [],
    seniority: "",
    industries: [],
    workStyle: "remote",
    locations: [],
  },
  positioning: { headline: "", summary: "", strengths: "", transition: "" },
  sources: [],
  proofs: [],
  preferences: {
    targetComp: "",
    minComp: "",
    currency: "USD",
    flex: "remote-first",
    relocate: "open",
    dealbreakers: "",
    positive: "",
    negative: "",
  },
};

const STORAGE_KEY = "career-ops:onboarding";
const REGISTER_SEED_KEY = "career-ops:register-seed";

// ─── Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- hydration-time one-shot sync from localStorage */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { stepIdx?: number; data?: Partial<OnboardingData> };
        setStepIdx(typeof parsed.stepIdx === "number" ? Math.min(parsed.stepIdx, STEPS.length - 1) : 0);
        setData({ ...DEFAULT_DATA, ...parsed.data });
      } else {
        const seed = window.localStorage.getItem(REGISTER_SEED_KEY);
        if (seed) {
          const s = JSON.parse(seed) as { name?: string; email?: string; city?: string; role?: string };
          setData((d) => ({
            ...d,
            identity: { ...d.identity, name: s.name ?? "", email: s.email ?? "", city: s.city ?? "" },
            targets: { ...d.targets, roles: s.role ? [s.role] : [] },
          }));
        }
      }
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist on every change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ stepIdx, data }));
    } catch {
      // ignore
    }
  }, [stepIdx, data, hydrated]);

  const step = STEPS[stepIdx];
  const next = () => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  const prev = () => setStepIdx((i) => Math.max(0, i - 1));
  const jump = (i: number) => setStepIdx(i);

  function merge<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function finish() {
    try {
      window.localStorage.setItem(`${STORAGE_KEY}:completed`, "1");
    } catch {
      // ignore
    }
    router.push("/");
  }

  function saveAndExit() {
    router.push("/landing");
  }

  return (
    <div
      className={publicStyles.root}
      data-screen-label={`Onboarding-${step.key}`}
      style={{
        minHeight: "100dvh",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
      }}
    >
      <OnboardingHeader stepIdx={stepIdx} onJump={jump} onSaveAndExit={saveAndExit} />
      <div style={{ position: "relative", overflow: "auto" }}>
        <div
          key={step.key}
          style={{ animation: "co-slide-up-lg 380ms cubic-bezier(.16,1,.3,1) both" }}
        >
          <Container style={{ padding: "40px 0 120px", maxWidth: 880 }}>
            {step.key === "welcome" ? <StepWelcome onNext={next} /> : null}
            {step.key === "identity" ? (
              <StepIdentity value={data.identity} onChange={(v) => merge("identity", v)} />
            ) : null}
            {step.key === "targets" ? (
              <StepTargets value={data.targets} onChange={(v) => merge("targets", v)} />
            ) : null}
            {step.key === "positioning" ? (
              <StepPositioning value={data.positioning} onChange={(v) => merge("positioning", v)} />
            ) : null}
            {step.key === "sources" ? (
              <StepSources value={data.sources} onChange={(v) => merge("sources", v)} />
            ) : null}
            {step.key === "proofs" ? (
              <StepProofs value={data.proofs} onChange={(v) => merge("proofs", v)} />
            ) : null}
            {step.key === "preferences" ? (
              <StepPreferences value={data.preferences} onChange={(v) => merge("preferences", v)} />
            ) : null}
            {step.key === "review" ? <StepReview data={data} onJump={jump} onFinish={finish} /> : null}
          </Container>
        </div>
      </div>
      <OnboardingFooter
        stepIdx={stepIdx}
        onPrev={prev}
        onNext={next}
        onSkip={next}
        onFinish={finish}
        canSkip={SKIPPABLE.includes(step.key)}
        isLast={stepIdx === STEPS.length - 1}
      />
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────

function OnboardingHeader({
  stepIdx,
  onJump,
  onSaveAndExit,
}: {
  stepIdx: number;
  onJump: (i: number) => void;
  onSaveAndExit: () => void;
}) {
  const total = STEPS.length;
  const pct = ((stepIdx + 1) / total) * 100;
  return (
    <header
      style={{
        borderBottom: "1px solid var(--co-border-subtle)",
        background: "color-mix(in oklch, var(--co-bg) 92%, transparent)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Container style={{ padding: "14px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <Link href="/landing" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>
          <Wordmark size={15} />
        </Link>
        <div style={{ flex: 1, maxWidth: 680, display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              fontFamily: "var(--co-font-m)",
              fontSize: 11,
              color: "var(--co-text-3)",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}
          >
            STEP{" "}
            <span style={{ color: "var(--co-accent-strong)", fontWeight: 600 }}>
              {String(stepIdx + 1).padStart(2, "0")}
            </span>{" "}
            / {String(total).padStart(2, "0")}
          </span>
          <div style={{ flex: 1, position: "relative", height: 30, display: "flex", alignItems: "center" }}>
            <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: "var(--co-surface-3)", borderRadius: 9999 }} />
            <div
              style={{
                position: "absolute",
                left: 0,
                height: 3,
                background: "var(--co-accent-strong)",
                borderRadius: 9999,
                width: `${pct}%`,
                transition: "width 380ms cubic-bezier(.16,1,.3,1)",
              }}
            />
            <div style={{ position: "relative", flex: 1, display: "flex", justifyContent: "space-between" }}>
              {STEPS.map((s, i) => {
                const done = i < stepIdx;
                const active = i === stepIdx;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => onJump(i)}
                    title={s.label}
                    style={{
                      position: "relative",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: done || active ? "var(--co-accent-strong)" : "var(--co-surface)",
                      border: `2px solid ${done || active ? "var(--co-accent-strong)" : "var(--co-border)"}`,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      padding: 0,
                      boxShadow: active
                        ? "0 0 0 4px color-mix(in oklch, var(--co-accent-strong) 22%, transparent)"
                        : "none",
                      transition: "all 220ms cubic-bezier(.16,1,.3,1)",
                    }}
                  >
                    {done ? (
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <path
                          d="M2 5 L4.2 7 L8 3"
                          stroke="var(--co-on-accent)"
                          strokeWidth="1.6"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <Btn variant="ghost" size="sm" onClick={onSaveAndExit}>
          Save &amp; exit
        </Btn>
      </Container>
    </header>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────

function OnboardingFooter({
  stepIdx,
  onPrev,
  onNext,
  onSkip,
  onFinish,
  canSkip,
  isLast,
}: {
  stepIdx: number;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
  canSkip: boolean;
  isLast: boolean;
}) {
  return (
    <footer
      style={{
        position: "sticky",
        bottom: 0,
        borderTop: "1px solid var(--co-border-subtle)",
        background: "color-mix(in oklch, var(--co-bg) 92%, transparent)",
        backdropFilter: "blur(12px)",
        zIndex: 5,
      }}
    >
      <Container style={{ padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, maxWidth: 880 }}>
        <Btn variant="ghost" size="md" onClick={onPrev} disabled={stepIdx === 0} icon={<ArrowLeft />}>
          Back
        </Btn>
        <div style={{ display: "flex", gap: 10 }}>
          {canSkip ? (
            <Btn variant="ghost" size="md" onClick={onSkip}>
              Skip for now
            </Btn>
          ) : null}
          {isLast ? (
            <Btn variant="accent" size="md" onClick={onFinish} iconRight={<ArrowRight />}>
              Enter workspace
            </Btn>
          ) : (
            <Btn variant="accent" size="md" onClick={onNext} iconRight={<ArrowRight />}>
              Continue
            </Btn>
          )}
        </div>
      </Container>
    </footer>
  );
}

// ─── Step shell ──────────────────────────────────────────────────────────

function StepShell({
  stepCode,
  title,
  lead,
  children,
}: {
  stepCode: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <>
      <div style={{ marginBottom: "var(--co-s-2xl)" }}>
        <CmdLabel>career-ops setup — {stepCode}</CmdLabel>
        <h1
          style={{
            fontFamily: "var(--co-font-d)",
            fontSize: "clamp(28px, 3.6vw, 40px)",
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: "var(--co-text)",
            marginTop: 14,
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>
        {lead ? (
          <p style={{ marginTop: 10, fontSize: 15, color: "var(--co-text-2)", lineHeight: 1.55, maxWidth: "60ch" }}>
            {lead}
          </p>
        ) : null}
      </div>
      {children}
    </>
  );
}

// ─── 01. Welcome ─────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  const items: { l: string; d: string; req: boolean }[] = [
    { l: "Identity", d: "Name, contact, links", req: true },
    { l: "Role targets", d: "What you want Career-Ops to optimize for", req: true },
    { l: "Positioning", d: "How it should describe your experience", req: false },
    { l: "Resume sources", d: "PDF, DOCX, Markdown, TXT", req: true },
    { l: "Proof points", d: "Projects, metrics, and reusable evidence", req: false },
    { l: "Search preferences", d: "Comp, location, and filters", req: false },
    { l: "Review", d: "Confirm your setup and enter the workspace", req: true },
  ];

  return (
    <StepShell
      stepCode="overview"
      title="Let’s set up the context Career-Ops will use across your search."
      lead="Career-Ops works best when it understands your direction, background, resume sources, and preferences. This setup takes about 5–10 minutes, and you can change anything later."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {items.map((it, i) => (
          <div
            key={it.l}
            style={{
              padding: "16px 18px",
              background: "var(--co-surface)",
              border: "1px solid var(--co-border-subtle)",
              borderRadius: "var(--co-r-md)",
              display: "grid",
              gap: 4,
              boxShadow: "var(--co-el-1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span
                style={{
                  fontFamily: "var(--co-font-m)",
                  fontSize: 10.5,
                  letterSpacing: "0.10em",
                  color: "var(--co-text-3)",
                  textTransform: "uppercase",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {!it.req ? (
                <span style={{ fontFamily: "var(--co-font-m)", fontSize: 10, color: "var(--co-text-3)" }}>optional</span>
              ) : null}
            </div>
            <div style={{ fontFamily: "var(--co-font-d)", fontSize: 16, fontWeight: 600, color: "var(--co-text)" }}>
              {it.l}
            </div>
            <div style={{ fontSize: 13, color: "var(--co-text-2)", lineHeight: 1.45 }}>{it.d}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Btn variant="accent" size="lg" onClick={onNext} iconRight={<ArrowRight />}>
          Start setup
        </Btn>
        <span style={{ fontFamily: "var(--co-font-m)", fontSize: 12, color: "var(--co-text-3)" }}>
          ~5–10 min · everything is editable later
        </span>
      </div>
    </StepShell>
  );
}

// ─── 02. Identity ────────────────────────────────────────────────────────

function StepIdentity({
  value,
  onChange,
}: {
  value: OnboardingData["identity"];
  onChange: (v: OnboardingData["identity"]) => void;
}) {
  const set = <K extends keyof OnboardingData["identity"]>(k: K, v: OnboardingData["identity"][K]) =>
    onChange({ ...value, [k]: v });

  return (
    <StepShell
      stepCode="identity"
      title="Identity"
      lead="These details can appear in resumes, outreach, and application materials. Add what you want included — you can edit everything later."
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Full name" required>
          <Input value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="Bo Ortiz" />
        </Field>
        <Field label="Email" required>
          <Input
            type="email"
            value={value.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Phone">
          <Input value={value.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 123 4567" />
        </Field>
        <Field label="Location">
          <Input value={value.city} onChange={(e) => set("city", e.target.value)} placeholder="Brooklyn, NY" />
        </Field>
        <Field label="LinkedIn" hint="Public profile URL">
          <Input
            value={value.linkedin}
            onChange={(e) => set("linkedin", e.target.value)}
            placeholder="linkedin.com/in/…"
          />
        </Field>
        <Field label="GitHub" hint="Public profile URL">
          <Input
            value={value.github}
            onChange={(e) => set("github", e.target.value)}
            placeholder="github.com/…"
          />
        </Field>
        <Field label="Portfolio" hint="Personal site or portfolio">
          <Input
            value={value.portfolio}
            onChange={(e) => set("portfolio", e.target.value)}
            placeholder="yourname.com"
          />
        </Field>
        <Field label="Other social" hint="Optional: Bluesky, Twitter, Mastodon, etc.">
          <Input value={value.other} onChange={(e) => set("other", e.target.value)} placeholder="bsky.app/profile/…" />
        </Field>
      </div>
    </StepShell>
  );
}

// ─── 03. Role targets ────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  "Senior Frontend Engineer",
  "Staff Frontend Engineer",
  "Product Engineer",
  "AI Engineer",
  "Engineering Manager",
  "Design Engineer",
  "Full-stack Engineer",
  "Solutions Engineer",
];
const ARCHETYPE_OPTIONS = ["Builder", "Systems", "Generalist", "Specialist", "Manager", "Founder"];
const SENIORITY_OPTIONS = ["IC", "Senior", "Staff", "Principal", "Manager", "Director"];
const INDUSTRY_OPTIONS = ["Developer Tools", "AI", "Consumer", "Fintech", "Healthcare", "Enterprise SaaS", "Infra"];

function StepTargets({
  value,
  onChange,
}: {
  value: OnboardingData["targets"];
  onChange: (v: OnboardingData["targets"]) => void;
}) {
  const set = <K extends keyof OnboardingData["targets"]>(k: K, v: OnboardingData["targets"][K]) =>
    onChange({ ...value, [k]: v });

  const toggleIn = (list: string[], item: string, max = Infinity) =>
    list.includes(item) ? list.filter((x) => x !== item) : list.length >= max ? list : [...list, item];

  return (
    <StepShell
      stepCode="role-targets"
      title="What should Career-Ops optimize for?"
      lead="Choose the roles you actually want. Career-Ops uses this to evaluate fit, prioritize opportunities, and tailor resume evidence."
    >
      <div style={{ display: "grid", gap: 24 }}>
        <Field label="Primary target roles" hint="Pick 1–4. You can add custom roles later.">
          <ChipGroup
            options={ROLE_OPTIONS}
            selected={value.roles}
            onToggle={(o) => set("roles", toggleIn(value.roles, o, 4))}
          />
        </Field>
        <Field label="Role archetypes">
          <ChipGroup
            options={ARCHETYPE_OPTIONS}
            selected={value.archetypes}
            onToggle={(o) => set("archetypes", toggleIn(value.archetypes, o))}
          />
        </Field>
        <Field label="Seniority level">
          <ChipGroup
            options={SENIORITY_OPTIONS}
            selected={value.seniority ? [value.seniority] : []}
            onToggle={(o) => set("seniority", value.seniority === o ? "" : o)}
            single
          />
        </Field>
        <Field label="Industries / domains">
          <ChipGroup
            options={INDUSTRY_OPTIONS}
            selected={value.industries}
            onToggle={(o) => set("industries", toggleIn(value.industries, o))}
          />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Preferred work style">
            <ChipGroup
              options={["Remote", "Hybrid", "On-site"]}
              selected={[value.workStyle.charAt(0).toUpperCase() + value.workStyle.slice(1)]}
              onToggle={(o) => set("workStyle", o.toLowerCase())}
              single
            />
          </Field>
          <Field label="Preferred locations">
            <Input
              value={value.locations.join(", ")}
              onChange={(e) =>
                set(
                  "locations",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              placeholder="Remote, NYC, SF"
            />
          </Field>
        </div>
      </div>
    </StepShell>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
  single = false,
}: {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  single?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            style={{
              padding: "6px 12px",
              background: on ? "var(--co-accent-subtle)" : "var(--co-surface)",
              color: on ? "var(--co-accent-strong)" : "var(--co-text-2)",
              border: `1px solid ${on ? "var(--co-accent-strong)" : "var(--co-border)"}`,
              borderRadius: "var(--co-r-full)",
              fontSize: 13,
              fontWeight: on ? 600 : 400,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 160ms ease",
              ...(single && on ? { boxShadow: "var(--co-el-1)" } : {}),
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

// ─── 04. Positioning ─────────────────────────────────────────────────────

function StepPositioning({
  value,
  onChange,
}: {
  value: OnboardingData["positioning"];
  onChange: (v: OnboardingData["positioning"]) => void;
}) {
  const set = <K extends keyof OnboardingData["positioning"]>(k: K, v: OnboardingData["positioning"][K]) =>
    onChange({ ...value, [k]: v });

  return (
    <StepShell
      stepCode="positioning"
      title="How should Career-Ops talk about you?"
      lead="Write the version of your story you want the system to carry into summaries, outreach, application drafts, and interview prep."
    >
      <div style={{ display: "grid", gap: 18 }}>
        <Field label="Professional headline" hint="One line, like a banner.">
          <Input
            value={value.headline}
            onChange={(e) => set("headline", e.target.value)}
            placeholder="Frontend systems engineer focused on tooling and design infrastructure."
          />
        </Field>
        <Field label="Short career summary" hint="2–4 sentences on what you do, what you've built, and where you fit best.">
          <Textarea
            value={value.summary}
            onChange={(v) => set("summary", v)}
            rows={5}
            placeholder="Ten years across consumer and developer-facing products…"
          />
        </Field>
        <Field label="Strengths / superpowers" hint="3–6 short phrases, comma-separated.">
          <Input
            value={value.strengths}
            onChange={(e) => set("strengths", e.target.value)}
            placeholder="Build tooling, design infra, mentoring"
          />
        </Field>
        <Field
          label="Career transition context"
          hint="Optional — useful if you're changing tracks, levels, or industries."
        >
          <Textarea
            value={value.transition}
            onChange={(v) => set("transition", v)}
            rows={3}
            placeholder="e.g. shifting from EM back into a staff IC role"
          />
        </Field>
      </div>
    </StepShell>
  );
}

function Textarea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "10px 12px",
        background: "var(--co-surface)",
        color: "var(--co-text)",
        border: "1px solid var(--co-border)",
        borderRadius: "var(--co-r-md)",
        fontFamily: "inherit",
        fontSize: 14,
        lineHeight: 1.55,
        outline: "none",
        resize: "vertical",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--co-accent-strong)";
        e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in oklch, var(--co-accent-strong) 18%, transparent)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--co-border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

// ─── 05. Resume sources ──────────────────────────────────────────────────

function PasteResumeModal({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (label: string, text: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "color-mix(in oklch, var(--co-surface-deep) 60%, transparent)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(640px, 100%)",
          background: "var(--co-surface)",
          border: "1px solid var(--co-border)",
          borderRadius: "var(--co-r-xl)",
          padding: 24,
          display: "grid",
          gap: 16,
          boxShadow: "var(--co-el-3)",
          animation: "co-slide-up 240ms cubic-bezier(.16,1,.3,1) both",
        }}
      >
        <div>
          <CmdLabel>paste resume text</CmdLabel>
          <h3
            style={{
              fontFamily: "var(--co-font-d)",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              marginTop: 8,
            }}
          >
            Paste your resume content
          </h3>
          <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--co-text-2)", lineHeight: 1.5 }}>
            Career-Ops will treat this as a resume source. You can edit or re-upload later.
          </p>
        </div>
        <Field label="Label" hint="A short name to identify this source.">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="General resume" autoFocus />
        </Field>
        <Field label="Resume text" required>
          <Textarea value={text} onChange={setText} rows={10} placeholder="Paste your resume here…" />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Btn variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn
            variant="accent"
            size="md"
            disabled={text.trim().length === 0}
            onClick={() => onSave(label, text)}
            iconRight={<ArrowRight />}
          >
            Add source
          </Btn>
        </div>
      </div>
    </div>
  );
}

function StepSources({
  value,
  onChange,
}: {
  value: ResumeSource[];
  onChange: (v: ResumeSource[]) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFromFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    const next: ResumeSource[] = [...value];
    incoming.forEach((f) => {
      next.push({
        id: `src-${crypto.randomUUID()}`,
        label: f.name.replace(/\.[^.]+$/, ""),
        file: f.name,
        roles: "All",
        isDefault: next.length === 0,
        status: "parsed",
        evidence: Math.max(8, Math.round(f.size / 800)),
      });
    });
    onChange(next);
  }

  function addFromText(label: string, text: string) {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    onChange([
      ...value,
      {
        id: `src-${crypto.randomUUID()}`,
        label: label.trim() || "Pasted resume",
        file: `${(label.trim() || "pasted").replace(/\s+/g, "-").toLowerCase()}.txt`,
        roles: "All",
        isDefault: value.length === 0,
        status: "parsed",
        evidence: Math.max(6, Math.round(wordCount / 20)),
      },
    ]);
  }

  function makeDefault(id: string) {
    onChange(value.map((s) => ({ ...s, isDefault: s.id === id })));
  }

  function remove(id: string) {
    const removed = value.find((s) => s.id === id);
    const filtered = value.filter((s) => s.id !== id);
    if (removed?.isDefault && filtered.length) filtered[0].isDefault = true;
    onChange(filtered);
  }

  return (
    <StepShell
      stepCode="resume-sources"
      title="Upload your resume sources."
      lead="Career-Ops treats resumes as source material, not just final documents. It extracts facts, projects, skills, and achievements so future drafts stay grounded in real experience."
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFromFiles(e.dataTransfer.files);
        }}
        style={{
          padding: "32px 28px",
          background: dragOver ? "var(--co-accent-subtle)" : "var(--co-surface-recessed)",
          border: `1.5px dashed ${dragOver ? "var(--co-accent-strong)" : "var(--co-border)"}`,
          borderRadius: "var(--co-r-2xl)",
          textAlign: "center",
          display: "grid",
          gap: 10,
          justifyItems: "center",
          transition: "all 200ms ease",
        }}
      >
        <div style={{ fontFamily: "var(--co-font-d)", fontSize: 18, fontWeight: 600 }}>Drop resume files here</div>
        <div style={{ fontSize: 13, color: "var(--co-text-3)", fontFamily: "var(--co-font-m)" }}>
          PDF · DOCX · Markdown · TXT — up to 10MB each
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <Btn variant="accent" size="md" onClick={() => fileInputRef.current?.click()}>
            Add source
          </Btn>
          <Btn variant="secondary" size="md" onClick={() => setPasteOpen(true)}>
            Paste text instead
          </Btn>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.md,.txt"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) addFromFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {pasteOpen ? (
        <PasteResumeModal
          onCancel={() => setPasteOpen(false)}
          onSave={(label, text) => {
            addFromText(label, text);
            setPasteOpen(false);
          }}
        />
      ) : null}

      {value.length > 0 ? (
        <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
          {value.map((s) => (
            <div
              key={s.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                background: "var(--co-surface)",
                border: "1px solid var(--co-border-subtle)",
                borderRadius: "var(--co-r-md)",
                boxShadow: "var(--co-el-1)",
              }}
            >
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--co-text)" }}>{s.label}</div>
                <div style={{ fontFamily: "var(--co-font-m)", fontSize: 11, color: "var(--co-text-3)" }}>
                  {s.file} · {s.roles}
                </div>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  background: "var(--co-accent-subtle)",
                  color: "var(--co-accent-strong)",
                  borderRadius: "var(--co-r-full)",
                  fontFamily: "var(--co-font-m)",
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {s.evidence} evidence items
              </span>
              {s.isDefault ? (
                <span
                  style={{
                    fontFamily: "var(--co-font-m)",
                    fontSize: 10.5,
                    color: "var(--co-success)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Default
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeDefault(s.id)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--co-border)",
                    borderRadius: "var(--co-r-sm)",
                    padding: "4px 10px",
                    fontSize: 12,
                    color: "var(--co-text-2)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Make default
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(s.id)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--co-text-3)",
                  cursor: "pointer",
                  padding: 4,
                  fontSize: 14,
                }}
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </StepShell>
  );
}

// ─── 06. Proof points ────────────────────────────────────────────────────

function StepProofs({
  value,
  onChange,
}: {
  value: ProofPoint[];
  onChange: (v: ProofPoint[]) => void;
}) {
  function add() {
    onChange([
      ...value,
      {
        id: `p-${crypto.randomUUID()}`,
        name: "",
        url: "",
        track: "",
        metric: "",
        notes: "",
      },
    ]);
  }
  function remove(id: string) {
    onChange(value.filter((p) => p.id !== id));
  }
  function update(id: string, patch: Partial<ProofPoint>) {
    onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <StepShell
      stepCode="proof-points"
      title="Reusable evidence."
      lead="Add projects, links, metrics, awards, certifications, or writeups Career-Ops can reuse in resumes, applications, and interview prep."
    >
      <div style={{ display: "grid", gap: 14 }}>
        {value.length === 0 ? (
          <div
            style={{
              padding: "28px 24px",
              background: "var(--co-surface-recessed)",
              border: "1px dashed var(--co-border)",
              borderRadius: "var(--co-r-xl)",
              textAlign: "center",
              color: "var(--co-text-3)",
              fontSize: 14,
            }}
          >
            No proof points yet. Add a project, metric, or writeup you want to reuse.
          </div>
        ) : null}
        {value.map((p, i) => (
          <div
            key={p.id}
            style={{
              padding: "18px 20px",
              background: "var(--co-surface)",
              border: "1px solid var(--co-border-subtle)",
              borderRadius: "var(--co-r-xl)",
              boxShadow: "var(--co-el-1)",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontFamily: "var(--co-font-m)",
                  fontSize: 11,
                  color: "var(--co-accent-strong)",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                }}
              >
                PROOF / {String(i + 1).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--co-text-3)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Remove
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Name">
                <Input
                  value={p.name}
                  onChange={(e) => update(p.id, { name: e.target.value })}
                  placeholder="Vite migration writeup"
                />
              </Field>
              <Field label="URL">
                <Input
                  value={p.url}
                  onChange={(e) => update(p.id, { url: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Track / domain">
                <Input
                  value={p.track}
                  onChange={(e) => update(p.id, { track: e.target.value })}
                  placeholder="Frontend"
                />
              </Field>
              <Field label="Hero metric" hint="The strongest measurable outcome.">
                <Input
                  value={p.metric}
                  onChange={(e) => update(p.id, { metric: e.target.value })}
                  placeholder="3.4× build"
                />
              </Field>
            </div>
            <Field label="Notes" hint="Why it matters, when to use it, or what it proves.">
              <Textarea value={p.notes} onChange={(v) => update(p.id, { notes: v })} rows={2} />
            </Field>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <Btn variant="secondary" size="md" onClick={add} iconRight={<ArrowRight />}>
          Add proof point
        </Btn>
      </div>
    </StepShell>
  );
}

// ─── 07. Search preferences ──────────────────────────────────────────────

function StepPreferences({
  value,
  onChange,
}: {
  value: OnboardingData["preferences"];
  onChange: (v: OnboardingData["preferences"]) => void;
}) {
  const set = <K extends keyof OnboardingData["preferences"]>(k: K, v: OnboardingData["preferences"][K]) =>
    onChange({ ...value, [k]: v });

  return (
    <StepShell
      stepCode="search-preferences"
      title="Search preferences."
      lead="Use these to filter, score, and prioritize opportunities. They are not public — they just help Career-Ops align with what you actually want."
    >
      <div style={{ display: "grid", gap: 24 }}>
        <SectionLabel>Compensation</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <Field label="Target base">
            <Input
              value={value.targetComp}
              onChange={(e) => set("targetComp", e.target.value)}
              prefix="$"
              placeholder="200,000"
            />
          </Field>
          <Field label="Minimum acceptable">
            <Input
              value={value.minComp}
              onChange={(e) => set("minComp", e.target.value)}
              prefix="$"
              placeholder="175,000"
            />
          </Field>
          <Field label="Currency">
            <ChipGroup
              options={["USD", "GBP", "EUR", "CAD"]}
              selected={[value.currency]}
              onToggle={(o) => set("currency", o)}
              single
            />
          </Field>
        </div>

        <SectionLabel>Location flexibility</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Work style">
            <ChipGroup
              options={["Remote-first", "Hybrid", "On-site"]}
              selected={[value.flex.charAt(0).toUpperCase() + value.flex.slice(1).replace(/-/g, "-")]}
              onToggle={(o) => set("flex", o.toLowerCase())}
              single
            />
          </Field>
          <Field label="Relocation">
            <ChipGroup
              options={["Open", "Maybe", "No"]}
              selected={[value.relocate.charAt(0).toUpperCase() + value.relocate.slice(1)]}
              onToggle={(o) => set("relocate", o.toLowerCase())}
              single
            />
          </Field>
        </div>

        <Field
          label="Dealbreakers"
          hint="Comma-separated. Career-Ops can down-rank or filter roles that match these."
        >
          <Input
            value={value.dealbreakers}
            onChange={(e) => set("dealbreakers", e.target.value)}
            placeholder="On-site full-time, crypto"
          />
        </Field>
        <Field label="Positive keywords" hint="Boost roles that mention these.">
          <Input
            value={value.positive}
            onChange={(e) => set("positive", e.target.value)}
            placeholder="tooling, design infra, AI"
          />
        </Field>
        <Field label="Negative keywords" hint="Down-rank roles that mention these.">
          <Input value={value.negative} onChange={(e) => set("negative", e.target.value)} placeholder="crypto, web3" />
        </Field>
      </div>
    </StepShell>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--co-font-m)",
        fontSize: 11,
        color: "var(--co-accent-strong)",
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

// ─── 08. Review ──────────────────────────────────────────────────────────

function StepReview({
  data,
  onJump,
  onFinish,
}: {
  data: OnboardingData;
  onJump: (i: number) => void;
  onFinish: () => void;
}) {
  const rows = useMemo<{ label: string; complete: boolean; index: number }[]>(
    () => [
      { label: "Identity complete", complete: !!(data.identity.name && data.identity.email), index: 1 },
      { label: "Role targets complete", complete: data.targets.roles.length > 0, index: 2 },
      { label: "Positioning complete", complete: !!data.positioning.headline, index: 3 },
      { label: "Resume sources complete", complete: data.sources.length > 0, index: 4 },
      { label: "Proof points complete", complete: data.proofs.length > 0, index: 5 },
      { label: "Search preferences complete", complete: !!data.preferences.targetComp, index: 6 },
    ],
    [data],
  );

  const completedCount = rows.filter((r) => r.complete).length;
  const pct = Math.round((completedCount / rows.length) * 100);

  return (
    <StepShell
      stepCode="review"
      title="Workspace readiness."
      lead="Here’s the setup Career-Ops will use across your search. You can edit any part of it later from Settings."
    >
      <div
        style={{
          padding: "20px 24px",
          background: "linear-gradient(135deg, color-mix(in oklch, var(--co-accent) 14%, var(--co-bg)), var(--co-bg))",
          border: "1px solid color-mix(in oklch, var(--co-accent-strong) 30%, transparent)",
          borderRadius: "var(--co-r-xl)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--co-font-m)",
              fontSize: 11,
              color: "var(--co-text-3)",
              letterSpacing: "0.10em",
              textTransform: "uppercase",
            }}
          >
            Workspace readiness
          </div>
          <div style={{ fontFamily: "var(--co-font-d)", fontSize: 28, fontWeight: 700, marginTop: 4 }}>
            {pct}%
          </div>
        </div>
        <div style={{ flex: 1, maxWidth: 320, height: 6, background: "var(--co-surface-3)", borderRadius: 9999, overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "var(--co-accent-strong)",
              transition: "width 380ms cubic-bezier(.16,1,.3,1)",
            }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => onJump(r.index)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              background: "var(--co-surface)",
              border: "1px solid var(--co-border-subtle)",
              borderRadius: "var(--co-r-md)",
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              color: "var(--co-text)",
              transition: "background 160ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--co-surface-recessed)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--co-surface)")}
          >
            {r.complete ? (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <circle cx="9" cy="9" r="8" fill="var(--co-success)" />
                <path
                  d="M5 9.5 L7.5 12 L13 6"
                  stroke="white"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <circle cx="9" cy="9" r="8" fill="none" stroke="var(--co-warning)" strokeWidth="1.6" />
              </svg>
            )}
            <span style={{ flex: 1 }}>{r.label}</span>
            <span style={{ fontSize: 12, color: "var(--co-text-3)" }}>{r.complete ? "Edit" : "Add"}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Btn variant="ghost" size="lg" onClick={onFinish}>
          Finish later
        </Btn>
        <Btn variant="accent" size="lg" onClick={onFinish} iconRight={<ArrowRight />}>
          Enter workspace
        </Btn>
      </div>
    </StepShell>
  );
}

