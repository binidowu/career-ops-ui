"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { ToastMessage } from "@/components/common/Toast";

import { NAV_ITEMS } from "./shell-data";
import styles from "./Topbar.module.css";

interface TopbarProps {
  onNotify: (toast: Omit<ToastMessage, "id">) => void;
  onOpenPalette: () => void;
}

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Topbar({ onNotify, onOpenPalette }: TopbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleUnavailable(label: string) {
    onNotify({
      title: `${label} is not available yet`,
      description:
        "That section is on the roadmap, but this build does not include a working flow for it yet.",
      tone: "neutral",
      dismissAfter: 4000,
    });
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
          {NAV_ITEMS.map((item) =>
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
            className={styles.paletteTrigger}
            onClick={onOpenPalette}
            type="button"
          >
            <span>Jump to</span>
            <kbd>⌘K</kbd>
          </button>

          <button className={styles.iconBtn} aria-label="Notifications" type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5v2.25L2 10v.5h12V10l-1.5-1.75V6A4.5 4.5 0 0 0 8 1.5ZM6.5 12a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <button className={styles.avatar} aria-label="User profile" type="button">
            BO
          </button>

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
        {NAV_ITEMS.map((item) =>
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
