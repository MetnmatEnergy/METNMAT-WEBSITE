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

export type UploadItem = {
  key: string;
  name: string;
  size: number;
  type: string;
  progress: number; // 0..100
  status: "uploading" | "done" | "error";
  id?: string; // dashboard doc id once stored
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
      let res: { ok?: boolean; id?: string; error?: string } = {};
      try {
        res = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300 && res.id) {
        patch(key, { status: "done", progress: 100, id: res.id, error: undefined });
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

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setFileError(null);
    setItems((current) => {
      const next = [...current];
      let totalBytes = current.reduce((s, i) => s + i.size, 0);
      for (const f of Array.from(list)) {
        if (next.length >= MAX_FILES) {
          setFileError(`You can attach up to ${MAX_FILES} files.`);
          break;
        }
        if (f.size > MAX_FILE_MB * 1024 * 1024) {
          setFileError(`"${f.name}" is larger than ${MAX_FILE_MB} MB.`);
          continue;
        }
        if (!/^(application\/pdf|image\/)/.test(f.type || "")) {
          setFileError("Only PDF or image files are allowed.");
          continue;
        }
        if (current.some((i) => i.name === f.name && i.size === f.size)) continue;
        totalBytes += f.size;
        if (totalBytes > MAX_TOTAL_MB * 1024 * 1024) {
          setFileError(`Total attachments exceed ${MAX_TOTAL_MB} MB.`);
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
        // Kick off the upload right after state commits.
        setTimeout(() => startUpload(key, f), 0);
      }
      return next;
    });
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
                    <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-500">
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
