"use client";

import styles from "./Toast.module.css";

export type ToastTone = "neutral" | "error";

export interface ToastAction {
  label: string;
  onSelect: () => void;
}

export interface ToastMessage {
  id: number;
  title: string;
  description: string;
  tone?: ToastTone;
  dismissAfter?: number | null;
  action?: ToastAction;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className={styles.region} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <section
          key={toast.id}
          className={styles.toast}
          data-tone={toast.tone ?? "neutral"}
        >
          <div className={styles.copy}>
            <p className={styles.title}>{toast.title}</p>
            <p className={styles.description}>{toast.description}</p>
          </div>

          <div className={styles.actions}>
            {toast.action ? (
              <button
                className={styles.action}
                onClick={toast.action.onSelect}
                type="button"
              >
                {toast.action.label}
              </button>
            ) : null}

            <button
              aria-label={`Dismiss ${toast.title}`}
              className={styles.dismiss}
              onClick={() => onDismiss(toast.id)}
              type="button"
            >
              Close
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
