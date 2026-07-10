"use client";

import * as React from "react";
import { Camera, Loader2, RefreshCw, RotateCcw, Check, X } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { cn } from "@/frontend/lib/utils";

/** True only where an in-page camera can actually run: needs the API AND a secure context. */
export function cameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof window !== "undefined" &&
    window.isSecureContext === true &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * Grab the current video frame as a 256×256 JPEG data URI — centre-cropped to a
 * square, matching what the upload path produces. The front-camera preview is
 * mirrored (that's what people expect of a selfie), so the capture is mirrored
 * too: what you saw is what you get.
 */
function frameToAvatarDataUri(video: HTMLVideoElement, mirror: boolean): string {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-2d-context");

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const m = Math.min(vw, vh);

  if (mirror) {
    ctx.translate(S, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, (vw - m) / 2, (vh - m) / 2, m, m, 0, 0, S, S);
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Turn a getUserMedia rejection into something a person can act on. */
function explain(e: unknown): string {
  switch ((e as DOMException)?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was blocked. Allow it in your browser's site settings, then try again — or upload a photo instead.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera found on this device. You can upload a photo instead.";
    case "NotReadableError":
    case "AbortError":
      return "Your camera is in use by another app. Close it and try again.";
    default:
      return "Couldn't start the camera. You can upload a photo instead.";
  }
}

type Phase = "starting" | "live" | "review" | "error";

/**
 * In-page camera capture. Works anywhere `getUserMedia` does — laptop webcam,
 * tablet, phone (front or back). Requires `Permissions-Policy: camera=(self)`
 * (see next.config.mjs), or the browser rejects the request before even prompting.
 *
 * The stream is stopped the moment it isn't needed — after a shot, on cancel, and
 * on unmount — so the camera indicator never lingers.
 */
export function CameraCapture({
  onCapture,
  onCancel,
  busy,
}: {
  onCapture: (dataUri: string) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const [phase, setPhase] = React.useState<Phase>("starting");
  const [error, setError] = React.useState("");
  const [shot, setShot] = React.useState("");
  const [facing, setFacing] = React.useState<"user" | "environment">("user");
  const [canSwitch, setCanSwitch] = React.useState(false);
  // Bumping this re-runs the stream effect — that's "retake" and "try again",
  // without a second copy of the getUserMedia logic.
  const [attempt, setAttempt] = React.useState(0);

  // Open the stream on mount, on camera flip, and on each retry. The cleanup is
  // what guarantees the camera light goes out.
  React.useEffect(() => {
    let cancelled = false;
    const stopTracks = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    (async () => {
      setPhase("starting");
      setError("");
      stopTracks();
      try {
        // `ideal` rather than `exact`: a laptop with a single webcam should open,
        // not fail an unsatisfiable facingMode constraint.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {
            /* autoplay policy — the stream is live and will paint regardless */
          });
        }
        if (cancelled) return;
        setPhase("live");

        // Only offer the flip control when a second camera really exists. Device
        // labels/kinds are only reliable once permission has been granted.
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (e) {
        if (cancelled) return;
        setError(explain(e));
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      stopTracks();
    };
  }, [facing, attempt]);

  const take = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return; // metadata not in yet — nothing to grab
    try {
      setShot(frameToAvatarDataUri(video, facing === "user"));
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setPhase("review");
    } catch {
      setError("Couldn't capture that frame — please try again.");
      setPhase("error");
    }
  };

  const restart = () => {
    setShot("");
    setAttempt((a) => a + 1);
  };

  const mirrored = facing === "user";

  return (
    <div className="grid gap-3">
      <div className="relative mx-auto aspect-square w-full max-w-[18rem] overflow-hidden rounded-2xl border border-border bg-black">
        {/* `playsInline` is required or iOS Safari hijacks this into fullscreen. */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Camera preview"
          style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
          className={cn("h-full w-full object-cover", phase === "review" && "invisible")}
        />

        {shot && phase === "review" ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URI, not a remote asset
          <img src={shot} alt="The photo you just took" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}

        {phase === "starting" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-xs">Starting camera…</p>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted p-4">
            <p className="text-center text-xs leading-relaxed text-muted-foreground">{error}</p>
          </div>
        ) : null}
      </div>

      {/* Announce outcomes to screen readers without stealing focus. */}
      <p aria-live="polite" className="sr-only">
        {phase === "error" ? error : phase === "review" ? "Photo captured" : ""}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {phase === "review" ? (
          <>
            <Button type="button" size="sm" onClick={() => onCapture(shot)} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {busy ? "Saving…" : "Use photo"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={restart} disabled={busy}>
              <RotateCcw className="h-4 w-4" /> Retake
            </Button>
          </>
        ) : (
          <>
            {phase === "error" ? (
              <Button type="button" size="sm" variant="outline" onClick={restart}>
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={take} disabled={phase !== "live" || busy}>
                <Camera className="h-4 w-4" /> Capture
              </Button>
            )}
            {canSwitch && phase === "live" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                disabled={busy}
              >
                <RefreshCw className="h-4 w-4" /> Switch camera
              </Button>
            ) : null}
          </>
        )}

        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          <X className="h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}
