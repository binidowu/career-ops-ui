"use client";

import { useRef } from "react";

import type { ResumeBullet, ResumeDraftOp } from "@/lib/types";

import styles from "./ResumeDocumentEditor.module.css";

function LockIcon({ locked }: { locked: boolean }) {
  return locked ? (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <rect x="2" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 5V4a2 2 0 0 1 4 0v1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <rect x="2" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 5V3a2 2 0 0 1 4 0" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function DragIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <circle cx="3" cy="2.5" r="1" fill="currentColor" />
      <circle cx="7" cy="2.5" r="1" fill="currentColor" />
      <circle cx="3" cy="5" r="1" fill="currentColor" />
      <circle cx="7" cy="5" r="1" fill="currentColor" />
      <circle cx="3" cy="7.5" r="1" fill="currentColor" />
      <circle cx="7" cy="7.5" r="1" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path d="M2 3h8M5 3V2h2v1M4.5 3v6.5M7.5 3v6.5M3 3l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  bullet: ResumeBullet;
  sectionId: string;
  blockId: string;
  onOp: (op: ResumeDraftOp) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}

export function ResumeBulletEditor({
  bullet,
  sectionId,
  blockId,
  onOp,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const textRef = useRef<HTMLSpanElement>(null);

  function handleInput() {
    if (bullet.locked) return;
    const text = textRef.current?.innerText ?? "";
    onOp({ op: "editBullet", sectionId, blockId, bulletId: bullet.id, text: text.replace(/\n+/g, " ").trim() });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (bullet.locked) { e.preventDefault(); return; }

    if (e.key === "Enter") {
      e.preventDefault();
      // Save current and add new bullet after
      const currentText = (textRef.current?.innerText ?? "").replace(/\n+/g, " ").trim();
      if (currentText !== bullet.text) {
        onOp({ op: "editBullet", sectionId, blockId, bulletId: bullet.id, text: currentText });
      }
      onOp({ op: "addBullet", sectionId, blockId, text: "", afterBulletId: bullet.id });
    }

    if (e.key === "Backspace") {
      const text = textRef.current?.innerText ?? "";
      if (text === "") {
        e.preventDefault();
        onOp({ op: "deleteBullet", sectionId, blockId, bulletId: bullet.id });
      }
    }
  }

  function handleBlur() {
    if (bullet.locked) return;
    const text = (textRef.current?.innerText ?? "").replace(/\n+/g, " ").trim();
    if (text !== bullet.text) {
      onOp({ op: "editBullet", sectionId, blockId, bulletId: bullet.id, text });
    }
  }

  return (
    <li
      className={styles.bulletItem}
      data-dragging={isDragging}
      data-drag-over={isDragOver}
      draggable
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
    >
      <span className={styles.bulletMarker} aria-hidden="true">○</span>

      <span
        className={styles.bulletText}
        contentEditable={!bullet.locked}
        data-locked={bullet.locked}
        onBlur={handleBlur}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        ref={textRef}
        suppressContentEditableWarning
      >
        {bullet.text}
      </span>

      <span className={styles.bulletActions}>
        <button
          aria-label="Drag to reorder"
          className={styles.bulletActionBtn}
          data-drag="true"
          title="Drag to reorder"
          type="button"
        >
          <DragIcon />
        </button>

        <button
          aria-label={bullet.locked ? "Unlock bullet" : "Lock bullet"}
          className={styles.bulletActionBtn}
          data-active={bullet.locked}
          onClick={() => onOp({ op: "lockBullet", sectionId, blockId, bulletId: bullet.id, locked: !bullet.locked })}
          title={bullet.locked ? "Unlock — allow AI rewrites" : "Lock — prevent AI rewrites"}
          type="button"
        >
          <LockIcon locked={bullet.locked} />
        </button>

        <button
          aria-label="Delete bullet"
          className={styles.bulletActionBtn}
          data-danger="true"
          onClick={() => onOp({ op: "deleteBullet", sectionId, blockId, bulletId: bullet.id })}
          title="Delete bullet"
          type="button"
        >
          <TrashIcon />
        </button>
      </span>
    </li>
  );
}
