"use client";

import React from "react";
import { IMAGE_GUIDANCE, checkImageFile, formatBytes } from "../lib/image-guidance";

/**
 * Image requirements, stated before the file is chosen, and a live readout of
 * the one just picked — its pixel size, its weight, and whether it will pass.
 *
 * Rendered as a UI field at the top of the Media form, so it sits directly
 * under the dropzone in the create view, the document drawer AND the bulk-
 * upload drawer (all three render the collection form). Until now the only
 * place the rules existed was the refusal message after a failed save; staff
 * uploading a phone screenshot as a product photo found out by being told no.
 *
 * HOW IT SEES THE FILE. Payload's dropzone owns a hidden <input type="file">
 * and its own drag handlers, and exposes neither through a hook a field can
 * subscribe to. `change` events bubble from the input and `drop` is observed
 * at the capture phase before the dropzone stops it, so one document-level
 * listener of each covers click-to-select, drag-and-drop and paste-free URL
 * uploads alike (the last carries no File, so the readout stays quiet). The
 * category select is read the same way so the floor is judged only when
 * Product Image is chosen — which can happen before or after the file.
 *
 * Reads only. It never touches Payload's form state, so it cannot break an
 * upload; if a browser blocks image decoding the readout shows weight and
 * name and leaves the verdict to the server, which is the source of truth.
 */
type Picked = { name: string; bytes: number; width?: number; height?: number };

const CATEGORY_SELECTOR = '#field-category, [id="field-category"], .field-type.select[class*="category"]';

function readCategory(root: ParentNode): string {
  const sel = root.querySelector<HTMLElement>(CATEGORY_SELECTOR);
  // react-select renders the chosen label into .rs__single-value; a native
  // <select> (drawer fallbacks) carries value directly.
  const single = sel?.querySelector<HTMLElement>(".rs__single-value")?.textContent?.trim();
  if (single) return single;
  const native = sel?.querySelector<HTMLSelectElement>("select");
  return native?.selectedOptions?.[0]?.textContent?.trim() ?? "";
}

async function measure(file: File): Promise<Picked> {
  const base: Picked = { name: file.name, bytes: file.size };
  if (!file.type.startsWith("image/")) return base;
  try {
    if ("createImageBitmap" in window) {
      const bmp = await createImageBitmap(file);
      const out = { ...base, width: bmp.width, height: bmp.height };
      bmp.close();
      return out;
    }
  } catch {
    /* fall through to <img> decoding */
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ ...base, width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(base);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export default function UploadSizeHint() {
  const [picked, setPicked] = React.useState<Picked | null>(null);
  const [category, setCategory] = React.useState("");
  const host = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // Scope to the nearest form so a drawer's hint does not react to a file
    // picked in the page behind it.
    const form = host.current?.closest("form") ?? document;

    const onFile = (file: File | undefined) => {
      if (!file) return;
      void measure(file).then(setPicked);
    };
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (t?.type === "file") onFile(t.files?.[0]);
    };
    const onDrop = (e: DragEvent) => onFile(e.dataTransfer?.files?.[0]);
    const syncCategory = () => setCategory(readCategory(form));

    form.addEventListener("change", onChange, true);
    form.addEventListener("drop", onDrop as EventListener, true);
    // The category is a react-select; watch its rendered value rather than a
    // change event it does not emit on the wrapper.
    const mo = new MutationObserver(syncCategory);
    mo.observe(form, { subtree: true, childList: true, characterData: true });
    syncCategory();
    return () => {
      form.removeEventListener("change", onChange, true);
      form.removeEventListener("drop", onDrop as EventListener, true);
      mo.disconnect();
    };
  }, []);

  const g = IMAGE_GUIDANCE;
  const asProduct = /product image/i.test(category);
  const verdict = picked ? checkImageFile(picked, asProduct) : null;

  return (
    <div ref={host} className="mn-upload-hint" data-upload-hint>
      <p className="mn-upload-hint__title">Image size guide</p>
      <ul>
        <li>
          <strong>Product photos:</strong> shortest side at least {g.productMinShortSide}px — best is{" "}
          {g.productBest.width} × {g.productBest.height}px (4:3). Smaller files are refused.
        </li>
        <li>
          <strong>Banners, logos, team &amp; article images:</strong> any size; landscape banners look best at{" "}
          {g.productBest.width}px wide.
        </li>
        <li>
          {g.formats.join(", ")} · up to {g.maxMb} MB each. Keep product photos under {g.warnKb} KB where you can — the
          shop grid loads faster on phones.
        </li>
      </ul>
      {picked && verdict && (
        <div className="mn-upload-hint__file" aria-live="polite">
          <span className="mn-upload-hint__name">{picked.name}</span>
          <span className="mn-upload-hint__meta">
            {picked.width && picked.height ? `${picked.width} × ${picked.height}px · ` : ""}
            {formatBytes(picked.bytes)}
          </span>
          <span
            className={
              verdict.level === "ok" ? "mn-upload-hint__ok" : verdict.level === "warn" ? "mn-upload-hint__warn" : "mn-upload-hint__bad"
            }
          >
            {verdict.level === "ok" ? "✓ " : verdict.level === "warn" ? "⚠ " : "✕ "}
            {verdict.message}
            {!asProduct && picked.width && picked.height && Math.min(picked.width, picked.height) < g.productMinShortSide
              ? ` (Too small for a Product Image — choose that category only for photos with a shortest side of ${g.productMinShortSide}px or more.)`
              : ""}
          </span>
        </div>
      )}
    </div>
  );
}
