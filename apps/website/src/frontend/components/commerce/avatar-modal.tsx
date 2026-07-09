"use client";

import * as React from "react";
import { ImageUp, Camera, Trash2, Loader2 } from "lucide-react";
import { AVATAR_ILLUSTRATIONS } from "@/frontend/lib/avatar-presets";
import { Avatar } from "./avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/frontend/components/ui/dialog";
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

const actionBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-input bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 disabled:opacity-60";

export function AvatarModal({
  open,
  onOpenChange,
  value,
  name,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  value?: string;
  name?: string;
  onSaved: (v: string) => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");
  const uploadRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);

  // The modal stays mounted (Radix only toggles the portal), so clear any stale
  // error/busy state each time it opens.
  React.useEffect(() => {
    if (open) {
      setErr("");
      setSaving(false);
    }
  }, [open]);

  async function save(next: string) {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/account/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        onSaved(next);
        // Sync the client site-header account menu instantly (no re-fetch needed).
        window.dispatchEvent(new CustomEvent("mm:avatar-updated", { detail: next }));
        onOpenChange(false);
      } else {
        setErr(data?.error || "Couldn't update your picture.");
      }
    } catch {
      setErr("Network error — please try again.");
    }
    setSaving(false);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("Please choose an image file.");
    if (file.size > 8 * 1024 * 1024) return setErr("That image is over 8 MB — choose a smaller one.");
    setSaving(true);
    setErr("");
    try {
      await save(await fileToAvatarDataUri(file));
    } catch {
      setErr("Couldn't read that image — try another.");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Profile picture</DialogTitle>
          <DialogDescription>Pick an illustration or add your own — it updates everywhere.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-1">
          <Avatar value={value} name={name} sizeClass="h-20 w-20" textClass="text-3xl" className="shadow" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => uploadRef.current?.click()} disabled={saving} className={actionBtn}>
            <ImageUp className="h-4 w-4" /> Upload from device
          </button>
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={saving} className={actionBtn}>
            <Camera className="h-4 w-4" /> Take a picture
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => save("")}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-brand disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          ) : null}
          <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} />
        </div>
        {err ? <p className="text-xs text-brand">{err}</p> : null}

        <div>
          <p className="text-xs font-medium text-muted-foreground">Browse illustrations</p>
          <div className="mt-2 grid max-h-[42vh] grid-cols-6 gap-2 overflow-y-auto pr-1 sm:grid-cols-8">
            {AVATAR_ILLUSTRATIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => save(a.id)}
                disabled={saving}
                aria-label={`Choose ${a.label} avatar`}
                aria-pressed={value === a.id}
                className={cn(
                  "aspect-square rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-60",
                  value === a.id && "ring-2 ring-brand ring-offset-2 ring-offset-surface",
                )}
              >
                <Avatar value={a.id} sizeClass="h-full w-full" />
              </button>
            ))}
          </div>
        </div>

        {saving ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
