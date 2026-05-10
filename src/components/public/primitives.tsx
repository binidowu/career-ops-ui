"use client";

import { CSSProperties, ReactNode } from "react";

// ── Container ──
export function Container({
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

// ── Logo / Wordmark ──
export function LogoMark({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  const stroke = size * 0.08;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: "block" }}>
      <defs>
        <linearGradient id="co-lm-copper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.16 45)" />
          <stop offset="100%" stopColor="oklch(0.55 0.14 35)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" stroke="url(#co-lm-copper)" strokeWidth={stroke} fill="none" />
      <circle
        cx="16"
        cy="16"
        r="9"
        stroke="url(#co-lm-copper)"
        strokeWidth={stroke * 0.85}
        fill="none"
        opacity="0.55"
        style={
          animated
            ? { animation: "co-lm-pulse 2.4s ease-in-out infinite", transformOrigin: "center" }
            : {}
        }
      />
      <circle cx="16" cy="16" r="3.2" fill="url(#co-lm-copper)" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="url(#co-lm-copper)" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ size = 16, animated = false }: { size?: number; animated?: boolean }) {
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

// ── CmdLabel: monospace eyebrow ──
export function CmdLabel({ children }: { children: ReactNode }) {
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

// ── Buttons ──
export type BtnVariant = "accent" | "secondary" | "ghost" | "outline";
export type BtnSize = "sm" | "md" | "lg";

export function Btn({
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

// ── Form primitives ──
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      {label ? (
        <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: "var(--co-text)",
              letterSpacing: "-0.005em",
            }}
          >
            {label}
            {required ? <span style={{ color: "var(--co-accent-strong)", marginLeft: 4 }}>*</span> : null}
          </span>
          {hint ? <span style={{ fontSize: 11.5, color: "var(--co-text-3)" }}>{hint}</span> : null}
        </span>
      ) : null}
      <div>{children}</div>
      {error ? <span style={{ fontSize: 12, color: "var(--co-error)" }}>⚠ {error}</span> : null}
    </label>
  );
}

export function Input({
  prefix,
  suffix,
  error,
  style,
  ...rest
}: {
  prefix?: ReactNode;
  suffix?: ReactNode;
  error?: boolean;
  style?: CSSProperties;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        background: "var(--co-surface)",
        border: `1px solid ${error ? "var(--co-error)" : "var(--co-border)"}`,
        borderRadius: "var(--co-r-md)",
        boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.03)",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
        ...style,
      }}
      onFocusCapture={(e) => {
        if (!error) e.currentTarget.style.borderColor = "var(--co-accent-strong)";
        e.currentTarget.style.boxShadow = `0 0 0 3px color-mix(in oklch, ${
          error ? "var(--co-error)" : "var(--co-accent-strong)"
        } 18%, transparent)`;
      }}
      onBlurCapture={(e) => {
        e.currentTarget.style.borderColor = error ? "var(--co-error)" : "var(--co-border)";
        e.currentTarget.style.boxShadow = "inset 0 1px 0 oklch(1 0 0 / 0.03)";
      }}
    >
      {prefix ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0 0 0 12px",
            fontFamily: "var(--co-font-m)",
            fontSize: 12,
            color: "var(--co-text-3)",
          }}
        >
          {prefix}
        </span>
      ) : null}
      <input
        {...rest}
        style={{
          flex: 1,
          height: "2.625rem",
          padding: "0 12px",
          background: "transparent",
          border: 0,
          outline: "none",
          fontFamily: "inherit",
          fontSize: 14,
          color: "var(--co-text)",
        }}
      />
      {suffix}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "flex-start",
        gap: 8,
        cursor: "pointer",
        userSelect: "none",
        fontSize: 13,
        color: "var(--co-text-2)",
        position: "relative",
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          marginTop: 1,
          background: checked ? "var(--co-accent-strong)" : "var(--co-surface)",
          border: `1px solid ${checked ? "var(--co-accent-strong)" : "var(--co-border)"}`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          transition: "all 160ms ease",
        }}
      >
        {checked ? (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M2 5.5 L4 7.3 L8 3"
              stroke="var(--co-on-accent)"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        tabIndex={-1}
      />
      <span>{label}</span>
    </label>
  );
}

// ── Glyphs ──
export function ArrowRight() {
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

export function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path
        d="M11 7H3m3-3-3 3 3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Spinner({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: "spin 800ms linear infinite" }}>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth="2.4"
        fill="none"
        strokeDasharray="38"
        strokeDashoffset="14"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GoogleGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22 12.2c0-.8-.1-1.4-.2-2.1H12v3.9h5.6c-.1.9-.7 2.4-2 3.4l3.2 2.5c1.9-1.7 3.2-4.3 3.2-7.7z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1l-3.3 2.5C4.7 19.6 8.1 22 12 22z" />
      <path fill="#FBBC05" d="M6.4 13.9c-.2-.6-.3-1.3-.3-1.9s.1-1.3.3-1.9L3.1 7.6C2.4 9 2 10.4 2 12s.4 3 1.1 4.4l3.3-2.5z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.5.6 3 1.2l2.3-2.2C15.9 3.7 14.1 3 12 3c-3.9 0-7.3 2.4-8.9 5.6l3.3 2.5c.8-2.4 3-4.1 5.6-4.1z" />
    </svg>
  );
}

export function GithubGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.4-.6-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.3.8.8 1.3 1.9 1.3 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  );
}
