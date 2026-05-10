"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoMark, Spinner } from "@/components/public/primitives";
import publicStyles from "@/components/public/public.module.css";

const STEPS = [
  "Restoring session",
  "Loading profile",
  "Syncing pipeline (16 opportunities)",
  "Reattaching resume drafts",
  "Welcome back",
];

export default function AppHandoffPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      const id = window.setTimeout(() => router.push("/"), 600);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setStep((s) => s + 1), 400);
    return () => window.clearTimeout(id);
  }, [step, router]);

  return (
    <div
      className={publicStyles.root}
      data-screen-label="App-Handoff"
      style={{
        minHeight: "100dvh",
        background: "var(--co-surface-deep)",
        color: "oklch(0.92 0.008 260)",
        display: "grid",
        placeItems: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
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
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 800,
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--co-accent) 40%, transparent), transparent 60%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", textAlign: "center", maxWidth: 560, padding: 32 }}>
        <div style={{ display: "inline-flex" }}>
          <LogoMark size={48} animated />
        </div>
        <h1
          style={{
            marginTop: 24,
            fontFamily: "var(--co-font-d)",
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "oklch(0.96 0.008 260)",
          }}
        >
          Spinning up your workspace…
        </h1>
        <div
          style={{
            marginTop: 30,
            display: "inline-block",
            textAlign: "left",
            fontFamily: "var(--co-font-m)",
            fontSize: 13,
            color: "oklch(0.78 0.012 260)",
          }}
        >
          {STEPS.map((l, i) => (
            <div
              key={l}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "5px 0",
                opacity: i < step ? 1 : i === step ? 0.7 : 0.25,
                transition: "opacity 240ms ease",
              }}
            >
              {i < step ? (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <circle cx="7" cy="7" r="6" fill="none" stroke="oklch(0.68 0.10 155)" strokeWidth="1.4" />
                  <path
                    d="M4 7.5 L6 9 L10 5"
                    stroke="oklch(0.68 0.10 155)"
                    strokeWidth="1.6"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : i === step ? (
                <Spinner size={14} color="oklch(0.78 0.14 45)" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <circle cx="7" cy="7" r="6" fill="none" stroke="oklch(0.40 0.012 260)" strokeWidth="1.4" />
                </svg>
              )}
              <span>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
