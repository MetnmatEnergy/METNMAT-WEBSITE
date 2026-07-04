"use client";

import React from "react";
import { useDocumentInfo, useFormFields } from "@payloadcms/ui";

/**
 * Sidebar button on a Publication Request: creates a DRAFT article from the
 * proposal via the staff-gated /convert endpoint, then opens the new draft.
 * Never publishes anything.
 */
export default function ConvertSubmissionButton() {
  const { id } = useDocumentInfo();
  const converted = useFormFields(([fields]) => fields?.convertedArticle?.value as string | undefined);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!id) return null; // create view — nothing to convert yet

  const openArticle = (articleId: string) => {
    window.location.href = `/admin/collections/posts/${articleId}`;
  };

  const convert = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/blog-submissions/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; articleId?: string; error?: string };
      if (res.ok && j.articleId) {
        openArticle(String(j.articleId));
        return;
      }
      if (res.status === 409 && j.articleId) {
        openArticle(String(j.articleId));
        return;
      }
      setError(j.error || "Conversion failed — check server logs.");
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ margin: "8px 0 16px" }}>
      {converted ? (
        <button
          type="button"
          onClick={() => openArticle(String(converted))}
          style={{ ...btnStyle("var(--theme-elevation-150)"), color: "var(--theme-text)" }}
        >
          Open converted draft →
        </button>
      ) : (
        <button type="button" onClick={convert} disabled={busy} style={btnStyle("#d81f26", busy)}>
          {busy ? "Converting…" : "Convert to draft article"}
        </button>
      )}
      {error && <p style={{ color: "#d81f26", fontSize: 12, marginTop: 6 }}>{error}</p>}
      <p style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
        Creates a draft blog article from this proposal (nothing is published). Save any unsaved
        changes first.
      </p>
    </div>
  );
}

function btnStyle(bg: string, busy = false): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 14px",
    background: bg,
    color: "#fff",
    border: 0,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: busy ? "wait" : "pointer",
    opacity: busy ? 0.7 : 1,
  };
}
