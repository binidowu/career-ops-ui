"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { ToastMessage } from "@/components/common/Toast";

import type { CommandItem } from "./shell-data";
import { matchesCommand } from "./shell-data";
import styles from "./CommandPalette.module.css";

interface CommandPaletteProps {
  items: CommandItem[];
  onClose: () => void;
  onNotify: (toast: Omit<ToastMessage, "id">) => void;
}

const GROUP_ORDER = ["Navigation", "Opportunities", "Actions"] as const;
const RECENT_ITEMS_STORAGE_KEY = "career-ops.command-palette.recent";
const MAX_RECENT_ITEMS = 6;
const RECENT_ITEMS_EVENT = "career-ops:command-palette-recent";
const EMPTY_RECENT_ITEMS: string[] = [];

let recentItemsSnapshot = EMPTY_RECENT_ITEMS;
let recentItemsSnapshotRaw = "";

function parseRecentItems(value: string | null) {
  if (!value) {
    return EMPTY_RECENT_ITEMS;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return EMPTY_RECENT_ITEMS;
    }

    const nextItems = parsed
      .filter((entry): entry is string => typeof entry === "string")
      .slice(0, MAX_RECENT_ITEMS);

    return nextItems.length ? nextItems : EMPTY_RECENT_ITEMS;
  } catch {
    return EMPTY_RECENT_ITEMS;
  }
}

function readRecentItems() {
  if (typeof window === "undefined") {
    return EMPTY_RECENT_ITEMS;
  }

  const value = window.localStorage.getItem(RECENT_ITEMS_STORAGE_KEY) ?? "";

  if (value === recentItemsSnapshotRaw) {
    return recentItemsSnapshot;
  }

  recentItemsSnapshotRaw = value;
  recentItemsSnapshot = parseRecentItems(value);
  return recentItemsSnapshot;
}

function writeRecentItems(nextItems: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = nextItems.slice(0, MAX_RECENT_ITEMS);
  const raw = normalized.length ? JSON.stringify(normalized) : "";

  if (raw) {
    window.localStorage.setItem(RECENT_ITEMS_STORAGE_KEY, raw);
  } else {
    window.localStorage.removeItem(RECENT_ITEMS_STORAGE_KEY);
  }

  recentItemsSnapshotRaw = raw;
  recentItemsSnapshot = normalized.length ? normalized : EMPTY_RECENT_ITEMS;
}

function subscribeToRecentItems(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(RECENT_ITEMS_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(RECENT_ITEMS_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function emitRecentItemsChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(RECENT_ITEMS_EVENT));
}

function getContextualHrefBoost(pathname: string, item: CommandItem) {
  if (!item.href) {
    return 0;
  }

  if (item.href === pathname) {
    return -8;
  }

  if (pathname.startsWith("/pipeline")) {
    if (item.group === "Opportunities") return 26;
    if (item.href === "/pipeline") return 20;
    if (item.href === "/compare") return 14;
    if (item.href === "/resumes") return 12;
    if (item.href === "/apply") return 10;
  }

  if (pathname.startsWith("/compare")) {
    if (item.href === "/compare") return 18;
    if (item.href === "/pipeline") return 14;
    if (item.href === "/resumes") return 10;
  }

  if (pathname.startsWith("/resumes")) {
    if (item.href === "/resumes") return 18;
    if (item.href === "/apply") return 14;
    if (item.href === "/pipeline") return 10;
  }

  if (pathname.startsWith("/apply")) {
    if (item.href === "/apply") return 18;
    if (item.href === "/resumes") return 14;
    if (item.href === "/pipeline") return 10;
  }

  if (pathname.startsWith("/settings") && item.href === "/settings") {
    return 18;
  }

  return 0;
}

function getQueryBoost(query: string, item: CommandItem) {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return 0;
  }

  const label = item.label.toLowerCase();
  const description = item.description.toLowerCase();

  if (label === trimmed) return 80;
  if (label.startsWith(trimmed)) return 52;
  if (label.includes(trimmed)) return 36;
  if (description.includes(trimmed)) return 18;

  return 0;
}

export default function CommandPalette({
  items,
  onClose,
  onNotify,
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const recentItems = useSyncExternalStore(
    subscribeToRecentItems,
    readRecentItems,
    () => EMPTY_RECENT_ITEMS,
  );

  const rankedItems = items
    .filter((item) => matchesCommand(deferredQuery, item))
    .map((item) => {
      const recentIndex = recentItems.indexOf(item.id);
      const recentBoost = recentIndex === -1 ? 0 : (MAX_RECENT_ITEMS - recentIndex) * 9;

      return {
        item,
        score:
          getQueryBoost(deferredQuery, item) +
          getContextualHrefBoost(pathname, item) +
          recentBoost,
      };
    })
    .sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label));

  const visibleGroups = GROUP_ORDER.map((group) => ({
    group,
    items: rankedItems
      .filter((entry) => entry.item.group === group)
      .map((entry) => entry.item),
  })).filter((entry) => entry.items.length);

  const visibleItems = visibleGroups.flatMap((entry) => entry.items);
  const resultCountLabel =
    visibleItems.length === 1 ? "1 result ready" : `${visibleItems.length} results ready`;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    const focusInput = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);

    return () => {
      window.clearTimeout(focusInput);
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  function selectItem(index: number) {
    const selected = visibleItems[index];

    if (!selected) {
      return;
    }

    onClose();

    if (selected.disabled) {
      onNotify({
        title: `${selected.label} is not available yet`,
        description:
          "That space is listed in the app, but there is no working flow behind it in this build yet.",
        tone: "neutral",
        dismissAfter: 4000,
      });
      return;
    }

    const nextRecentItems = [selected.id, ...recentItems.filter((itemId) => itemId !== selected.id)];
    writeRecentItems(nextRecentItems);
    emitRecentItemsChange();

    if (selected.href) {
      const href = selected.href;

      startTransition(() => {
        router.push(href);
      });
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!visibleItems.length) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % visibleItems.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index === 0 ? visibleItems.length - 1 : index - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectItem(activeIndex);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  function handleBackdropPointerDown(
    event: React.MouseEvent<HTMLDialogElement, MouseEvent>,
  ) {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const rect = dialog.getBoundingClientRect();
    const clickedInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!clickedInside) {
      onClose();
    }
  }

  return (
    <dialog
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropPointerDown}
      ref={dialogRef}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <p className={styles.label}>More routes and actions</p>
            <p className={styles.hint}>
              Apply, Scans, Settings, and opportunity search live here.
            </p>
          </div>
          <button className={styles.close} onClick={onClose} type="button">
            Esc
          </button>
        </header>

        <label className={styles.search}>
          <span className="visually-hidden">Search commands</span>
          <input
            aria-activedescendant={
              visibleItems.length > 0 ? `command-item-${visibleItems[activeIndex]?.id}` : undefined
            }
            aria-controls="command-palette-results"
            aria-expanded={visibleGroups.length > 0}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search routes, tools, companies, or workflows"
            ref={inputRef}
            role="combobox"
            type="text"
            value={query}
          />
          <div className={styles.searchMeta}>
            <span>{resultCountLabel}</span>
            <span>Use ↑↓ to move, Enter to open</span>
          </div>
        </label>

        <div className={styles.results} id="command-palette-results" role="listbox">
          {visibleGroups.length ? (
            visibleGroups.map((entry) => (
              <section className={styles.group} key={entry.group}>
                <div className={styles.groupHead}>
                  <p className={styles.groupLabel}>{entry.group}</p>
                  <span className={styles.groupCount}>
                    {entry.items.length === 1 ? "1 match" : `${entry.items.length} matches`}
                  </span>
                </div>

                <div className={styles.items}>
                  {entry.items.map((item) => {
                    const index = visibleItems.findIndex(
                      (candidate) => candidate.id === item.id,
                    );
                    const isRecent = recentItems.includes(item.id);

                    return (
                      <button
                        aria-selected={index === activeIndex}
                        className={styles.item}
                        data-active={index === activeIndex}
                        id={`command-item-${item.id}`}
                        key={item.id}
                        onClick={() => selectItem(index)}
                        role="option"
                        type="button"
                      >
                        <div className={styles.itemMain}>
                          <span className={styles.itemLabel}>
                            {item.label}
                            {isRecent ? (
                              <small className={styles.itemMeta}>Recent</small>
                            ) : null}
                            {item.disabled ? (
                              <small className={styles.itemMeta}>Soon</small>
                            ) : null}
                          </span>
                          <span className={styles.itemDescription}>
                            {item.description}
                          </span>
                        </div>
                        <span className={styles.itemArrow} aria-hidden="true">
                          ↗
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <section className={styles.empty}>
              <p>No results yet.</p>
              <p>
                Try a company name, a route like “settings”, or a workflow like
                “apply”.
              </p>
            </section>
          )}
        </div>
      </div>
    </dialog>
  );
}
