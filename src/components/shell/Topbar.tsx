"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useTheme } from "@/components/common/ThemeProvider";
import type { ToastMessage } from "@/components/common/Toast";

import { PRIMARY_NAV_ITEMS } from "./shell-data";
import styles from "./Topbar.module.css";

interface TopbarProps {
  authEnabled: boolean;
  onNotify: (toast: Omit<ToastMessage, "id">) => void;
  onOpenPalette: () => void;
}

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Topbar({ authEnabled, onNotify, onOpenPalette }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const darkModeEnabled = theme === "dark";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function handleUnavailable(label: string) {
    onNotify({
      title: `${label} is not available yet`,
      description:
        "That section is on the roadmap, but this build does not include a working flow for it yet.",
      tone: "neutral",
      dismissAfter: 4000,
    });
  }

  function toggleTheme() {
    setTheme(darkModeEnabled ? "light" : "dark");
  }

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <div className={styles.identity}>
          <Link className={styles.wordmark} href="/">
            Career-Ops v2
          </Link>
        </div>

        <nav aria-label="Primary" className={styles.navDesktop}>
          {PRIMARY_NAV_ITEMS.map((item) =>
            item.disabled ? (
              <button
                className={styles.navItem}
                key={item.href}
                onClick={() => handleUnavailable(item.label)}
                type="button"
              >
                <span>{item.label}</span>
                <small>Soon</small>
              </button>
            ) : (
              <Link
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={styles.navItem}
                data-active={isActive(pathname, item.href)}
                href={item.href}
                key={item.href}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>{item.label}</span>
              </Link>
            ),
          )}
        </nav>

        <div className={styles.tools}>
          <button
            aria-label="Open command menu for more routes, settings, and workflows"
            className={styles.paletteTrigger}
            onClick={onOpenPalette}
            type="button"
          >
            <span>More</span>
            <kbd>⌘K</kbd>
          </button>

          <button
            aria-label={darkModeEnabled ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={darkModeEnabled}
            className={`${styles.iconBtn} ${styles.themeToggle}`}
            data-active={darkModeEnabled}
            onClick={toggleTheme}
            title={darkModeEnabled ? "Switch to light mode" : "Switch to dark mode"}
            type="button"
          >
            {darkModeEnabled ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 2V1M8 15v-1M3.76 3.76 3.05 3.05M12.95 12.95l-.71-.71M2 8H1M15 8h-1M3.76 12.24l-.71.71M12.95 3.05l-.71.71M11.25 8A3.25 3.25 0 1 1 4.75 8a3.25 3.25 0 0 1 6.5 0Z" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M13.42 10.7A5.9 5.9 0 0 1 5.3 2.58 5.9 5.9 0 1 0 13.42 10.7Z" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          <button className={styles.iconBtn} aria-label="Notifications" type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5v2.25L2 10v.5h12V10l-1.5-1.75V6A4.5 4.5 0 0 0 8 1.5ZM6.5 12a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {authEnabled ? (
            <button
              aria-label="Sign out"
              className={styles.avatar}
              onClick={() => void handleLogout()}
              title="Sign out"
              type="button"
            >
              BO
            </button>
          ) : (
            <button className={styles.avatar} aria-label="User profile" type="button">
              BO
            </button>
          )}

          <button
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation"
            className={styles.menuToggle}
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            Menu
          </button>
        </div>
      </div>

      <nav
        aria-label="Primary mobile"
        className={styles.mobileNav}
        data-open={mobileMenuOpen}
      >
        {PRIMARY_NAV_ITEMS.map((item) =>
          item.disabled ? (
            <button
              className={styles.mobileItem}
              key={item.href}
              onClick={() => handleUnavailable(item.label)}
              type="button"
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </button>
          ) : (
            <Link
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={styles.mobileItem}
              data-active={isActive(pathname, item.href)}
              href={item.href}
              key={item.href}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </Link>
          ),
        )}
      </nav>
    </header>
  );
}
