"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import styles from "./login.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Incorrect password.");
        setPassword("");
        return;
      }

      router.replace(from);
      router.refresh();
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <p className={styles.wordmark}>Career-Ops</p>
        <h1 className={styles.heading}>Workspace access</h1>
        <p className={styles.subheading}>
          This workspace is password-protected. Enter the access key to continue.
        </p>
      </div>

      <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="password">
            Access key
          </label>
          <input
            autoComplete="current-password"
            autoFocus
            className={`${styles.input} ${error ? styles.inputError : ""}`}
            disabled={loading}
            id="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your access key"
            type="password"
            value={password}
          />
          {error ? <p className={styles.errorMsg} role="alert">{error}</p> : null}
        </div>

        <button
          className={styles.submitBtn}
          disabled={!password || loading}
          type="submit"
        >
          {loading ? "Verifying…" : "Enter workspace"}
        </button>
      </form>

      <p className={styles.hint}>
        Set <code>AUTH_PASSWORD</code> in <code>.env.local</code> to configure access.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
