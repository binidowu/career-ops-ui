"use client";

import { useEffect, useRef, useState } from "react";

import type { ResumeDraftOp, ResumeSection } from "@/lib/types";

import { ResumeBlockEditor } from "./ResumeBlockEditor";
import styles from "./ResumeDocumentEditor.module.css";

function DragHandle() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
      <circle cx="3" cy="2" r="1.2" fill="currentColor" />
      <circle cx="7" cy="2" r="1.2" fill="currentColor" />
      <circle cx="3" cy="7" r="1.2" fill="currentColor" />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" />
      <circle cx="3" cy="12" r="1.2" fill="currentColor" />
      <circle cx="7" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="2" r="1.2" fill="currentColor" />
      <circle cx="6" cy="6" r="1.2" fill="currentColor" />
      <circle cx="6" cy="10" r="1.2" fill="currentColor" />
    </svg>
  );
}

interface Props {
  section: ResumeSection;
  isFirst: boolean;
  isLast: boolean;
  onOp: (op: ResumeDraftOp) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}

export function ResumeSectionEditor({
  section,
  isFirst,
  isLast,
  onOp,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function handleLabelBlur() {
    const text = (labelRef.current?.innerText ?? "").trim();
    if (text && text !== section.label) {
      onOp({ op: "setSectionLabel", sectionId: section.id, label: text });
    }
  }

  const isExperienceSection = section.blocks.every((b) => b.type === "experience");
  const isProjectSection = section.blocks.every((b) => b.type === "project");
  const isSkillSection = section.blocks.every((b) => b.type === "skillGroup");
  const isListSection = section.blocks.every((b) => b.type === "listItem");

  let blocksContent: React.ReactNode;
  if (isSkillSection) {
    blocksContent = (
      <ul className={styles.skillList}>
        {section.blocks.map((block) => (
          <ResumeBlockEditor block={block} key={block.id} onOp={onOp} section={section} />
        ))}
      </ul>
    );
  } else if (isListSection) {
    blocksContent = (
      <ul className={styles.plainList}>
        {section.blocks.map((block) => (
          <ResumeBlockEditor block={block} key={block.id} onOp={onOp} section={section} />
        ))}
      </ul>
    );
  } else if (isProjectSection) {
    blocksContent = (
      <ul className={styles.projectList}>
        {section.blocks.map((block) => (
          <ResumeBlockEditor block={block} key={block.id} onOp={onOp} section={section} />
        ))}
      </ul>
    );
  } else if (isExperienceSection) {
    blocksContent = (
      <div className={styles.entryList}>
        {section.blocks.map((block) => (
          <ResumeBlockEditor block={block} key={block.id} onOp={onOp} section={section} />
        ))}
      </div>
    );
  } else {
    blocksContent = section.blocks.map((block) => (
      <ResumeBlockEditor block={block} key={block.id} onOp={onOp} section={section} />
    ));
  }

  return (
    <div
      className={styles.sectionWrapper}
      data-disabled={!section.enabled}
      data-drag-over={isDragOver}
      data-dragging={isDragging}
      draggable
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
    >
      <div className={styles.section}>
        {/* Section header */}
        <div className={styles.sectionHead}>
          <span
            className={styles.sectionLabel}
            contentEditable
            onBlur={handleLabelBlur}
            ref={labelRef}
            suppressContentEditableWarning
          >
            {section.label}
          </span>

          {/* Controls: drag + menu */}
          <div className={styles.sectionControls} ref={menuRef}>
            <button
              aria-label="Drag section"
              className={styles.sectionBtn}
              data-drag="true"
              type="button"
            >
              <DragHandle />
            </button>

            <button
              aria-label="Section options"
              className={styles.sectionBtn}
              onClick={() => setMenuOpen((v) => !v)}
              type="button"
            >
              <MenuIcon />
            </button>

            {menuOpen && (
              <div className={styles.sectionMenu}>
                <button
                  className={styles.sectionMenuItem}
                  onClick={() => {
                    onOp({ op: "setSectionEnabled", sectionId: section.id, enabled: !section.enabled });
                    setMenuOpen(false);
                  }}
                  type="button"
                >
                  {section.enabled ? "Hide section" : "Show section"}
                </button>

                {!isFirst && (
                  <button
                    className={styles.sectionMenuItem}
                    onClick={() => {
                      onOp({ op: "reorderSections", sectionIds: [] }); // parent handles reorder
                      setMenuOpen(false);
                    }}
                    type="button"
                  >
                    Move up
                  </button>
                )}

                {!isLast && (
                  <button
                    className={styles.sectionMenuItem}
                    onClick={() => {
                      setMenuOpen(false);
                    }}
                    type="button"
                  >
                    Move down
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section content */}
        {section.blocks.length > 0 ? (
          blocksContent
        ) : (
          <p className={styles.emptySectionHint}>No content in this section.</p>
        )}
      </div>
    </div>
  );
}
