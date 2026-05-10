"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthLayout } from "@/components/public/AuthLayout";
import {
  ArrowRight,
  Btn,
  Checkbox,
  CmdLabel,
  Field,
  GithubGlyph,
  GoogleGlyph,
  Input,
  Spinner,
} from "@/components/public/primitives";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("bo@example.com");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; pw?: string }>({});
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: { email?: string; pw?: string } = {};
    if (!email.includes("@")) errs.email = "Enter a valid email address.";
    if (pw.length < 1) errs.pw = "Password is required.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    window.setTimeout(() => {
      router.push("/app-handoff");
    }, 900);
  }

  return (
    <AuthLayout kind="login">
      <CmdLabel>career-ops auth login</CmdLabel>
      <h1
        style={{
          fontFamily: "var(--co-font-d)",
          fontSize: "clamp(28px, 3.2vw, 36px)",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--co-text)",
          marginTop: 14,
          lineHeight: 1.15,
        }}
      >
        Welcome back.
      </h1>
      <p style={{ marginTop: 8, fontSize: 14.5, color: "var(--co-text-2)", lineHeight: 1.5 }}>
        Pick up your pipeline, resumes, and interview prep where you left off.
      </p>

      <form onSubmit={submit} style={{ marginTop: "var(--co-s-2xl)", display: "grid", gap: 16 }}>
        <Field label="Email" error={errors.email} required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            error={!!errors.email}
          />
        </Field>
        <Field label="Password" error={errors.pw} required>
          <Input
            type={showPw ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
            error={!!errors.pw}
            suffix={
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                style={{
                  background: "none",
                  border: 0,
                  color: "var(--co-text-3)",
                  cursor: "pointer",
                  padding: "0 12px",
                  height: "2.625rem",
                  fontFamily: "var(--co-font-m)",
                  fontSize: 11,
                  letterSpacing: "0.05em",
                }}
              >
                {showPw ? "hide" : "show"}
              </button>
            }
          />
        </Field>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Checkbox checked={remember} onChange={() => setRemember((r) => !r)} label="Remember this device" />
          <a href="#" style={{ fontSize: 13, color: "var(--co-accent-strong)", fontWeight: 500 }}>
            Forgot password?
          </a>
        </div>
        <Btn
          type="submit"
          variant="accent"
          size="lg"
          fullWidth
          disabled={loading}
          iconRight={loading ? <Spinner /> : <ArrowRight />}
        >
          {loading ? "Restoring session…" : "Log in"}
        </Btn>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "var(--co-s-2xl)" }}>
        <div style={{ flex: 1, height: 1, background: "var(--co-border-subtle)" }} />
        <span
          style={{
            fontFamily: "var(--co-font-m)",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--co-text-3)",
            textTransform: "uppercase",
          }}
        >
          or continue with
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--co-border-subtle)" }} />
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Btn variant="secondary" size="md">
          <GoogleGlyph /> Google
        </Btn>
        <Btn variant="secondary" size="md">
          <GithubGlyph /> GitHub
        </Btn>
      </div>
    </AuthLayout>
  );
}
