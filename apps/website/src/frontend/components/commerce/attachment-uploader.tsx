"use client";

import * as React from "react";
import {
  X,
  Paperclip,
  Camera,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCw,
} from "lucide-react";
import dynamic from "next/dynamic";

/**
 * framer-motion, off EVERY route.
 *
 * The quote drawer and quote modal are both mounted in the root layout, both
 * import this uploader, and this uploader imported ProgressiveFluxLoader — which
 * imports framer-motion. So ~37 KB gzip of animation library was in the shared
 * bundle of every page on the site, to animate a progress bar that only appears
 * while a customer is uploading a file.
 *
 * Deferred to the moment an upload actually starts. Nothing renders it until
 * `items.length > 0`, so on most visits it is never fetched at all.
 */
const ProgressiveFluxLoader = dynamic(
  () => import("@/frontend/components/ui/progressive-flux-loader").then((m) => m.ProgressiveFluxLoader),
  {
    ssr: false,
    // The upload is already under way; a plain bar until the animated one
    // arrives is better than a gap where the progress indicator should be.
    loading: () => <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" />,
  }
);

/** Phase labels for the overall upload progress bar. */
const UPLOAD_PHASES = [
  { at: 0, label: "uploading" },
  { at: 85, label: "processing" },
  { at: 100, label: "complete" },
];

export type UploadItem = {
  key: string;
  name: string;
  size: number;
  type: string;
  progress: number; // 0..100
  status: "uploading" | "done" | "error";
  id?: string; // dashboard doc id once stored
  /** Signed proof this upload is ours — submitted instead of the bare id. */
  grant?: string;
  error?: string;
  previewUrl?: string;
};

const MAX_FILES = 5;
const MAX_FILE_MB = 10;
const MAX_TOTAL_MB = 20;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** True on phones/tablets, where the file input's camera `capture` works. */
function isMobileOrTablet(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const mobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const coarse =
    typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse)")?.matches &&
    navigator.maxTouchPoints > 0;
  return mobileUA || iPadOS || Boolean(coarse);
}

/**
 * Customer file attachments with a LIVE upload animation. Each file is uploaded
 * to the dashboard the moment it's added (real XHR progress bar → green check),
 * so it lands in the dashboard + database immediately. The parent reads the
 * stored ids via onChange and submits them with the form.
 */
export function AttachmentUploader({
  source = "quote",
  onChange,
}: {
  source?: string;
  onChange?: (items: UploadItem[]) => void;
}) {
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [cameraNotice, setCameraNotice] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const filesRef = React.useRef<Record<string, File>>({});
  const xhrsRef = React.useRef<Record<string, XMLHttpRequest>>({});
  const keyRef = React.useRef(0);

  React.useEffect(() => {
    onChange?.(items);
  }, [items, onChange]);

  // Clean up object URLs + in-flight uploads on unmount.
  React.useEffect(() => {
    const xhrs = xhrsRef.current;
    return () => {
      Object.values(xhrs).forEach((x) => x.abort());
      setItems((prev) => {
        prev.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
        return prev;
      });
    };
  }, []);

  function patch(key: string, next: Partial<UploadItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...next } : it)));
  }

  function startUpload(key: string, file: File) {
    const xhr = new XMLHttpRequest();
    xhrsRef.current[key] = xhr;
    xhr.open("POST", "/api/quote/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        patch(key, { progress: Math.min(99, Math.max(5, pct)) });
      }
    };
    xhr.onload = () => {
      delete xhrsRef.current[key];
      let res: { ok?: boolean; id?: string; grant?: string; error?: string } = {};
      try {
        res = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      // Without a grant the file cannot be submitted, so treat a grant-less
      // response as a failed upload rather than showing a green tick for
      // something that will be silently dropped at submit.
      if (xhr.status >= 200 && xhr.status < 300 && res.id && res.grant) {
        patch(key, {
          status: "done",
          progress: 100,
          id: res.id,
          grant: res.grant,
          error: undefined,
        });
      } else {
        patch(key, { status: "error", error: res.error || "Upload failed" });
      }
    };
    xhr.onerror = () => {
      delete xhrsRef.current[key];
      patch(key, { status: "error", error: "Network error" });
    };
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("source", source);
    xhr.send(form);
  }

  /*
   * Everything here used to run INSIDE a setItems updater, which also called
   * setFileError, mutated keyRef, created object URLs and scheduled the upload.
   * A state updater must be a pure function of its argument: React is free to
   * discard a render and run it again, and does so deliberately under
   * StrictMode. Every extra invocation minted another key, leaked another
   * object URL, and scheduled a SECOND upload of the same file — a duplicate
   * PUT against the media bucket for one user action.
   *
   * The list is now computed first, from the committed `items`, and the state
   * write is a plain value. addFiles only ever runs from a file-picker change
   * or a drop, so reading committed state cannot miss a concurrent update.
   * The uploads still start on a macrotask after the commit, exactly as before.
   */
  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setFileError(null);

    const current = items;
    const next = [...current];
    const queued: Array<{ key: string; file: File }> = [];
    let error: string | null = null;
    let totalBytes = current.reduce((s, i) => s + i.size, 0);

    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        error = `You can attach up to ${MAX_FILES} files.`;
        break;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        error = `"${f.name}" is larger than ${MAX_FILE_MB} MB.`;
        continue;
      }
      if (!/^(application\/pdf|image\/)/.test(f.type || "")) {
        error = "Only PDF or image files are allowed.";
        continue;
      }
      if (current.some((i) => i.name === f.name && i.size === f.size)) continue;
      totalBytes += f.size;
      if (totalBytes > MAX_TOTAL_MB * 1024 * 1024) {
        error = `Total attachments exceed ${MAX_TOTAL_MB} MB.`;
        break;
      }
      keyRef.current += 1;
      const key = `f${keyRef.current}`;
      filesRef.current[key] = f;
      next.push({
        key,
        name: f.name,
        size: f.size,
        type: f.type,
        progress: 5,
        status: "uploading",
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      });
      queued.push({ key, file: f });
    }

    if (error) setFileError(error);
    if (queued.length === 0) return;

    setItems(next);
    // Kick off the uploads right after state commits.
    for (const { key, file } of queued) setTimeout(() => startUpload(key, file), 0);
  }

  function removeItem(key: string) {
    const x = xhrsRef.current[key];
    if (x) {
      x.abort();
      delete xhrsRef.current[key];
    }
    delete filesRef.current[key];
    setItems((prev) => {
      const it = prev.find((i) => i.key === key);
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((i) => i.key !== key);
    });
    setFileError(null);
  }

  function retry(key: string) {
    const f = filesRef.current[key];
    if (!f) return;
    patch(key, { status: "uploading", progress: 5, error: undefined });
    startUpload(key, f);
  }

  // Overall upload progress across all attachments (done counts as 100%), used
  // to drive the flux progress bar while any file is still uploading.
  const uploadingCount = items.filter((i) => i.status === "uploading").length;
  const overallProgress = items.length
    ? Math.round(
        items.reduce((sum, i) => sum + (i.status === "done" ? 100 : i.progress), 0) /
          items.length,
      )
    : 0;

  return (
    <div className="rounded-xl border border-dashed border-input bg-surface/60 p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:border-brand/40 hover:text-brand"
        >
          <Paperclip className="h-4 w-4" /> Attach files
        </button>
        <button
          type="button"
          onClick={() => {
            if (isMobileOrTablet()) cameraInputRef.current?.click();
            else setCameraNotice(true);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:border-brand/40 hover:text-brand"
        >
          <Camera className="h-4 w-4" /> Take photo
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        PDF or images · up to {MAX_FILES} files · {MAX_FILE_MB} MB each. Uploads as soon as you add
        them.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Overall upload progress — animated flux bar while any file is uploading. */}
      {uploadingCount > 0 && (
        <div className="mt-3">
          <ProgressiveFluxLoader
            value={overallProgress}
            phases={UPLOAD_PHASES}
            showLabel={false}
            className="max-w-none gap-0"
            barClassName="h-2.5"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Uploading {uploadingCount} file{uploadingCount === 1 ? "" : "s"}… {overallProgress}%
          </p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((it) => {
            const isPdf = it.type === "application/pdf" || /\.pdf$/i.test(it.name);
            return (
              <li
                key={it.key}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {/* Thumb / icon */}
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {it.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : isPdf ? (
                    <FileText className="h-4 w-4 text-brand" />
                  ) : (
                    <FileText className="h-4 w-4 text-brand" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{it.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatBytes(it.size)}
                    </span>
                  </span>

                  {/* Progress / status row */}
                  {it.status === "uploading" && (
                    <span className="mt-1 block">
                      <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
                          style={{ width: `${it.progress}%` }}
                        />
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Uploading… {it.progress}%
                      </span>
                    </span>
                  )}
                  {it.status === "done" && (
                    <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded
                    </span>
                  )}
                  {it.status === "error" && (
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-brand">
                      <AlertCircle className="h-3.5 w-3.5" /> {it.error || "Failed"}
                      <button
                        type="button"
                        onClick={() => retry(it.key)}
                        className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                      >
                        <RotateCw className="h-3 w-3" /> Retry
                      </button>
                    </span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => removeItem(it.key)}
                  aria-label={`Remove ${it.name}`}
                  className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {fileError && <p className="mt-2 text-xs text-brand">{fileError}</p>}

      {/* Camera-on-desktop notice */}
      {cameraNotice && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4"
          onClick={() => setCameraNotice(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-border bg-background p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Camera className="h-8 w-8" />
            </span>
            <h3 className="mt-5 font-display text-xl font-bold">Use your phone or tablet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Camera capture isn&apos;t available on desktop. Open this page on your phone or tablet
              to take a photo — or use <span className="font-medium text-foreground">Attach files</span>{" "}
              to upload an existing image or PDF.
            </p>
            <button
              type="button"
              onClick={() => setCameraNotice(false)}
              className="mt-6 w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
