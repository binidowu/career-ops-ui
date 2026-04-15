"use client";

import { createContext, useContext } from "react";

import type { ToastMessage } from "./Toast";

export type ToastDispatcher = (toast: Omit<ToastMessage, "id">) => void;

const ToastContext = createContext<ToastDispatcher | null>(null);

export function ToastProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ToastDispatcher;
}) {
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside the ShellClient toast provider.");
  }

  return context;
}
