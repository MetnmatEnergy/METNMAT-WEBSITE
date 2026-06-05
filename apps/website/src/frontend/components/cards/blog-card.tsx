import Link from "next/link";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import type { BlogPost } from "@/frontend/lib/placeholder";

function formatDate(iso: string) {
  // Render deterministically to avoid hydration mismatches.
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-brand/40"
    >
      <MediaPlaceholder className="aspect-video rounded-none border-0" label="Article" />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-widest text-brand-soft">
          <span>{post.category}</span>
          <span className="text-muted-foreground">{post.readingTime}</span>
        </div>
        <h3 className="mt-2 font-display text-lg font-semibold">{post.title}</h3>
        <p className="mt-2 flex-1 text-sm text-muted-foreground">{post.excerpt}</p>
        <span className="mt-4 text-xs text-muted-foreground">{formatDate(post.date)}</span>
      </div>
    </Link>
  );
}
