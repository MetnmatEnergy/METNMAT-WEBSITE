"use client";

import * as React from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { AVATAR_ILLUSTRATIONS } from "@/frontend/lib/avatar-presets";
import { Avatar } from "./avatar";
import { cn } from "@/frontend/lib/utils";

/** Read a chosen image file, cover-crop to a 256×256 JPEG data URI (small + square). */
function fileToAvatarDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const S = 256;
      const canvas = document.createElement("canvas");
      canvas.width = S;
      canvas.height = S;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no-2d-context"));
      const m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad-image"));
    };
    img.src = url;
  });
}

export function AvatarPicker({
  value,
  name,
  onChange,
}: {
  value?: string;
  name?: string;
  onChange: (v: string) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("Please choose an image file.");
    if (file.size > 8 * 1024 * 1024) return setErr("That image is over 8 MB — choose a smaller one.");
    setBusy(true);
    setErr("");
    try {
      onChange(await fileToAvatarDataUri(file));
    } catch {
      setErr("Couldn't read that image — try another.");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-4">
        <Avatar value={value} name={name} sizeClass="h-14 w-14" textClass="text-2xl" className="shadow-sm" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Profile picture</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/60 disabled:opacity-60"
            >
              <ImageUp className="h-3.5 w-3.5" /> {busy ? "Processing…" : "Upload photo"}
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setErr("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-brand"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            ) : null}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
      {err ? <p className="mt-2 text-xs text-brand">{err}</p> : null}

      <p className="mt-4 text-xs font-medium text-muted-foreground">Or pick an illustration</p>
      <div className="mt-2 grid grid-cols-6 gap-2 sm:grid-cols-8">
        {AVATAR_ILLUSTRATIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              onChange(a.id);
              setErr("");
            }}
            aria-label={`Choose ${a.label} avatar`}
            aria-pressed={value === a.id}
            className={cn(
              "aspect-square rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-brand/60",
              value === a.id && "ring-2 ring-brand ring-offset-2 ring-offset-surface",
            )}
          >
            <Avatar value={a.id} sizeClass="h-full w-full" />
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Illustrations by{" "}
        <a
          href="https://openmoji.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          OpenMoji
        </a>{" "}
        · CC BY-SA 4.0
      </p>
    </div>
  );
}
