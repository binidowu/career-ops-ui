"use client";

import Link from "next/link";
import {
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./landing.module.css";

export default function LandingPage() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
    return () => {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "auto";
      }
    };
  }, []);

  return (
    <div className={styles.root} data-screen-label="Landing">
      <LandingNav />
      <HeroSection />
      <ProblemSection />
      <PillarsSection />
      <WorkflowSection />
      <PrivacySection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────

function Container({
  children,
  style,
  ...rest
}: {
  children: ReactNode;
  style?: CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1240,
        margin: "0 auto",
        padding: "0 28px",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

function LogoMark({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  const stroke = size * 0.08;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: "block" }}>
      <defs>
        <linearGradient id="lm-copper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.16 45)" />
          <stop offset="100%" stopColor="oklch(0.55 0.14 35)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" stroke="url(#lm-copper)" strokeWidth={stroke} fill="none" />
      <circle
        cx="16"
        cy="16"
        r="9"
        stroke="url(#lm-copper)"
        strokeWidth={stroke * 0.85}
        fill="none"
        opacity="0.55"
        className={animated ? styles.animLogoPulse : undefined}
      />
      <circle cx="16" cy="16" r="3.2" fill="url(#lm-copper)" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="url(#lm-copper)" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}

function Wordmark({ size = 16, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={Math.round(size * 1.7)} animated={animated} />
      <span
        style={{
          fontFamily: "var(--co-font-d)",
          fontSize: size,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--co-text)",
        }}
      >
        Career<span style={{ color: "var(--co-accent-strong)" }}>·</span>Ops
      </span>
    </span>
  );
}

function CmdLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--co-font-m)",
        fontSize: 11,
        color: "var(--co-text-3)",
        letterSpacing: "0.10em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--co-accent-strong)",
          boxShadow: "0 0 8px var(--co-accent-strong)",
        }}
      />
      {children}
    </div>
  );
}

type BtnVariant = "accent" | "secondary" | "ghost" | "outline";
type BtnSize = "sm" | "md" | "lg";

function Btn({
  children,
  variant = "accent",
  size = "md",
  icon,
  iconRight,
  fullWidth,
  style,
  ...rest
}: {
  children?: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  style?: CSSProperties;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizes = {
    sm: { h: "1.875rem", px: "12px", fs: 13 },
    md: { h: "2.375rem", px: "14px", fs: 13.5 },
    lg: { h: "2.875rem", px: "18px", fs: 14.5 },
  }[size];

  const variants: Record<BtnVariant, { bg: string; color: string; border: string; shadow: string }> = {
    accent: {
      bg: "var(--co-accent-strong)",
      color: "var(--co-on-accent)",
      border: "1px solid var(--co-accent-strong)",
      shadow: "0 1px 2px oklch(0 0 0 / 0.05)",
    },
    secondary: {
      bg: "var(--co-surface)",
      color: "var(--co-text)",
      border: "1px solid var(--co-border)",
      shadow: "var(--co-el-1)",
    },
    ghost: {
      bg: "transparent",
      color: "var(--co-text-2)",
      border: "1px solid transparent",
      shadow: "none",
    },
    outline: {
      bg: "transparent",
      color: "var(--co-text)",
      border: "1px solid var(--co-border)",
      shadow: "none",
    },
  };
  const v = variants[variant];

  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: sizes.h,
        padding: `0 ${sizes.px}`,
        fontSize: sizes.fs,
        fontWeight: 500,
        fontFamily: "inherit",
        letterSpacing: "-0.005em",
        background: v.bg,
        color: v.color,
        border: v.border,
        borderRadius: "var(--co-r-md)",
        boxShadow: v.shadow,
        cursor: "pointer",
        width: fullWidth ? "100%" : undefined,
        transition: "transform 120ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease",
        ...style,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path
        d="M3 7h8m-3-3 3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RevealOnScroll({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setShown(entry.isIntersecting),
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 700ms ${delay}ms cubic-bezier(.16,1,.3,1), transform 700ms ${delay}ms cubic-bezier(.16,1,.3,1)`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks: { label: string; targetId: string }[] = [
    { label: "Product", targetId: "product" },
    { label: "How it works", targetId: "how-it-works" },
    { label: "Pricing", targetId: "pricing" },
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: scrolled ? "color-mix(in oklch, var(--co-bg) 86%, transparent)" : "transparent",
        backdropFilter: scrolled ? "blur(14px) saturate(140%)" : "none",
        borderBottom: scrolled ? "1px solid var(--co-border-subtle)" : "1px solid transparent",
        transition: "all 220ms ease",
      }}
    >
      <Container style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark size={15} animated />
        <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {navLinks.map((l) => (
            <button
              key={l.label}
              type="button"
              onClick={() => scrollToId(l.targetId)}
              style={{
                padding: "8px 12px",
                fontSize: 13.5,
                color: "var(--co-text-2)",
                fontWeight: 500,
                borderRadius: "var(--co-r-sm)",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {l.label}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/login">
            <Btn variant="ghost" size="md">
              Log in
            </Btn>
          </Link>
          <Link href="/register">
            <Btn variant="accent" size="md" iconRight={<ArrowRight />}>
              Get started
            </Btn>
          </Link>
        </div>
      </Container>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section style={{ position: "relative", paddingTop: 56, paddingBottom: 80, overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: "-10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(1300px, 95vw)",
            height: 780,
            background:
              "radial-gradient(ellipse at center, color-mix(in oklch, var(--co-accent) 18%, transparent) 0%, transparent 60%)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.5,
            backgroundImage:
              "linear-gradient(var(--co-border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--co-border-subtle) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse at 50% 30%, black 30%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 30%, transparent 70%)",
          }}
        />
      </div>

      <Container style={{ position: "relative" }}>
        <h1
          className={styles.animSlideUp}
          style={{
            textAlign: "center",
            fontFamily: "var(--co-font-d)",
            fontSize: "clamp(40px, 6.4vw, 78px)",
            fontWeight: 600,
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
            color: "var(--co-text)",
            maxWidth: "14ch",
            margin: "0 auto",
            textWrap: "balance",
          }}
        >
          Run your job search like an{" "}
          <span style={{ position: "relative", whiteSpace: "nowrap" }}>
            <span
              style={{
                background: "linear-gradient(110deg, oklch(0.66 0.16 45), oklch(0.55 0.14 35) 60%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              operating system
            </span>
            <svg
              style={{ position: "absolute", left: 0, right: 0, bottom: -4, width: "100%", height: 14 }}
              viewBox="0 0 320 14"
              preserveAspectRatio="none"
            >
              <path
                d="M2 9 Q 80 2, 160 7 T 318 6"
                stroke="var(--co-accent-strong)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="600"
                strokeDashoffset="600"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values="600;0;0;-600"
                  keyTimes="0;0.42;0.58;1"
                  dur="4.5s"
                  begin="0.6s"
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines="0.16 1 0.3 1; 0 0 1 1; 0.7 0 0.3 1"
                />
              </path>
            </svg>
          </span>
          .
        </h1>

        <p
          className={styles.animSlideUpD1}
          style={{
            textAlign: "center",
            maxWidth: "62ch",
            margin: "24px auto 0",
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--co-text-2)",
          }}
        >
          Career-Ops helps you evaluate roles, tailor resumes, draft applications, prepare for interviews, and manage
          your pipeline from one connected workspace.
        </p>

        <div
          className={styles.animSlideUpD2}
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginTop: 32,
          }}
        >
          <Link href="/register">
            <Btn variant="accent" size="lg" iconRight={<ArrowRight />}>
              Get started
            </Btn>
          </Link>
          <Btn
            variant="secondary"
            size="lg"
            onClick={() =>
              document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14">
                <polygon points="3,2 12,7 3,12" fill="currentColor" />
              </svg>
            }
          >
            See how it works
          </Btn>
        </div>

        <div className={styles.animSlideUpD3} style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
          <p
            style={{
              maxWidth: "64ch",
              textAlign: "center",
              fontFamily: "var(--co-font-m)",
              fontSize: 11.5,
              letterSpacing: "0.10em",
              lineHeight: 1.6,
              color: "var(--co-text-3)",
              margin: 0,
            }}
          >
            BUILT FOR CANDIDATES WHO WANT MORE THAN A SPREADSHEET AND A PILE OF DISCONNECTED AI CHATS.
          </p>
        </div>

        <div className={styles.animSlideUpLg} style={{ marginTop: "var(--co-s-3xl)" }}>
          <HeroProductMock />
        </div>
      </Container>
    </section>
  );
}

function HeroProductMock() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2400);
    return () => clearInterval(id);
  }, []);
  const fit = 84 + Math.round(Math.sin(tick * 0.7) * 3);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: "var(--co-r-2xl)",
        background: "var(--co-surface)",
        border: "1px solid var(--co-border)",
        boxShadow:
          "0 28px 72px -28px oklch(0 0 0 / 0.32), 0 8px 16px -8px oklch(0 0 0 / 0.10), 0 0 0 1px var(--co-border-subtle)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 18px",
          borderBottom: "1px solid var(--co-border-subtle)",
          background: "linear-gradient(180deg, var(--co-surface-recessed), var(--co-surface))",
        }}
      >
        <div style={{ display: "flex", gap: 7 }}>
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.74 0.16 28)" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.83 0.14 88)" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.76 0.12 145)" }} />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            background: "var(--co-surface-2)",
            border: "1px solid var(--co-border)",
            borderRadius: "var(--co-r-full)",
            fontFamily: "var(--co-font-m)",
            fontSize: 11,
            color: "var(--co-text-3)",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <path d="M6 3.6V6l1.6 1.4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </svg>
          career-ops.app · workspace
        </div>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 280px", minHeight: 520 }}>
        <HeroSidebar />
        <HeroPipeline tick={tick} />
        <HeroAiPanel fit={fit} tick={tick} />
      </div>
    </div>
  );
}

function HeroSidebar() {
  const items: { l: string; active?: boolean; c?: number }[] = [
    { l: "Dashboard" },
    { l: "Pipeline", active: true, c: 16 },
    { l: "Compare" },
    { l: "Resumes", c: 4 },
    { l: "Apply", c: 3 },
    { l: "Interview Prep" },
    { l: "Scans" },
    { l: "Settings" },
  ];

  return (
    <aside
      style={{
        background: "var(--co-surface-recessed)",
        borderRight: "1px solid var(--co-border-subtle)",
        padding: "18px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ padding: "2px 8px" }}>
        <Wordmark size={12.5} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map((it) => (
          <div
            key={it.l}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "7px 9px",
              borderRadius: "var(--co-r-sm)",
              background: it.active ? "var(--co-surface)" : "transparent",
              color: it.active ? "var(--co-text)" : "var(--co-text-2)",
              fontSize: 13,
              fontWeight: it.active ? 600 : 400,
              boxShadow: it.active ? "var(--co-el-1)" : "none",
              border: it.active ? "1px solid var(--co-border-subtle)" : "1px solid transparent",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: it.active ? "var(--co-accent-strong)" : "var(--co-surface-3)",
                }}
              />
              {it.l}
            </span>
            {it.c ? <span style={{ fontFamily: "var(--co-font-m)", fontSize: 10, color: "var(--co-text-3)" }}>{it.c}</span> : null}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          padding: "10px 9px",
          background: "var(--co-surface)",
          border: "1px solid var(--co-border-subtle)",
          borderRadius: "var(--co-r-md)",
        }}
      >
        <div style={{ fontFamily: "var(--co-font-m)", fontSize: 9.5, color: "var(--co-text-3)", letterSpacing: "0.08em" }}>
          READINESS
        </div>
        <div style={{ fontFamily: "var(--co-font-d)", fontSize: 18, fontWeight: 600, marginTop: 2 }}>92%</div>
        <div
          style={{ marginTop: 6, height: 3, background: "var(--co-surface-3)", borderRadius: 9999, overflow: "hidden" }}
        >
          <div style={{ width: "92%", height: "100%", background: "var(--co-accent-strong)" }} />
        </div>
      </div>
    </aside>
  );
}

function HeroPipeline({ tick }: { tick: number }) {
  const cols = [
    { l: "Saved", n: 6, items: ["Anthropic · Frontend Eng", "Linear · Product Eng", "Stripe · Sr Frontend"] },
    { l: "Evaluating", n: 3, items: ["Vercel · Sr FE", "Notion · Eng Manager"] },
    { l: "Applied", n: 5, items: ["Figma · Sr Frontend", "Replit · Product Eng", "Cursor · Eng"] },
    { l: "Interviewing", n: 2, items: ["OpenAI · Solutions", "Perplexity · Sr FE"] },
  ];
  const stageLabels = ["NEW", "SCANNING", "SUBMITTED", "SCHEDULED"];
  const stageScores = [78, 82, 90, 95];

  return (
    <main
      style={{
        padding: "18px 18px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        background: "var(--co-bg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div
            style={{
              fontFamily: "var(--co-font-m)",
              fontSize: 10.5,
              letterSpacing: "0.10em",
              color: "var(--co-text-3)",
              textTransform: "uppercase",
            }}
          >
            PIPELINE
          </div>
          <div
            style={{
              fontFamily: "var(--co-font-d)",
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              marginTop: 2,
            }}
          >
            Spring 2026 search
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span
            style={{
              height: 30,
              padding: "0 11px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--co-surface)",
              border: "1px solid var(--co-border)",
              borderRadius: "var(--co-r-md)",
              fontFamily: "var(--co-font-m)",
              fontSize: 11,
              color: "var(--co-text-2)",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--co-success)" }} />
            16 active
          </span>
          <span
            style={{
              height: 30,
              padding: "0 11px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--co-accent-strong)",
              borderRadius: "var(--co-r-md)",
              color: "var(--co-on-accent)",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            + Add
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, flex: 1 }}>
        {cols.map((c, ci) => (
          <div
            key={c.l}
            style={{
              background: "var(--co-surface-recessed)",
              border: "1px solid var(--co-border-subtle)",
              borderRadius: "var(--co-r-lg)",
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 340,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px" }}>
              <span
                style={{
                  fontFamily: "var(--co-font-m)",
                  fontSize: 9.5,
                  letterSpacing: "0.10em",
                  color: "var(--co-text-3)",
                  textTransform: "uppercase",
                }}
              >
                {c.l}
              </span>
              <span style={{ fontFamily: "var(--co-font-m)", fontSize: 10, color: "var(--co-text-3)" }}>{c.n}</span>
            </div>
            {c.items.map((it, i) => (
              <div
                key={it}
                style={{
                  background: "var(--co-surface)",
                  border: "1px solid var(--co-border-subtle)",
                  borderRadius: "var(--co-r-md)",
                  padding: 10,
                  display: "grid",
                  gap: 6,
                  animation: `co-slide-up 700ms ${ci * 120 + i * 70}ms cubic-bezier(.16,1,.3,1) both`,
                  transform: ci === 2 && i === 0 ? `translateY(${Math.sin(tick * 0.5) * 1.5}px)` : "none",
                  transition: "transform 1200ms ease",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--co-text)" }}>{it.split(" · ")[0]}</div>
                <div style={{ fontSize: 11, color: "var(--co-text-3)" }}>{it.split(" · ")[1]}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--co-font-m)", fontSize: 9.5, color: "var(--co-text-3)" }}>
                    {stageLabels[ci]}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 6px",
                      background: "var(--co-accent-subtle)",
                      color: "var(--co-accent-strong)",
                      borderRadius: 9999,
                      fontFamily: "var(--co-font-m)",
                      fontSize: 9.5,
                      fontWeight: 600,
                    }}
                  >
                    {stageScores[ci] - i * 4}%
                  </span>
                </div>
              </div>
            ))}
            {c.l === "Evaluating" ? (
              <div
                style={{
                  background: "var(--co-surface)",
                  border: "1px dashed var(--co-border)",
                  borderRadius: "var(--co-r-md)",
                  padding: 10,
                  display: "grid",
                  gap: 6,
                  animation: "co-pulse-soft 2.4s ease-in-out infinite",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: "var(--co-font-m)",
                    fontSize: 9.5,
                    color: "var(--co-accent-strong)",
                    letterSpacing: "0.06em",
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--co-accent-strong)" }} />
                  SCANNING
                </div>
                <div style={{ height: 7, background: "var(--co-surface-3)", borderRadius: 9999, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${50 + (tick * 5) % 50}%`,
                      height: "100%",
                      background: "var(--co-accent-strong)",
                      transition: "width 600ms ease",
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--co-text-3)" }}>Reading job description…</div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}

function HeroAiPanel({ fit, tick }: { fit: number; tick: number }) {
  return (
    <aside
      style={{
        borderLeft: "1px solid var(--co-border-subtle)",
        background: "var(--co-surface-recessed)",
        padding: "18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        overflow: "hidden",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--co-font-m)",
            fontSize: 10.5,
            letterSpacing: "0.10em",
            color: "var(--co-text-3)",
            textTransform: "uppercase",
          }}
        >
          AI FIT EVALUATION
        </div>
        <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--co-font-d)",
              fontSize: 42,
              fontWeight: 700,
              color: "var(--co-text)",
              letterSpacing: "-0.04em",
              fontVariantNumeric: "tabular-nums",
              transition: "color 220ms ease",
            }}
          >
            {fit}
          </span>
          <span style={{ fontSize: 14, color: "var(--co-text-3)" }}>/ 100</span>
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontFamily: "var(--co-font-m)",
              fontSize: 10.5,
              color: "var(--co-success)",
              letterSpacing: "0.05em",
            }}
          >
            ↑ +{Math.abs(Math.sin(tick * 0.5) * 4).toFixed(0)} vs avg
          </span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--co-text-2)", lineHeight: 1.5 }}>
          Strong on <strong style={{ color: "var(--co-text)" }}>design infra</strong> and{" "}
          <strong style={{ color: "var(--co-text)" }}>tooling</strong>. Light on{" "}
          <strong style={{ color: "var(--co-warning)" }}>mobile depth</strong>.
        </div>
      </div>

      <div style={{ height: 1, background: "var(--co-border-subtle)" }} />

      <div>
        <div
          style={{
            fontFamily: "var(--co-font-m)",
            fontSize: 10.5,
            letterSpacing: "0.10em",
            color: "var(--co-text-3)",
            textTransform: "uppercase",
          }}
        >
          MATCH EVIDENCE
        </div>
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {[
            "Design tokens · 12 teams",
            "Vite migration · 3.4× build",
            "TypeScript codemods · 18k LOC",
            "Hands-on staff IC at Linear-scale",
          ].map((m, i) => (
            <div
              key={m}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 11.5,
                color: "var(--co-text-2)",
                animation: `co-slide-in-right 700ms ${i * 100 + 400}ms cubic-bezier(.16,1,.3,1) both`,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" style={{ marginTop: 3, flexShrink: 0 }}>
                <circle cx="6" cy="6" r="5" fill="var(--co-success)" />
                <path
                  d="M3.6 6.2 L5.2 7.8 L8.4 4.4"
                  stroke="white"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {m}
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: "var(--co-border-subtle)" }} />

      <div>
        <div
          style={{
            fontFamily: "var(--co-font-m)",
            fontSize: 10.5,
            letterSpacing: "0.10em",
            color: "var(--co-text-3)",
            textTransform: "uppercase",
          }}
        >
          NEXT ACTIONS
        </div>
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {["Tailor resume · Frontend track", "Draft cover letter", "Pull interview brief"].map((m) => (
            <div
              key={m}
              style={{
                padding: "9px 11px",
                background: "var(--co-surface)",
                border: "1px solid var(--co-border-subtle)",
                borderRadius: "var(--co-r-sm)",
                fontSize: 12,
                color: "var(--co-text)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{m}</span>
              <ArrowRight />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ─── Problem ──────────────────────────────────────────────────────────────

function ProblemSection() {
  const points = [
    {
      i: "01",
      t: "Job links scattered",
      d: "across tabs, notes, and trackers that quickly become hard to manage.",
    },
    {
      i: "02",
      t: "Tailoring loses continuity",
      d: "between AI output, resume edits, and application notes for each role.",
    },
    {
      i: "03",
      t: "AI chats forget",
      d: "the strongest examples, metrics, and storylines from earlier applications.",
    },
  ];

  return (
    <section id="product" style={{ padding: "96px 0 80px" }}>
      <Container>
        <div style={{ maxWidth: "68ch" }}>
          <CmdLabel>the problem</CmdLabel>
          <h2
            style={{
              fontFamily: "var(--co-font-d)",
              fontSize: "clamp(32px, 4.4vw, 52px)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              marginTop: 14,
            }}
          >
            Most job searches break down in coordination, not effort.
          </h2>
        </div>

        <div
          style={{
            marginTop: "var(--co-s-3xl)",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 0,
            border: "1px solid var(--co-border-subtle)",
            borderRadius: "var(--co-r-2xl)",
            overflow: "hidden",
          }}
        >
          {points.map((p, i) => (
            <RevealOnScroll key={p.i} delay={i * 80}>
              <div
                style={{
                  padding: "28px 24px",
                  borderRight: i < points.length - 1 ? "1px solid var(--co-border-subtle)" : "none",
                  display: "grid",
                  gap: 10,
                  background: "var(--co-bg)",
                  minHeight: 200,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--co-font-m)",
                    fontSize: 11,
                    color: "var(--co-text-3)",
                    letterSpacing: "0.10em",
                  }}
                >
                  {p.i}
                </span>
                <div
                  style={{
                    fontFamily: "var(--co-font-d)",
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: "-0.015em",
                    color: "var(--co-text)",
                  }}
                >
                  {p.t}
                </div>
                <div style={{ fontSize: 14, color: "var(--co-text-2)", lineHeight: 1.55 }}>{p.d}</div>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        <div
          style={{
            marginTop: 32,
            padding: "28px 32px",
            background:
              "linear-gradient(135deg, color-mix(in oklch, var(--co-accent) 14%, var(--co-bg)), var(--co-bg))",
            border: "1px solid color-mix(in oklch, var(--co-accent-strong) 30%, transparent)",
            borderRadius: "var(--co-r-xl)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div>
            <CmdLabel>the answer</CmdLabel>
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--co-font-d)",
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.015em",
              }}
            >
              Career-Ops turns the job search into a repeatable workflow.
            </div>
          </div>
          <button
            type="button"
            onClick={() => scrollToId("how-it-works")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "var(--co-accent-strong)",
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            See the workflow <ArrowRight />
          </button>
        </div>
      </Container>
    </section>
  );
}

// ─── Pillars ──────────────────────────────────────────────────────────────

type PillarVisualKind = "opportunity" | "resume" | "apply" | "interview" | "profile";

function PillarsSection() {
  const pillars: {
    code: string;
    t: string;
    d: string;
    features: string[];
    visual: PillarVisualKind;
  }[] = [
    {
      code: "01",
      t: "Opportunity Intelligence",
      d: "Save and parse job opportunities. Score them against your profile. Surface risks, gaps, and match evidence.",
      features: ["Save & scan job links", "AI fit score per role", "Risk and gap analysis", "Match-evidence breakdown"],
      visual: "opportunity",
    },
    {
      code: "02",
      t: "Resume Studio",
      d: "Upload resume sources. Extract evidence. Generate tailored, structured resumes that stay grounded in your real experience.",
      features: [
        "Evidence extraction (PDF · DOCX · MD · TXT)",
        "Source provenance per claim",
        "Dynamic section ordering",
        "Polished PDF export",
      ],
      visual: "resume",
    },
    {
      code: "03",
      t: "Application Workspace",
      d: "Draft cover letters and outreach using role-specific evidence. Keep notes and activity tied to each opportunity.",
      features: ["Cover letter drafts", "Outreach templates", "Per-opportunity notes", "Activity timeline"],
      visual: "apply",
    },
    {
      code: "04",
      t: "Interview Prep",
      d: "Generate interview briefs. Build a reusable story bank. Map experience to likely questions.",
      features: ["Role-specific briefs", "Story bank library", "Question/experience mapping", "Tech, behavioral, role rounds"],
      visual: "interview",
    },
    {
      code: "05",
      t: "Candidate Profile",
      d: "Configure roles, comp, location, skills, proof points, and resume sources once. The whole system reuses that profile intelligently.",
      features: [
        "Single source of truth",
        "Reusable across all flows",
        "Track-based resume sources",
        "Edit anytime",
      ],
      visual: "profile",
    },
  ];

  return (
    <section
      style={{
        position: "relative",
        padding: "96px 0 96px",
        background:
          "linear-gradient(180deg, var(--co-bg) 0%, var(--co-surface-recessed) 12%, var(--co-surface-recessed) 88%, var(--co-bg) 100%)",
      }}
    >
      <Container>
        <div style={{ maxWidth: "72ch" }}>
          <CmdLabel>five pillars</CmdLabel>
          <h2
            style={{
              fontFamily: "var(--co-font-d)",
              fontSize: "clamp(32px, 4.4vw, 52px)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              marginTop: 14,
            }}
          >
            One workspace, five connected pillars for your search.
          </h2>
        </div>

        <div style={{ marginTop: "var(--co-s-3xl)", display: "grid", gap: 32 }}>
          {pillars.map((p, i) => (
            <RevealOnScroll key={p.code} delay={20}>
              <PillarCard pillar={p} flip={i % 2 === 1} />
            </RevealOnScroll>
          ))}
        </div>
      </Container>
    </section>
  );
}

function PillarCard({
  pillar,
  flip,
}: {
  pillar: { code: string; t: string; d: string; features: string[]; visual: PillarVisualKind };
  flip: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: flip ? "1.1fr 1fr" : "1fr 1.1fr",
        gap: 48,
        alignItems: "center",
        background: "var(--co-bg)",
        border: "1px solid var(--co-border-subtle)",
        borderRadius: "var(--co-r-2xl)",
        padding: 40,
        boxShadow: "var(--co-el-1)",
      }}
    >
      <div style={{ order: flip ? 2 : 1, display: "grid", gap: 14 }}>
        <span
          style={{
            fontFamily: "var(--co-font-m)",
            fontSize: 11,
            color: "var(--co-accent-strong)",
            letterSpacing: "0.10em",
            fontWeight: 600,
          }}
        >
          PILLAR / {pillar.code}
        </span>
        <h3
          style={{
            fontFamily: "var(--co-font-d)",
            fontSize: "clamp(26px, 3vw, 34px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          {pillar.t}
        </h3>
        <p style={{ fontSize: 15.5, color: "var(--co-text-2)", lineHeight: 1.6 }}>{pillar.d}</p>
        <ul style={{ marginTop: 6, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
          {pillar.features.map((f) => (
            <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--co-text-2)" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" style={{ marginTop: 3, flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6" fill="var(--co-accent-subtle)" />
                <path
                  d="M4 7.5 L6 9 L10 5"
                  stroke="var(--co-accent-strong)"
                  strokeWidth="1.6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ order: flip ? 1 : 2 }}>
        <PillarVisual kind={pillar.visual} />
      </div>
    </div>
  );
}

function PillarVisual({ kind }: { kind: PillarVisualKind }) {
  const base: CSSProperties = {
    background: "var(--co-surface)",
    border: "1px solid var(--co-border-subtle)",
    borderRadius: "var(--co-r-xl)",
    padding: 18,
    boxShadow: "var(--co-el-2)",
    minHeight: 300,
  };

  if (kind === "opportunity") {
    return (
      <div style={base}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "var(--co-font-d)", fontSize: 15, fontWeight: 600 }}>
              Anthropic · Senior Frontend
            </div>
            <div style={{ fontSize: 11.5, color: "var(--co-text-3)", marginTop: 2 }}>Remote · Posted 2d ago</div>
          </div>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "conic-gradient(var(--co-accent-strong) 0 87%, var(--co-surface-3) 87%)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                background: "var(--co-surface)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <span style={{ fontFamily: "var(--co-font-d)", fontWeight: 700, fontSize: 18 }}>87</span>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { l: "Fit · skills overlap", v: 92, c: "var(--co-success)" },
            { l: "Fit · seniority", v: 88, c: "var(--co-success)" },
            { l: "Fit · domain depth", v: 74, c: "var(--co-warning)" },
            { l: "Fit · location", v: 100, c: "var(--co-success)" },
          ].map((r) => (
            <div key={r.l}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: "var(--co-text-2)",
                  marginBottom: 4,
                }}
              >
                <span>{r.l}</span>
                <span style={{ fontFamily: "var(--co-font-m)", color: "var(--co-text)", fontWeight: 600 }}>{r.v}</span>
              </div>
              <div style={{ height: 5, background: "var(--co-surface-3)", borderRadius: 9999, overflow: "hidden" }}>
                <div style={{ width: `${r.v}%`, height: "100%", background: r.c, borderRadius: 9999 }} />
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            background: "var(--co-warning-sub)",
            border: "1px solid color-mix(in oklch, var(--co-warning) 30%, transparent)",
            borderRadius: "var(--co-r-sm)",
            fontSize: 12,
            color: "var(--co-text-2)",
          }}
        >
          ⚠ Risk · Mobile depth not strongly evidenced. Pull from Notion side-project?
        </div>
      </div>
    );
  }

  if (kind === "resume") {
    return (
      <div style={base}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, height: 280 }}>
          <div
            style={{
              background: "var(--co-surface-recessed)",
              border: "1px solid var(--co-border-subtle)",
              borderRadius: "var(--co-r-md)",
              padding: 12,
              display: "grid",
              gap: 6,
              overflow: "hidden",
            }}
          >
            <div style={{ fontFamily: "var(--co-font-m)", fontSize: 9.5, color: "var(--co-text-3)", letterSpacing: "0.10em" }}>
              SOURCE · GENERAL.PDF
            </div>
            <div
              style={{
                fontFamily: "var(--co-font-m)",
                fontSize: 10,
                color: "var(--co-text-2)",
                lineHeight: 1.5,
              }}
            >
              <div>· Built design tokens used by 12 teams</div>
              <div>· Migrated build from Webpack to Vite</div>
              <div>· Reduced p95 build time by 70%</div>
              <div>· Mentored 4 junior engineers</div>
              <div>· Authored TS codemods · 18k LOC</div>
              <div style={{ color: "var(--co-text-3)" }}>...</div>
            </div>
          </div>
          <div
            style={{
              background: "var(--co-surface)",
              border: "1px solid var(--co-border)",
              borderRadius: "var(--co-r-md)",
              padding: 12,
              display: "grid",
              gap: 6,
              position: "relative",
            }}
          >
            <div
              style={{
                fontFamily: "var(--co-font-m)",
                fontSize: 9.5,
                color: "var(--co-accent-strong)",
                letterSpacing: "0.10em",
              }}
            >
              TAILORED · ANTHROPIC
            </div>
            <div style={{ fontSize: 11.5, color: "var(--co-text)", lineHeight: 1.5 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Senior Frontend Engineer</div>
              <div>Built design infrastructure for 12 teams</div>
              <div>
                Migrated CI build · <span style={{ color: "var(--co-accent-strong)", fontWeight: 600 }}>3.4× faster</span>
              </div>
              <div>
                Authored codemods over <span style={{ color: "var(--co-accent-strong)", fontWeight: 600 }}>18k LOC</span>
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: -8,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "var(--co-accent-strong)",
                display: "grid",
                placeItems: "center",
                color: "var(--co-on-accent)",
              }}
            >
              <ArrowRight />
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--co-text-3)",
          }}
        >
          <span style={{ fontFamily: "var(--co-font-m)" }}>42 evidence items · 14 selected</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--co-success)" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--co-success)" }} />
            truthfulness preserved
          </span>
        </div>
      </div>
    );
  }

  if (kind === "apply") {
    return (
      <div style={base}>
        <div
          style={{
            fontFamily: "var(--co-font-m)",
            fontSize: 9.5,
            color: "var(--co-text-3)",
            letterSpacing: "0.10em",
          }}
        >
          COVER LETTER · DRAFT
        </div>
        <div
          style={{
            marginTop: 10,
            padding: 14,
            background: "var(--co-surface-recessed)",
            border: "1px solid var(--co-border-subtle)",
            borderRadius: "var(--co-r-md)",
            fontFamily: "var(--co-font-d)",
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--co-text)",
          }}
        >
          <p style={{ margin: 0 }}>Hi Anthropic team —</p>
          <p style={{ margin: "10px 0" }}>
            I&apos;m writing because the Senior Frontend role lands squarely on what I love doing:{" "}
            <span style={{ background: "var(--co-accent-subtle)", padding: "1px 4px", borderRadius: 3 }}>
              design infrastructure that makes other teams faster
            </span>
            .
          </p>
          <p style={{ margin: 0, color: "var(--co-text-2)" }}>
            At Linear I built shared tokens used by{" "}
            <span style={{ background: "var(--co-accent-subtle)", padding: "1px 4px", borderRadius: 3 }}>
              12 product teams
            </span>{" "}
            and led a migration that{" "}
            <span style={{ background: "var(--co-accent-subtle)", padding: "1px 4px", borderRadius: 3 }}>
              cut p95 builds 70%
            </span>
            ...
          </p>
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--co-text-3)",
          }}
        >
          <span>Tone · Direct</span>
          <span>Length · 280 words</span>
          <span style={{ color: "var(--co-success)" }}>● grounded in evidence</span>
        </div>
      </div>
    );
  }

  if (kind === "interview") {
    return (
      <div style={base}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div
              style={{
                fontFamily: "var(--co-font-m)",
                fontSize: 9.5,
                color: "var(--co-text-3)",
                letterSpacing: "0.10em",
                marginBottom: 8,
              }}
            >
              STORY BANK
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {["Vite migration", "Design tokens · 12 teams", "Mentorship arc", "Cross-team rollout"].map((s) => (
                <div
                  key={s}
                  style={{
                    padding: "8px 10px",
                    background: "var(--co-surface-recessed)",
                    border: "1px solid var(--co-border-subtle)",
                    borderRadius: "var(--co-r-sm)",
                    fontSize: 12,
                    color: "var(--co-text)",
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--co-font-m)",
                fontSize: 9.5,
                color: "var(--co-text-3)",
                letterSpacing: "0.10em",
                marginBottom: 8,
              }}
            >
              LIKELY QUESTIONS
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {[
                { q: "Walk through a system you owned end-to-end.", m: "Vite migration" },
                { q: "How do you mentor without bottlenecking?", m: "Mentorship arc" },
                { q: "Tradeoffs you'd make for design infra?", m: "Design tokens" },
              ].map((it) => (
                <div
                  key={it.q}
                  style={{
                    padding: "8px 10px",
                    background: "var(--co-surface)",
                    border: "1px solid var(--co-border-subtle)",
                    borderRadius: "var(--co-r-sm)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--co-text)", lineHeight: 1.4 }}>{it.q}</div>
                  <div
                    style={{
                      marginTop: 4,
                      fontFamily: "var(--co-font-m)",
                      fontSize: 9.5,
                      color: "var(--co-accent-strong)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    ↳ {it.m}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "profile") {
    return (
      <div style={base}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            paddingBottom: 14,
            borderBottom: "1px solid var(--co-border-subtle)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--co-accent-strong), oklch(0.45 0.10 35))",
              display: "grid",
              placeItems: "center",
              color: "white",
              fontFamily: "var(--co-font-d)",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            BO
          </div>
          <div>
            <div style={{ fontFamily: "var(--co-font-d)", fontSize: 16, fontWeight: 600 }}>Bo Ortiz</div>
            <div style={{ fontSize: 12, color: "var(--co-text-3)" }}>Senior Frontend · Brooklyn, NY</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 22,
                padding: "0 9px",
                background: "var(--co-success-sub)",
                color: "var(--co-success)",
                borderRadius: "var(--co-r-full)",
                fontFamily: "var(--co-font-m)",
                fontSize: 10.5,
                letterSpacing: "0.04em",
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--co-success)",
                  animation: "co-pulse-soft 1.6s ease-in-out infinite",
                }}
              />
              92% READY
            </span>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {[
            { l: "Targets", v: "Frontend · Product Eng · AI Eng" },
            { l: "Sources", v: "2 resumes · 73 evidence items" },
            { l: "Proofs", v: "8 projects · 3 metrics · 2 awards" },
            { l: "Comp", v: "$200k base · remote-first" },
          ].map((r) => (
            <div
              key={r.l}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr",
                gap: 12,
                padding: "8px 10px",
                background: "var(--co-surface-recessed)",
                border: "1px solid var(--co-border-subtle)",
                borderRadius: "var(--co-r-sm)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--co-font-m)",
                  fontSize: 10.5,
                  color: "var(--co-text-3)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {r.l}
              </span>
              <span style={{ fontSize: 12, color: "var(--co-text)" }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Workflow ─────────────────────────────────────────────────────────────

function WorkflowSection() {
  const steps = [
    { n: "01", t: "Add a role", d: "Drop in a link or queue several openings for review." },
    { n: "02", t: "Evaluate fit", d: "See match signals, risks, and role context right away." },
    { n: "03", t: "Choose what matters", d: "Compare opportunities and focus your effort where it counts." },
    {
      n: "04",
      t: "Tailor your application",
      d: "Turn a selected role into tailored resume drafts, outreach support, and apply materials for the role.",
    },
    {
      n: "05",
      t: "Keep the thread alive",
      d: "Track notes, statuses, follow-ups, and application history in one place.",
    },
    {
      n: "06",
      t: "Prepare for interviews",
      d: "Reuse the same opportunity context to generate focused prep when momentum starts.",
    },
  ];

  return (
    <section id="how-it-works" style={{ padding: "80px 0 96px" }}>
      <Container>
        <div style={{ maxWidth: "68ch" }}>
          <CmdLabel>workflow</CmdLabel>
          <h2
            style={{
              fontFamily: "var(--co-font-d)",
              fontSize: "clamp(32px, 4.4vw, 52px)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              marginTop: 14,
            }}
          >
            From role intake to interview-ready.
          </h2>
          <p style={{ marginTop: 14, fontSize: 17, color: "var(--co-text-2)", lineHeight: 1.55 }}>
            Career-Ops turns job links into evaluated opportunities, tailored application work, and interview prep
            without losing context.
          </p>
        </div>

        <div
          style={{
            marginTop: "var(--co-s-3xl)",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            position: "relative",
          }}
        >
          {steps.map((s, i) => (
            <RevealOnScroll key={s.n} delay={i * 60}>
              <div
                style={{
                  background: "var(--co-surface)",
                  border: "1px solid var(--co-border-subtle)",
                  borderRadius: "var(--co-r-xl)",
                  padding: 24,
                  display: "grid",
                  gap: 10,
                  position: "relative",
                  minHeight: 170,
                  boxShadow: "var(--co-el-1)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--co-font-m)",
                    fontSize: 11,
                    color: "var(--co-accent-strong)",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                  }}
                >
                  STEP / {s.n}
                </span>
                <h3
                  style={{
                    fontFamily: "var(--co-font-d)",
                    fontSize: 19,
                    fontWeight: 600,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {s.t}
                </h3>
                <p style={{ fontSize: 13.5, color: "var(--co-text-2)", lineHeight: 1.55 }}>{s.d}</p>
                {i < steps.length - 1 && i % 3 !== 2 ? (
                  <svg
                    style={{
                      position: "absolute",
                      right: -12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      zIndex: 2,
                      color: "var(--co-border)",
                    }}
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M5 12h14m-4-4 4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ─── Privacy ──────────────────────────────────────────────────────────────

function PrivacySection() {
  return (
    <section
      style={{
        padding: "80px 0 96px",
        background:
          "linear-gradient(180deg, var(--co-bg) 0%, color-mix(in oklch, var(--co-accent) 4%, var(--co-bg)) 100%)",
      }}
    >
      <Container style={{ maxWidth: 880, textAlign: "center" }}>
        <CmdLabel>structured by design</CmdLabel>
        <h2
          style={{
            fontFamily: "var(--co-font-d)",
            fontSize: "clamp(28px, 3.6vw, 40px)",
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: "-0.025em",
            marginTop: 14,
            textWrap: "balance",
          }}
        >
          Designed around transparent source files, structured data, and user-controlled profile inputs.
        </h2>
        <p
          style={{
            marginTop: 16,
            fontSize: 16,
            color: "var(--co-text-2)",
            lineHeight: 1.6,
            maxWidth: "58ch",
            margin: "16px auto 0",
          }}
        >
          Your profile and job-search data stay structured in your workspace. Resumes you upload are parsed into
          evidence you can review, edit, or remove. Career-Ops ships with explicit source files for every claim it
          makes about you — so the AI never invents your career.
        </p>
        <div style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          {["Source-traced claims", "User-owned profile inputs", "Editable evidence layer", "Export anytime"].map(
            (t) => (
              <span
                key={t}
                style={{
                  padding: "8px 14px",
                  background: "var(--co-surface)",
                  border: "1px solid var(--co-border-subtle)",
                  borderRadius: "var(--co-r-full)",
                  fontSize: 13,
                  color: "var(--co-text-2)",
                }}
              >
                {t}
              </span>
            ),
          )}
        </div>
      </Container>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section
      id="pricing"
      style={{
        padding: "24px 0 96px",
        background:
          "linear-gradient(180deg, color-mix(in oklch, var(--co-accent) 4%, var(--co-bg)) 0%, var(--co-bg) 60%)",
      }}
    >
      <Container>
        <div
          style={{
            position: "relative",
            borderRadius: "var(--co-r-2xl)",
            padding: "72px 56px",
            overflow: "hidden",
            background: "linear-gradient(135deg, oklch(0.22 0.012 260), oklch(0.16 0.012 260))",
            color: "oklch(0.96 0.008 260)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.18,
              backgroundImage: "radial-gradient(circle at 1px 1px, oklch(1 0 0 / 0.7) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "-40%",
              right: "-20%",
              width: 700,
              height: 700,
              background:
                "radial-gradient(circle, color-mix(in oklch, var(--co-accent) 35%, transparent), transparent 60%)",
              filter: "blur(60px)",
            }}
          />
          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 48,
              alignItems: "center",
            }}
          >
            <div>
              <CmdLabel>begin</CmdLabel>
              <h2
                style={{
                  fontFamily: "var(--co-font-d)",
                  fontSize: "clamp(32px, 4.6vw, 56px)",
                  fontWeight: 600,
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  color: "oklch(0.97 0.008 260)",
                  marginTop: 14,
                }}
              >
                Build your job search command center.
              </h2>
              <p
                style={{
                  marginTop: 16,
                  fontSize: 17,
                  color: "oklch(0.80 0.012 260)",
                  lineHeight: 1.55,
                  maxWidth: "56ch",
                }}
              >
                Profile, sources, and pipeline configured in 5–10 minutes. Then every new opportunity flows through
                the same system.
              </p>
              <div style={{ marginTop: 30, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/register">
                  <Btn variant="accent" size="lg" iconRight={<ArrowRight />}>
                    Create your profile
                  </Btn>
                </Link>
                <Link href="/login">
                  <Btn
                    variant="outline"
                    size="lg"
                    style={{ color: "oklch(0.92 0.008 260)", borderColor: "oklch(0.40 0.012 260)" }}
                  >
                    View demo workspace
                  </Btn>
                </Link>
              </div>
            </div>
            <div
              style={{
                background: "oklch(0.18 0.012 260)",
                border: "1px solid oklch(0.28 0.012 260)",
                borderRadius: "var(--co-r-xl)",
                padding: 18,
                fontFamily: "var(--co-font-m)",
                fontSize: 12,
                color: "oklch(0.78 0.012 260)",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ color: "oklch(0.78 0.14 45)" }}>$ career-ops init</div>
              <div>  · creating profile scaffold</div>
              <div>  · ready in 5–10 min</div>
              <div style={{ color: "oklch(0.78 0.14 45)" }}>$ career-ops opportunity scan https://...</div>
              <div>  ✓ scored 87/100</div>
              <div style={{ color: "oklch(0.78 0.14 45)" }}>$ career-ops resume tailor --target=anthropic</div>
              <div>  ✓ tailored draft ready · 14 evidence items pulled</div>
              <div style={{ color: "oklch(0.74 0.14 145)" }}>  ↳ truthfulness preserved</div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer style={{ padding: "48px 0 40px", borderTop: "1px solid var(--co-border-subtle)" }}>
      <Container
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 24,
        }}
      >
        <Wordmark size={14} />
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {[
            { l: "Product", target: "product" },
            { l: "How it works", target: "how-it-works" },
            { l: "Pricing", target: "pricing" },
          ].map((l) => (
            <button
              key={l.l}
              type="button"
              onClick={() => scrollToId(l.target)}
              style={{
                fontSize: 13,
                color: "var(--co-text-3)",
                background: "transparent",
                border: 0,
                padding: 0,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {l.l}
            </button>
          ))}
          {["Privacy", "Terms", "Contact"].map((l) => (
            <span key={l} style={{ fontSize: 13, color: "var(--co-text-3)" }}>
              {l}
            </span>
          ))}
        </div>
        <div
          style={{
            fontFamily: "var(--co-font-m)",
            fontSize: 11,
            color: "var(--co-text-3)",
            letterSpacing: "0.04em",
          }}
        >
          © 2026 Career-Ops · v2.4
        </div>
      </Container>
    </footer>
  );
}
