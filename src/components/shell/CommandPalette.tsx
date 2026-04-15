"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
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

export default function CommandPalette({
  items,
  onClose,
  onNotify,
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const visibleGroups = GROUP_ORDER.map((group) => ({
    group,
    items: items.filter(
      (item) => item.group === group && matchesCommand(deferredQuery, item),
    ),
  })).filter((entry) => entry.items.length);

  const visibleItems = visibleGroups.flatMap((entry) => entry.items);

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
        title: `${selected.label} stays disabled for now`,
        description:
          "That route is part of the planned information architecture, but the workflow itself is still waiting on a later build step.",
        tone: "neutral",
        dismissAfter: 4000,
      });
      return;
    }

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
          <p className={styles.label}>Command palette</p>
          <button className={styles.close} onClick={onClose} type="button">
            Esc
          </button>
        </header>

        <label className={styles.search}>
          <span className="visually-hidden">Search commands</span>
          <input
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search routes, opportunities, and actions"
            ref={inputRef}
            type="text"
            value={query}
          />
        </label>

        <div className={styles.results}>
          {visibleGroups.length ? (
            visibleGroups.map((entry) => (
              <section className={styles.group} key={entry.group}>
                <p className={styles.groupLabel}>{entry.group}</p>

                <div className={styles.items}>
                  {entry.items.map((item) => {
                    const index = visibleItems.findIndex(
                      (candidate) => candidate.id === item.id,
                    );

                    return (
                      <button
                        className={styles.item}
                        data-active={index === activeIndex}
                        key={item.id}
                        onClick={() => selectItem(index)}
                        type="button"
                      >
                        <span className={styles.itemLabel}>
                          {item.label}
                          {item.disabled ? (
                            <small className={styles.itemMeta}>Soon</small>
                          ) : null}
                        </span>
                        <span className={styles.itemDescription}>
                          {item.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <section className={styles.empty}>
              <p>No matches yet.</p>
              <p>
                Try a company name, a route like “pipeline”, or an action like
                “resume”.
              </p>
            </section>
          )}
        </div>
      </div>
    </dialog>
  );
}
