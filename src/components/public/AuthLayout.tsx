"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

import { Wordmark } from "./primitives";
import publicStyles from "./public.module.css";

type AuthKind = "login" | "register";

export function AuthLayout({
  children,
  kind,
}: {
  children: ReactNode;
  kind: AuthKind;
}) {
  return (
    <div
      className={publicStyles.root}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.05fr)",
        minHeight: "100dvh",
      }}
      data-screen-label={kind === "login" ? "Login" : "Register"}
    >
      {/* Form column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "28px 36px 36px",
          minHeight: "100dvh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--co-s-3xl)",
          }}
        >
          <Link href="/landing" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>
            <Wordmark size={16} />
          </Link>
          <div style={{ fontSize: 13, color: "var(--co-text-3)" }}>
            {kind === "login" ? (
              <>
                New here?{" "}
                <Link
                  href="/register"
                  style={{ color: "var(--co-accent-strong)", fontWeight: 500 }}
                >
                  Create an account →
                </Link>
              </>
            ) : (
              <>
                Have an account?{" "}
                <Link
                  href="/login"
                  style={{ color: "var(--co-accent-strong)", fontWeight: 500 }}
                >
                  Log in →
                </Link>
              </>
            )}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              animation: "co-slide-up 540ms cubic-bezier(.16,1,.3,1) both",
            }}
          >
            {children}
          </div>
        </div>
        <div
          style={{
            marginTop: "var(--co-s-2xl)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "var(--co-text-3)",
          }}
        >
          <span style={{ fontFamily: "var(--co-font-m)", letterSpacing: "0.05em" }}>career-ops · v2.4</span>
          <span>
            Need help?{" "}
            <a href="mailto:support@career-ops.app" style={{ color: "var(--co-text-2)" }}>
              support@career-ops.app
            </a>
          </span>
        </div>
      </div>

      {/* Visual column */}
      <AuthSidePreview kind={kind} />
    </div>
  );
}

function AuthSidePreview({ kind }: { kind: AuthKind }) {
  return (
    <aside
      style={{
        position: "relative",
        background: "var(--co-surface-deep)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
      }}
    >
      {/* dotgrid */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.18,
          backgroundImage: "radial-gradient(circle at 1px 1px, oklch(1 0 0 / 0.6) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-20%",
          right: "-15%",
          width: 600,
          height: 600,
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--co-accent) 35%, transparent), transparent 60%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "-15%",
          left: "-15%",
          width: 520,
          height: 520,
          background: "radial-gradient(circle, oklch(0.4 0.10 260 / 0.5), transparent 60%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", width: "100%", maxWidth: 520, display: "grid", gap: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "oklch(0.78 0.14 45)",
            fontFamily: "var(--co-font-m)",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "oklch(0.78 0.14 45)",
              boxShadow: "0 0 12px oklch(0.78 0.14 45)",
            }}
          />
          {kind === "login"
            ? "Picking up where you left off"
            : "A new workspace, ready in minutes"}
        </div>
        <h2
          style={{
            fontFamily: "var(--co-font-d)",
            fontSize: "clamp(28px, 3.4vw, 38px)",
            fontWeight: 600,
            color: "oklch(0.96 0.008 260)",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          {kind === "login"
            ? "Welcome back. Pick up your pipeline, resumes, and interview prep where you left off."
            : "Create your Career-Ops workspace. We'll set up your profile next so resumes, applications, and interview prep can be personalized from the start."}
        </h2>

        <div
          style={{
            marginTop: 8,
            background: "oklch(0.18 0.012 260)",
            border: "1px solid oklch(0.28 0.012 260)",
            borderRadius: "var(--co-r-xl)",
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <TerminalReplay kind={kind} />
          <div style={{ height: 1, background: "oklch(0.26 0.012 260)" }} />
          <MiniPipelineStrip />
        </div>

        <div style={{ display: "flex", gap: 10, fontSize: 12, color: "oklch(0.65 0.012 260)", flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 9px",
              background: "oklch(0.20 0.012 260)",
              border: "1px solid oklch(0.30 0.012 260)",
              borderRadius: "var(--co-r-full)",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "oklch(0.68 0.10 155)" }} />
            SOC 2 in progress
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 9px",
              background: "oklch(0.20 0.012 260)",
              border: "1px solid oklch(0.30 0.012 260)",
              borderRadius: "var(--co-r-full)",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "oklch(0.78 0.14 45)" }} />
            Profile-controlled inputs
          </span>
        </div>
      </div>
    </aside>
  );
}

function TerminalReplay({ kind }: { kind: AuthKind }) {
  const lines =
    kind === "login"
      ? [
          { t: "> career-ops auth login --interactive", c: "oklch(0.78 0.14 45)" },
          { t: "  ✓ session restored", c: "oklch(0.68 0.10 155)" },
          { t: "  ✓ profile · 92% ready", c: "oklch(0.68 0.10 155)" },
          { t: "  ✓ pipeline · 16 active opportunities", c: "oklch(0.68 0.10 155)" },
          { t: "  ✓ resume drafts · 3 in flight", c: "oklch(0.68 0.10 155)" },
          { t: "  ↳ ready · taking you home", c: "oklch(0.85 0.012 260)" },
        ]
      : [
          { t: "> career-ops init --new-workspace", c: "oklch(0.78 0.14 45)" },
          { t: "  · creating profile scaffold", c: "oklch(0.65 0.012 260)" },
          { t: "  · staging onboarding wizard", c: "oklch(0.65 0.012 260)" },
          { t: "  · preparing evidence extractor", c: "oklch(0.65 0.012 260)" },
          { t: "  · setup ETA · 5–10 min", c: "oklch(0.85 0.012 260)" },
          { t: "  ↳ ready when you are", c: "oklch(0.78 0.14 45)" },
        ];

  const [shown, setShown] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i > lines.length) i = 0;
      setShown(i);
    }, 800);
    return () => clearInterval(id);
  }, [lines.length]);

  return (
    <div
      style={{
        fontFamily: "var(--co-font-m)",
        fontSize: 12,
        color: "oklch(0.78 0.012 260)",
        minHeight: lines.length * 22,
        display: "grid",
        gap: 4,
      }}
    >
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            opacity: i < shown ? 1 : 0,
            transform: i < shown ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 220ms ease, transform 220ms ease",
            color: l.c,
            whiteSpace: "pre",
          }}
        >
          {l.t}
          {i === shown - 1 ? (
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 13,
                background: l.c,
                marginLeft: 4,
                animation: "co-blink-caret 900ms steps(1) infinite",
                verticalAlign: "middle",
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MiniPipelineStrip() {
  const cols = [
    { l: "Saved", n: 6, c: "oklch(0.55 0.010 260)" },
    { l: "Eval", n: 3, c: "oklch(0.70 0.10 220)" },
    { l: "Apply", n: 5, c: "oklch(0.78 0.14 45)" },
    { l: "Inter", n: 2, c: "oklch(0.68 0.10 155)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
      {cols.map((col, i) => (
        <div
          key={col.l}
          style={{
            background: "oklch(0.20 0.012 260)",
            border: "1px solid oklch(0.28 0.012 260)",
            borderRadius: "var(--co-r-md)",
            padding: "8px 8px",
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--co-font-m)",
              fontSize: 9,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "oklch(0.6 0.012 260)",
            }}
          >
            <span>{col.l}</span>
            <span>{col.n}</span>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {Array.from({ length: Math.min(col.n, 3) }, (_, k) => (
              <div
                key={k}
                style={{
                  height: 18,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, ${col.c} 0%, ${col.c} 60%, transparent 60%)`,
                  opacity: 0.18 + k * 0.08,
                  animation: `co-slide-in-right 600ms ${i * 100 + k * 60}ms cubic-bezier(.16,1,.3,1) both`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
