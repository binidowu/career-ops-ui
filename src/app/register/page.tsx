"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

interface RegisterForm {
  name: string;
  email: string;
  pw: string;
  pw2: string;
  city: string;
  role: string;
  terms: boolean;
}

type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>({
    name: "",
    email: "",
    pw: "",
    pw2: "",
    city: "",
    role: "",
    terms: false,
  });
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof RegisterForm>(key: K, value: RegisterForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pwStrength = useMemo(() => {
    let s = 0;
    if (form.pw.length >= 8) s++;
    if (/[A-Z]/.test(form.pw)) s++;
    if (/[0-9]/.test(form.pw)) s++;
    if (/[^A-Za-z0-9]/.test(form.pw)) s++;
    return s;
  }, [form.pw]);

  const strengthLabel = ["Too short", "Weak", "Okay", "Strong", "Very strong"][pwStrength];
  const strengthColor = [
    "var(--co-error)",
    "var(--co-error)",
    "var(--co-warning)",
    "var(--co-success)",
    "var(--co-success)",
  ][pwStrength];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: RegisterErrors = {};
    if (form.name.trim().length < 2) errs.name = "Please enter your full name.";
    if (!form.email.includes("@")) errs.email = "Enter a valid email address.";
    if (form.pw.length < 8) errs.pw = "Use at least 8 characters.";
    if (form.pw !== form.pw2) errs.pw2 = "Passwords don’t match.";
    if (!form.terms) errs.terms = "Required to continue.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      window.localStorage.setItem(
        "career-ops:register-seed",
        JSON.stringify({ name: form.name, email: form.email, city: form.city, role: form.role }),
      );
    } catch {
      // localStorage may be blocked in some contexts — non-fatal.
    }
    window.setTimeout(() => {
      router.push("/onboarding");
    }, 900);
  }

  return (
    <AuthLayout kind="register">
      <CmdLabel>career-ops init --new-workspace</CmdLabel>
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
        Create your workspace.
      </h1>
      <p style={{ marginTop: 8, fontSize: 14.5, color: "var(--co-text-2)", lineHeight: 1.5 }}>
        We&apos;ll set up your profile next so resumes, applications, and interview prep can be personalized from the
        start.
      </p>

      <form onSubmit={submit} style={{ marginTop: "var(--co-s-2xl)", display: "grid", gap: 16 }}>
        <Field label="Full name" error={errors.name} required>
          <Input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Bo Ortiz"
            error={!!errors.name}
          />
        </Field>
        <Field label="Email" error={errors.email} required>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="you@example.com"
            error={!!errors.email}
          />
        </Field>
        <Field
          label="Password"
          error={errors.pw}
          required
          hint={!errors.pw ? "8+ characters · mix letters, numbers, symbols" : undefined}
        >
          <Input
            type="password"
            value={form.pw}
            onChange={(e) => setField("pw", e.target.value)}
            placeholder="At least 8 characters"
            error={!!errors.pw}
          />
          {form.pw ? (
            <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 9999,
                      background: i < pwStrength ? strengthColor : "var(--co-surface-3)",
                      transition: "background 200ms ease",
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "var(--co-font-m)",
                  color: strengthColor,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {strengthLabel}
              </div>
            </div>
          ) : null}
        </Field>
        <Field label="Confirm password" error={errors.pw2} required>
          <Input
            type="password"
            value={form.pw2}
            onChange={(e) => setField("pw2", e.target.value)}
            placeholder="Re-enter password"
            error={!!errors.pw2}
          />
        </Field>

        <details
          style={{
            background: "var(--co-surface-recessed)",
            border: "1px solid var(--co-border-subtle)",
            borderRadius: "var(--co-r-md)",
            padding: "12px 14px",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontSize: 13,
              color: "var(--co-text-2)",
              userSelect: "none",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Optional: location &amp; primary target role</span>
            <span style={{ fontFamily: "var(--co-font-m)", fontSize: 10, color: "var(--co-text-3)" }}>
              can fill later
            </span>
          </summary>
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <Field label="Current location">
              <Input
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
                placeholder="Brooklyn, NY"
              />
            </Field>
            <Field label="Primary target role">
              <Input
                value={form.role}
                onChange={(e) => setField("role", e.target.value)}
                placeholder="Senior Frontend Engineer"
              />
            </Field>
          </div>
        </details>

        <div>
          <Checkbox
            checked={form.terms}
            onChange={() => setField("terms", !form.terms)}
            label={
              <span>
                I agree to the{" "}
                <a href="#" style={{ color: "var(--co-accent-strong)" }}>
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" style={{ color: "var(--co-accent-strong)" }}>
                  Privacy Policy
                </a>
                .
              </span>
            }
          />
          {errors.terms ? (
            <div style={{ fontSize: 12, color: "var(--co-error)", marginTop: 6 }}>⚠ {errors.terms}</div>
          ) : null}
        </div>

        <Btn
          type="submit"
          variant="accent"
          size="lg"
          fullWidth
          disabled={loading}
          iconRight={loading ? <Spinner /> : <ArrowRight />}
        >
          {loading ? "Creating workspace…" : "Create account"}
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
          or sign up with
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
