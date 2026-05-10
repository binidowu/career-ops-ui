"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/common/ToastContext";
import type { ResumeDocument, ResumeDraftOp } from "@/lib/types";

import { ResumeExportBar } from "./ResumeExportBar";
import { ResumeSectionEditor } from "./ResumeSectionEditor";
import styles from "./ResumeDocumentEditor.module.css";

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

const ZOOM_LEVELS = [75, 100, 125, 150] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

/* Apply a single op to the document locally (mirrors server-side logic for optimistic updates) */
function applyOp(doc: ResumeDocument, op: ResumeDraftOp): ResumeDocument {
  const now = new Date().toISOString();

  switch (op.op) {
    case "setFormat": return { ...doc, format: op.format, updatedAt: now };
    case "setHeadline": return { ...doc, headline: op.text, updatedAt: now };
    case "setStatus": return { ...doc, status: op.status, updatedAt: now };

    case "setSectionEnabled":
      return {
        ...doc,
        updatedAt: now,
        sections: doc.sections.map((s) =>
          s.id === op.sectionId ? { ...s, enabled: op.enabled } : s,
        ),
      };

    case "setSectionLabel":
      return {
        ...doc,
        updatedAt: now,
        sections: doc.sections.map((s) =>
          s.id === op.sectionId ? { ...s, label: op.label } : s,
        ),
      };

    case "reorderSections": {
      if (!op.sectionIds.length) return doc;
      const map = new Map(doc.sections.map((s) => [s.id, s]));
      const reordered = op.sectionIds
        .map((id, i) => { const s = map.get(id); return s ? { ...s, order: i } : null; })
        .filter((s): s is NonNullable<typeof s> => s !== null);
      const rest = doc.sections
        .filter((s) => !op.sectionIds.includes(s.id))
        .map((s, i) => ({ ...s, order: reordered.length + i }));
      return { ...doc, updatedAt: now, sections: [...reordered, ...rest] };
    }

    case "editBullet":
      return {
        ...doc,
        updatedAt: now,
        sections: doc.sections.map((s) => {
          if (s.id !== op.sectionId) return s;
          return {
            ...s,
            blocks: s.blocks.map((b) => {
              if (b.id !== op.blockId) return b;
              if (b.type !== "experience" && b.type !== "project") return b;
              return {
                ...b,
                bullets: b.bullets.map((bl) =>
                  bl.id === op.bulletId ? { ...bl, text: op.text, userEdited: true } : bl,
                ),
              };
            }),
          };
        }),
      };

    case "addBullet": {
      const newBullet = {
        id: `bullet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: op.text,
        sourceEvidenceIds: [],
        matchedKeywords: [],
        userEdited: true,
        locked: false,
      };
      return {
        ...doc,
        updatedAt: now,
        sections: doc.sections.map((s) => {
          if (s.id !== op.sectionId) return s;
          return {
            ...s,
            blocks: s.blocks.map((b) => {
              if (b.id !== op.blockId) return b;
              if (b.type !== "experience" && b.type !== "project") return b;
              if (!op.afterBulletId) return { ...b, bullets: [...b.bullets, newBullet] };
              const idx = b.bullets.findIndex((bl) => bl.id === op.afterBulletId);
              const next = [...b.bullets];
              next.splice(idx + 1, 0, newBullet);
              return { ...b, bullets: next };
            }),
          };
        }),
      };
    }

    case "deleteBullet":
      return {
        ...doc,
        updatedAt: now,
        sections: doc.sections.map((s) => {
          if (s.id !== op.sectionId) return s;
          return {
            ...s,
            blocks: s.blocks.map((b) => {
              if (b.id !== op.blockId) return b;
              if (b.type !== "experience" && b.type !== "project") return b;
              return { ...b, bullets: b.bullets.filter((bl) => bl.id !== op.bulletId) };
            }),
          };
        }),
      };

    case "reorderBullets":
      return {
        ...doc,
        updatedAt: now,
        sections: doc.sections.map((s) => {
          if (s.id !== op.sectionId) return s;
          return {
            ...s,
            blocks: s.blocks.map((b) => {
              if (b.id !== op.blockId) return b;
              if (b.type !== "experience" && b.type !== "project") return b;
              const bmap = new Map(b.bullets.map((bl) => [bl.id, bl]));
              const reordered = op.bulletIds.map((id) => bmap.get(id)).filter((bl): bl is NonNullable<typeof bl> => Boolean(bl));
              const rest = b.bullets.filter((bl) => !op.bulletIds.includes(bl.id));
              return { ...b, bullets: [...reordered, ...rest] };
            }),
          };
        }),
      };

    case "lockBullet":
      return {
        ...doc,
        updatedAt: now,
        sections: doc.sections.map((s) => {
          if (s.id !== op.sectionId) return s;
          return {
            ...s,
            blocks: s.blocks.map((b) => {
              if (b.id !== op.blockId) return b;
              if (b.type !== "experience" && b.type !== "project") return b;
              return { ...b, bullets: b.bullets.map((bl) => bl.id === op.bulletId ? { ...bl, locked: op.locked } : bl) };
            }),
          };
        }),
      };

    case "replaceBlockText":
      return {
        ...doc,
        updatedAt: now,
        sections: doc.sections.map((s) => {
          if (s.id !== op.sectionId) return s;
          return {
            ...s,
            blocks: s.blocks.map((b) => {
              if (b.id !== op.blockId) return b;
              if (b.type !== "text" && b.type !== "listItem") return b;
              return { ...b, text: op.text, userEdited: true };
            }),
          };
        }),
      };

    default:
      return doc;
  }
}

interface Props {
  initialDocument: ResumeDocument;
  onDocumentChange?: (doc: ResumeDocument) => void;
  onRequestExport: (doc: ResumeDocument) => Promise<void>;
  /** Extra buttons rendered at the right end of the editor header bar */
  headerActions?: ReactNode;
}

export function ResumeDocumentEditor({ initialDocument, onDocumentChange, onRequestExport, headerActions }: Props) {
  const notify = useToast();
  const [localDoc, setLocalDoc] = useState<ResumeDocument>(initialDocument);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [exporting, setExporting] = useState(false);
  // Zoom only applies when user explicitly adjusts it; default is no scaling.
  const [zoom, setZoom] = useState<ZoomLevel>(100);

  const pendingOpsRef = useRef<ResumeDraftOp[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external document updates (e.g. new draft generated)
  useEffect(() => {
    setLocalDoc(initialDocument);
    setSaveStatus("saved");
    pendingOpsRef.current = [];
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, [initialDocument.id]);

  const flushPatch = useCallback(async (doc: ResumeDocument, ops: ResumeDraftOp[]) => {
    if (!ops.length) return;

    setSaveStatus("saving");
    try {
      const response = await fetch(`/api/resumes/drafts/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Patch failed.");
      }

      const data = (await response.json()) as { document?: ResumeDocument };
      if (data.document) {
        setLocalDoc(data.document);
        onDocumentChange?.(data.document);
      }
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      notify({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save your edits.",
        tone: "error",
        dismissAfter: 5000,
      });
    }
  }, [notify, onDocumentChange]);

  function handleOp(op: ResumeDraftOp) {
    // Apply optimistically — compute next state outside the updater so we can
    // call onDocumentChange synchronously without triggering setState-during-render.
    const next = applyOp(localDoc, op);
    setLocalDoc(next);
    setSaveStatus("unsaved");
    onDocumentChange?.(next);

    pendingOpsRef.current.push(op);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const ops = [...pendingOpsRef.current];
      pendingOpsRef.current = [];
      void flushPatch(next, ops);
    }, 700);
  }

  // Section drag-and-drop
  const dragSectionRef = useRef<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  function handleSectionDrop(targetId: string) {
    const srcId = dragSectionRef.current;
    if (!srcId || srcId === targetId) { setDragOverSectionId(null); return; }

    const ids = localDoc.sections.map((s) => s.id);
    const from = ids.indexOf(srcId);
    const to = ids.indexOf(targetId);
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, srcId);
    handleOp({ op: "reorderSections", sectionIds: next });
    dragSectionRef.current = null;
    setDragOverSectionId(null);
  }

  // Section move up/down via menu
  function handleSectionMove(sectionId: string, direction: "up" | "down") {
    const ids = localDoc.sections.map((s) => s.id);
    const idx = ids.indexOf(sectionId);
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= ids.length) return;
    const next = [...ids];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    handleOp({ op: "reorderSections", sectionIds: next });
  }

  async function handleExport() {
    setExporting(true);
    try {
      // Flush any pending ops first
      if (pendingOpsRef.current.length) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const ops = [...pendingOpsRef.current];
        pendingOpsRef.current = [];
        await flushPatch(localDoc, ops);
      }
      await onRequestExport(localDoc);
    } finally {
      setExporting(false);
    }
  }

  const enabledSections = [...localDoc.sections]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const allSections = [...localDoc.sections].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.editorPanel}>
      {/* Top bar */}
      <div className={styles.editorHead}>
        <div className={styles.editorStatus}>
          <div className={styles.saveIndicator}>
            <span className={styles.saveDot} data-status={saveStatus} />
            {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save failed" : "Unsaved"}
          </div>
          <span className={styles.docId} title={`Document ID: ${localDoc.id}`}>
            {localDoc.id.slice(0, 8)}…
          </span>
        </div>

        <p className={styles.editorMeta}>
          Click any text to edit · Enter adds a bullet · Drag sections to reorder
        </p>

        {headerActions && <div className={styles.editorHeaderActions}>{headerActions}</div>}
      </div>

      {/* Canvas */}
      <div className={styles.editorBody}>
        <div
          className={styles.sheetScaler}
          style={zoom !== 100 ? { transform: `scale(${zoom / 100})`, transformOrigin: "top center", marginBottom: `calc((${zoom / 100} - 1) * 11in)` } : undefined}
        >
          <div className={styles.docSheet} data-format={localDoc.format}>

            {/* Document header */}
            <header className={styles.docHeader}>
              <h1 className={styles.docName}>{localDoc.name}</h1>
              <p
                className={styles.docHeadline}
                contentEditable
                data-placeholder="Add a headline…"
                onBlur={(e) => {
                  const text = e.currentTarget.innerText.trim();
                  if (text !== localDoc.headline) {
                    handleOp({ op: "setHeadline", text });
                  }
                }}
                suppressContentEditableWarning
              >
                {localDoc.headline}
              </p>
              {localDoc.contactLines.length > 0 && (
                <div className={styles.docContact}>
                  {localDoc.contactLines.map((line, i) => {
                    const isEmail = line.includes("@");
                    const isUrl = line.includes("github.com") || line.includes("linkedin.com") || line.startsWith("http");
                    const href = isEmail ? `mailto:${line}` : isUrl ? (line.startsWith("http") ? line : `https://${line}`) : null;
                    return (
                      <span key={line}>
                        {i > 0 && <span className={styles.contactSep}> | </span>}
                        {href ? <a href={href} rel="noreferrer" target="_blank">{line.replace(/^https?:\/\//, "")}</a> : line}
                      </span>
                    );
                  })}
                </div>
              )}
            </header>

            {/* Sections */}
            <div className={styles.sectionList}>
              {allSections.map((section, index) => (
                <ResumeSectionEditor
                  isDragOver={dragOverSectionId === section.id}
                  isDragging={dragSectionRef.current === section.id}
                  isFirst={index === 0}
                  isLast={index === allSections.length - 1}
                  key={section.id}
                  onDragEnd={() => { dragSectionRef.current = null; setDragOverSectionId(null); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverSectionId(section.id); }}
                  onDragStart={() => { dragSectionRef.current = section.id; }}
                  onDrop={() => handleSectionDrop(section.id)}
                  onOp={(op) => {
                    // Intercept reorderSections with empty sectionIds (from "move up/down" menu)
                    // and replace with properly ordered IDs
                    if (op.op === "reorderSections" && !op.sectionIds.length) {
                      return; // handled by the move handler via sectionControls click above
                    }
                    handleOp(op);
                  }}
                  section={section}
                />
              ))}
            </div>

          </div>
        </div>

      </div>

      {/* Zoom controls — sits between canvas and export bar, not inside scroll area */}
      <div className={styles.zoomRow}>
        <button
          className={styles.floatingZoomBtn}
          onClick={() => setZoom((z) => (Math.max(75, z - 25) as ZoomLevel))}
          type="button"
        >
          −
        </button>
        <span className={styles.floatingZoomLabel}>{zoom}%</span>
        <button
          className={styles.floatingZoomBtn}
          onClick={() => setZoom((z) => (Math.min(150, z + 25) as ZoomLevel))}
          type="button"
        >
          +
        </button>
      </div>

      {/* Export bar — shows save status only; export is via "Compile Asset" in the left rail */}
      <ResumeExportBar
        document={localDoc}
        saveStatus={saveStatus}
      />
    </div>
  );
}
