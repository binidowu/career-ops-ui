"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import styles from "./SettingsPrimitives.module.css";

type ButtonVariant = "accent" | "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface BtnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  full?: boolean;
  type?: "button" | "submit";
  style?: CSSProperties;
  className?: string;
}

export function Btn({
  variant = "secondary",
  size = "md",
  children,
  onClick,
  disabled = false,
  loading = false,
  icon = null,
  full = false,
  type = "button",
  style,
  className,
}: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      data-variant={variant}
      data-size={size}
      data-full={full || undefined}
      className={`${styles.btn}${className ? ` ${className}` : ""}`}
      style={style}
    >
      {loading ? <span className={styles.btnSpinner} aria-hidden /> : null}
      {icon ? <span className={styles.btnIcon}>{icon}</span> : null}
      {children}
    </button>
  );
}

interface InputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url" | "number";
  hint?: string;
  error?: string;
  required?: boolean;
  mono?: boolean;
}

export function Input({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  hint,
  error,
  required = false,
  mono = false,
}: InputProps) {
  return (
    <div className={styles.fieldGroup}>
      {label ? (
        <span className={styles.label}>
          {label}
          {required ? <span className={styles.required}>*</span> : null}
        </span>
      ) : null}
      <input
        type={type}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder={placeholder}
        data-mono={mono || undefined}
        data-error={error ? "true" : undefined}
        className={styles.input}
      />
      {hint && !error ? <span className={styles.fieldHint}>{hint}</span> : null}
      {error ? <span className={styles.fieldError}>{error}</span> : null}
    </div>
  );
}

interface TextareaProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
  error?: string;
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder = "",
  rows = 3,
  hint,
  error,
}: TextareaProps) {
  return (
    <div className={styles.fieldGroup}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <textarea
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        data-error={error ? "true" : undefined}
        className={styles.textarea}
      />
      {hint && !error ? <span className={styles.fieldHint}>{hint}</span> : null}
      {error ? <span className={styles.fieldError}>{error}</span> : null}
    </div>
  );
}

type SelectOption = string | { value: string; label: string };

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  hint?: string;
}

export function Select({ label, value, onChange, options, hint }: SelectProps) {
  return (
    <div className={styles.fieldGroup}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <select
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        className={styles.select}
      >
        {options.map((option) => {
          const v = typeof option === "string" ? option : option.value;
          const l = typeof option === "string" ? option : option.label;
          return (
            <option key={v || "(empty)"} value={v}>
              {l}
            </option>
          );
        })}
      </select>
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </div>
  );
}

interface ToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  hint?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}

export function Toggle({ value, onChange, label, hint, size = "md", ariaLabel }: ToggleProps) {
  return (
    <div className={styles.toggleWrap}>
      <button
        type="button"
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        aria-label={ariaLabel}
        data-on={value ? "true" : "false"}
        data-size={size}
        className={styles.toggleSwitch}
      >
        <span className={styles.toggleThumb} />
      </button>
      {(label || hint) ? (
        <div className={styles.toggleCopy}>
          {label ? <span className={styles.toggleLabel}>{label}</span> : null}
          {hint ? <span className={styles.toggleHint}>{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

interface TagInputProps {
  label?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
}

export function TagInput({ label, values, onChange, placeholder = "Add…", hint }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const next = draft.trim();
    if (next && !values.includes(next)) {
      onChange([...values, next]);
    }
    setDraft("");
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className={styles.fieldGroup}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.tagBox}>
        {values.map((value) => (
          <span key={value} className={styles.tag}>
            {value}
            <button
              type="button"
              className={styles.tagRemove}
              onClick={() => onChange(values.filter((v) => v !== value))}
              aria-label={`Remove ${value}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={values.length ? "" : placeholder}
          className={styles.tagInput}
        />
      </div>
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </div>
  );
}

type StatusKind =
  | "pass"
  | "ok"
  | "connected"
  | "warn"
  | "fail"
  | "missing"
  | "error"
  | "pending";

export function StatusDot({ status }: { status: StatusKind | string }) {
  return <span className={styles.statusDot} data-status={status} aria-hidden />;
}

type PillTone = "success" | "warn" | "error" | "neutral" | "accent" | "quiet";

export function StatusPill({ label, tone = "quiet" }: { label: string; tone?: PillTone }) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {label}
    </span>
  );
}

interface SectionHeadProps {
  title: string;
  desc?: string;
  children?: ReactNode;
}

export function SectionHead({ title, desc, children }: SectionHeadProps) {
  return (
    <div className={styles.sectionHead}>
      <div className={styles.sectionHeadCopy}>
        <h2 className={styles.h3}>{title}</h2>
        {desc ? <p className={styles.body}>{desc}</p> : null}
      </div>
      {children ? <div className={styles.sectionHeadActions}>{children}</div> : null}
    </div>
  );
}

export function FieldRow({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={styles.fieldRow} data-cols={cols}>
      {children}
    </div>
  );
}

export function Divider() {
  return <hr className={styles.divider} />;
}

interface ModalProps {
  title: string;
  onClose: () => void;
  width?: "default" | "small";
  children: ReactNode;
}

export function Modal({ title, onClose, width = "default", children }: ModalProps) {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={styles.scrim}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={styles.modal} data-width={width === "small" ? "small" : undefined}>
        <div className={styles.modalHead}>
          <h3 className={styles.h4}>{title}</h3>
          <button type="button" onClick={onClose} className={styles.modalClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

export const styleClasses = styles;
