"use client";

import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";

import Toast, { type ToastMessage } from "@/components/common/Toast";
import { ToastProvider } from "@/components/common/ToastContext";

import CommandPalette from "./CommandPalette";
import type { CommandItem } from "./shell-data";
import Topbar from "./Topbar";
import styles from "./ShellClient.module.css";

interface ShellClientProps {
  authEnabled: boolean;
  children: React.ReactNode;
  commandItems: CommandItem[];
}

let nextToastId = 1;

export default function ShellClient({
  authEnabled,
  children,
  commandItems,
}: ShellClientProps) {
  const pathname = usePathname();
  const PUBLIC_ROUTE_PREFIXES = [
    "/landing",
    "/login",
    "/register",
    "/onboarding",
    "/app-handoff",
    "/auth/gate",
  ];
  const isPublicRoute = PUBLIC_ROUTE_PREFIXES.some((p) => pathname?.startsWith(p)) ?? false;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function notify(toast: Omit<ToastMessage, "id">) {
    const id = nextToastId++;
    setToasts((current) => [...current, { id, ...toast }]);
  }

  const onGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setPaletteOpen(true);
    }
  });

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => onGlobalKeyDown(event);

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, []);

  useEffect(() => {
    const timers = toasts
      .filter((toast) => toast.dismissAfter)
      .map((toast) =>
        window.setTimeout(() => {
          setToasts((current) =>
            current.filter((entry) => entry.id !== toast.id),
          );
        }, toast.dismissAfter ?? 0),
      );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  if (isPublicRoute) {
    return <ToastProvider value={notify}>{children}</ToastProvider>;
  }

  return (
    <ToastProvider value={notify}>
      <div className={styles.shell}>
        <a className={styles.skipLink} href="#main-content">
          Skip to main content
        </a>

        <Topbar authEnabled={authEnabled} onNotify={notify} onOpenPalette={() => setPaletteOpen(true)} />

        <main className={styles.main} id="main-content">
          {children}
        </main>

        {paletteOpen ? (
          <CommandPalette
            items={commandItems}
            onClose={() => setPaletteOpen(false)}
            onNotify={notify}
          />
        ) : null}

        <Toast onDismiss={dismissToast} toasts={toasts} />
      </div>
    </ToastProvider>
  );
}
