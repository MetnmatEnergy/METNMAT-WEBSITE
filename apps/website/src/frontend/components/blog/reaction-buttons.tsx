"use client";

/**
 * Like / Dislike with optimistic UI backed by the concurrency-safe server
 * upsert. One reaction per visitor (server-enforced); clicking the active
 * button removes the reaction. Announces results to screen readers and uses
 * aria-pressed for state.
 */
import React from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

type State = {
  reaction: "LIKE" | "DISLIKE" | null;
  likeCount: number;
  dislikeCount: number;
};

export function ReactionButtons({
  articleId,
  initialLikes,
  initialDislikes,
}: {
  articleId: string;
  initialLikes: number;
  initialDislikes: number;
}) {
  const [state, setState] = React.useState<State>({
    reaction: null,
    likeCount: initialLikes,
    dislikeCount: initialDislikes,
  });
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  // Hydrate the visitor's current reaction + fresh counts.
  React.useEffect(() => {
    let alive = true;
    fetch(`/api/blog/reactions?articleId=${articleId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: (State & { ok?: boolean }) | null) => {
        if (alive && j && j.ok !== false) {
          setState({
            reaction: j.reaction ?? null,
            likeCount: j.likeCount ?? 0,
            dislikeCount: j.dislikeCount ?? 0,
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [articleId]);

  const send = async (clicked: "LIKE" | "DISLIKE") => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const target = state.reaction === clicked ? "NONE" : clicked;
    try {
      const post = () =>
        fetch("/api/blog/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, reaction: target }),
        });
      let res = await post();
      if (res.status === 428) {
        // First visit: the server just issued the identity cookie — retry once.
        res = await post();
      }
      const j = (await res.json().catch(() => null)) as (State & { ok?: boolean; error?: string }) | null;
      if (res.ok && j && j.ok !== false) {
        setState({
          reaction: (j.reaction as State["reaction"]) ?? null,
          likeCount: j.likeCount ?? 0,
          dislikeCount: j.dislikeCount ?? 0,
        });
        setMessage(
          target === "NONE" ? "Reaction removed." : target === "LIKE" ? "Marked as helpful." : "Feedback recorded.",
        );
      } else {
        setMessage(j?.error || "Could not save your reaction — please try again.");
      }
    } catch {
      setMessage("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const btn = (kind: "LIKE" | "DISLIKE") => {
    const isActive = state.reaction === kind;
    const Icon = kind === "LIKE" ? ThumbsUp : ThumbsDown;
    const count = kind === "LIKE" ? state.likeCount : state.dislikeCount;
    const label = kind === "LIKE" ? "Like this article" : "Dislike this article";
    return (
      <button
        type="button"
        onClick={() => send(kind)}
        disabled={busy}
        aria-pressed={isActive}
        aria-label={`${label} (${count})`}
        className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-60 ${
          isActive
            ? "border-brand bg-brand/10 text-brand-soft"
            : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground"
        }`}
      >
        <Icon aria-hidden className="h-4 w-4" />
        <span>{count}</span>
      </button>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        {btn("LIKE")}
        {btn("DISLIKE")}
      </div>
      <p role="status" aria-live="polite" className="mt-1 min-h-4 text-xs text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
