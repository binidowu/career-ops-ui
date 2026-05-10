"use client";

import { useRef, useState } from "react";

import { extractProjectTechStack } from "@/lib/resume-studio";
import type {
  ResumeBlock,
  ResumeBullet,
  ResumeDraftOp,
  ResumeSection,
} from "@/lib/types";

import { ResumeBulletEditor } from "./ResumeBulletEditor";
import styles from "./ResumeDocumentEditor.module.css";

interface Props {
  block: ResumeBlock;
  section: ResumeSection;
  onOp: (op: ResumeDraftOp) => void;
}

function BulletList({
  bullets,
  sectionId,
  blockId,
  onOp,
}: {
  bullets: ResumeBullet[];
  sectionId: string;
  blockId: string;
  onOp: (op: ResumeDraftOp) => void;
}) {
  const dragSrc = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function handleDrop(targetId: string) {
    const srcId = dragSrc.current;
    if (!srcId || srcId === targetId) { setDragOverId(null); return; }

    const ids = bullets.map((b) => b.id);
    const from = ids.indexOf(srcId);
    const to = ids.indexOf(targetId);
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, srcId);
    onOp({ op: "reorderBullets", sectionId, blockId, bulletIds: next });
    dragSrc.current = null;
    setDragOverId(null);
  }

  return (
    <ul className={styles.bulletList}>
      {bullets.map((bullet) => (
        <ResumeBulletEditor
          blockId={blockId}
          bullet={bullet}
          isDragOver={dragOverId === bullet.id}
          isDragging={dragSrc.current === bullet.id}
          key={bullet.id}
          onDragEnd={() => { dragSrc.current = null; setDragOverId(null); }}
          onDragOver={(e) => { e.preventDefault(); setDragOverId(bullet.id); }}
          onDragStart={() => { dragSrc.current = bullet.id; }}
          onDrop={() => handleDrop(bullet.id)}
          onOp={onOp}
          sectionId={sectionId}
        />
      ))}
    </ul>
  );
}

export function ResumeBlockEditor({ block, section, onOp }: Props) {
  const textRef = useRef<HTMLParagraphElement>(null);

  if (block.type === "text") {
    return (
      <p
        className={styles.summaryText}
        contentEditable
        onBlur={() => {
          const text = (textRef.current?.innerText ?? "").trim();
          if (text !== block.text) {
            onOp({ op: "replaceBlockText", sectionId: section.id, blockId: block.id, text });
          }
        }}
        ref={textRef}
        suppressContentEditableWarning
      >
        {block.text}
      </p>
    );
  }

  if (block.type === "listItem") {
    return (
      <li
        className={styles.plainItem}
        contentEditable
        onBlur={(e) => {
          const text = (e.currentTarget.innerText ?? "").trim();
          if (text !== block.text) {
            onOp({ op: "replaceBlockText", sectionId: section.id, blockId: block.id, text });
          }
        }}
        suppressContentEditableWarning
      >
        {block.text}
      </li>
    );
  }

  if (block.type === "skillGroup") {
    return (
      <li className={styles.skillItem}>
        <span className={styles.skillLabel}>{block.label}:</span>{" "}
        {block.items.join(", ")}
      </li>
    );
  }

  if (block.type === "experience") {
    const meta = [block.location, block.period].filter(Boolean).join(" · ");
    return (
      <article className={styles.entry}>
        <div className={styles.entryHead}>
          <span className={styles.entryPrimary}>
            <strong>{block.role}</strong>
            <span className={styles.entrySep}> | </span>
            {block.company}
          </span>
          {meta && <span className={styles.entryMeta}>{meta}</span>}
        </div>
        <BulletList
          blockId={block.id}
          bullets={block.bullets}
          onOp={onOp}
          sectionId={section.id}
        />
      </article>
    );
  }

  if (block.type === "project") {
    const techStack = extractProjectTechStack(block.description);
    return (
      <li className={styles.projectItem}>
        <div className={styles.projectHead}>
          <strong>{block.title}</strong>
          {techStack && (
            <><span className={styles.entrySep}> | </span><span className={styles.entryTech}>{techStack}</span></>
          )}
        </div>
        <BulletList
          blockId={block.id}
          bullets={block.bullets}
          onOp={onOp}
          sectionId={section.id}
        />
      </li>
    );
  }

  return null;
}
