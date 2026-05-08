"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/common/ToastContext";

import styles from "./StoryBankEditor.module.css";

interface StoryBankEditorProps {
  initialContent: string;
  path: string;
}

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

interface ListBlock {
  kind: "ul" | "ol";
  items: Array<{ text: string; children?: ListBlock }>;
}

function StoryBankPreview({ content }: { content: string }) {
  const stripped = content.replace(/<!--[\s\S]*?-->/g, "");
  const lines = stripped.split("\n");
  const blocks: ReactNode[] = [];
  let paragraphLines: string[] = [];
  let ulBuffer: Array<{ text: string; sub: string[] }> = [];
  let olBuffer: Array<{ text: string; sub: string[] }> = [];
  let key = 0;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const text = paragraphLines.join(" ").trim();
    if (text) {
      blocks.push(<p key={key++}>{renderInline(text)}</p>);
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (ulBuffer.length) {
      blocks.push(
        <ul key={key++}>
          {ulBuffer.map((item, i) => (
            <li key={i}>
              {renderInline(item.text)}
              {item.sub.length ? (
                <ul>
                  {item.sub.map((s, j) => (
                    <li key={j}>{renderInline(s)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>,
      );
      ulBuffer = [];
    }
    if (olBuffer.length) {
      blocks.push(
        <ol key={key++}>
          {olBuffer.map((item, i) => (
            <li key={i}>
              {renderInline(item.text)}
              {item.sub.length ? (
                <ul>
                  {item.sub.map((s, j) => (
                    <li key={j}>{renderInline(s)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>,
      );
      olBuffer = [];
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) {
      flushAll();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length + 1, 6);
      const Tag = `h${level}` as "h2" | "h3" | "h4" | "h5" | "h6";
      blocks.push(<Tag key={key++}>{renderInline(heading[2].trim())}</Tag>);
      continue;
    }
    const subBullet = /^\s{2,}-\s+(.+)$/.exec(line);
    if (subBullet) {
      const lastUl = ulBuffer.length ? ulBuffer[ulBuffer.length - 1] : null;
      const lastOl = olBuffer.length ? olBuffer[olBuffer.length - 1] : null;
      if (lastOl) {
        lastOl.sub.push(subBullet[1].trim());
        continue;
      }
      if (lastUl) {
        lastUl.sub.push(subBullet[1].trim());
        continue;
      }
    }
    const ulMatch = /^-\s+(.+)$/.exec(line);
    if (ulMatch) {
      flushParagraph();
      if (olBuffer.length) flushList();
      ulBuffer.push({ text: ulMatch[1].trim(), sub: [] });
      continue;
    }
    const olMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (olMatch) {
      flushParagraph();
      if (ulBuffer.length) flushList();
      olBuffer.push({ text: olMatch[1].trim(), sub: [] });
      continue;
    }
    flushList();
    paragraphLines.push(line.trim());
  }
  flushAll();

  if (!blocks.length) {
    return <p className={styles.emptyPreview}>Story bank is empty. Switch to edit mode to add stories.</p>;
  }

  return <div className={styles.preview}>{blocks}</div>;
}

export default function StoryBankEditor({
  initialContent,
  path,
}: StoryBankEditorProps) {
  const router = useRouter();
  const notify = useToast();
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"preview" | "edit">("preview");

  const dirty = content !== initialContent;

  async function handleSave() {
    setSaving(true);

    try {
      const response = await fetch("/api/interview-prep/story-bank", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save the story bank.");
      }

      notify({
        title: "Story bank saved",
        description: "Your interview story bank has been updated in the backend workspace.",
        dismissAfter: 4000,
      });
      router.refresh();
    } catch (error) {
      notify({
        title: "Save failed",
        description:
          error instanceof Error ? error.message : "Unable to save the interview story bank.",
        tone: "error",
        dismissAfter: null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headCopy}>
          <p className={styles.eyebrow}>Story bank</p>
          <h2>Edit the reusable STAR+R bank from the browser.</h2>
          <p className={styles.lead}>
            This is the reusable layer the backend keeps reaching for when it builds prep briefs.
            Tighten the stories here and the rest of the workspace gets sharper with it.
          </p>
        </div>
        <div className={styles.meta}>
          <span className={styles.path}>{path}</span>
          <span className={styles.status}>{dirty ? "Unsaved changes" : "In sync with workspace"}</span>
          <div className={styles.modeToggle} role="tablist" aria-label="Story bank view mode">
            <button
              aria-selected={mode === "preview"}
              className={styles.modeButton}
              data-active={mode === "preview"}
              onClick={() => setMode("preview")}
              role="tab"
              type="button"
            >
              Preview
            </button>
            <button
              aria-selected={mode === "edit"}
              className={styles.modeButton}
              data-active={mode === "edit"}
              onClick={() => setMode("edit")}
              role="tab"
              type="button"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      <p className={styles.copy}>
        Keep your strongest examples here so future interview prep can map questions back to proven
        work rather than generic claims.
      </p>

      <div className={styles.editorShell}>
        {mode === "edit" ? (
          <>
            <div className={styles.editorNote}>
              Write in plain language first. The generator can translate tone later, but it needs
              concrete situations, actions, and outcomes to work from.
            </div>
            <textarea
              className={styles.editor}
              onChange={(event) => setContent(event.target.value)}
              rows={18}
              value={content}
            />
          </>
        ) : (
          <StoryBankPreview content={content} />
        )}
      </div>

      <div className={styles.actions}>
        <span className={styles.actionHint}>
          Saves directly into the backend workspace and refreshes the prep route.
        </span>
        <button
          className={styles.saveButton}
          disabled={!dirty || saving}
          onClick={() => void handleSave()}
          type="button"
        >
          {saving ? "Saving…" : "Save story bank"}
        </button>
        <button
          className={styles.resetButton}
          disabled={!dirty || saving}
          onClick={() => setContent(initialContent)}
          type="button"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
