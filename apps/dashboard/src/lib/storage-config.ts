/**
 * Which object-storage provider Payload uses for uploads, and whether its
 * configuration is complete enough to start.
 *
 * WHY THIS EXISTS
 *
 * The previous rule was one line:
 *
 *     const useGCS = Boolean(process.env.GCS_BUCKET && process.env.GCS_PROJECT_ID);
 *     const storagePlugins = useGCS ? [gcsStorage({...})] : [];
 *
 * An empty plugin list makes Payload write uploads to the CONTAINER FILESYSTEM.
 * On Cloud Run and on ECS/Fargate that filesystem is ephemeral, so every upload
 * survives only until the next deploy or task replacement — and nothing logs an
 * error, because from Payload's point of view nothing failed. The admin works,
 * the upload returns 200, the thumbnail renders, and the file is gone by
 * morning. That is silent, permanent data loss.
 *
 * So: in production, a missing or unusable storage configuration must STOP THE
 * PROCESS. Local disk is a development convenience and nothing more.
 *
 * Split out of payload.config.ts so the decision is unit-testable without
 * booting Payload or Mongo — the same reason media-cache.ts exists.
 */

/** Providers this application can actually persist to. */
export const STORAGE_PROVIDERS = ["gcs", "s3"] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

export type StorageResolution =
  | { provider: "gcs"; bucket: string; projectId: string; keyFilename?: string }
  | {
      provider: "s3";
      bucket: string;
      region: string;
      endpoint?: string;
      forcePathStyle: boolean;
      /** Omitted in normal deployments — see the credentials note below. */
      accessKeyId?: string;
      secretAccessKey?: string;
    }
  /** Development only. Reaching this in production is a bug, not a fallback. */
  | { provider: "local"; reason: string };

/** Thrown when the process must not continue. Distinct type so callers can tell it apart. */
export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}

export type StorageEnv = Record<string, string | undefined>;

export interface ResolveContext {
  /** NODE_ENV === "production" */
  isProduction: boolean;
  /**
   * True during `next build`. Secrets are injected at CONTAINER START, not at
   * build time, so throwing here would break the image build rather than catch
   * a misconfiguration. Mirrors the existing guard in assertProductionConfig().
   */
  isBuildPhase: boolean;
}

const has = (v: string | undefined): v is string => typeof v === "string" && v.trim().length > 0;

/**
 * Credentials are deliberately OPTIONAL for both providers.
 *
 * GCS on Cloud Run uses the attached service account via ADC; S3 on ECS uses
 * the task role via the AWS SDK's default credential chain. Both are the
 * *preferred* production setup, because no long-lived key exists to leak. An
 * explicit key is supported for local development and for platforms without an
 * attached identity — but its absence is never an error here, and this module
 * never reads, logs or returns a secret VALUE beyond handing it to the adapter.
 */
export function resolveStorageConfig(env: StorageEnv, ctx: ResolveContext): StorageResolution {
  const raw = (env.STORAGE_PROVIDER ?? "").trim().toLowerCase();
  const provider = (raw || "gcs") as StorageProvider;

  // An unrecognised provider throws in EVERY environment, including development.
  // A typo like STORAGE_PROVIDER=S3! must not quietly downgrade to local disk —
  // that is the exact failure mode this module exists to remove.
  if (!STORAGE_PROVIDERS.includes(provider)) {
    throw new StorageConfigError(
      `[storage] Unsupported STORAGE_PROVIDER "${env.STORAGE_PROVIDER}". ` +
        `Expected one of: ${STORAGE_PROVIDERS.join(", ")}.`,
    );
  }

  const missing: string[] = [];

  if (provider === "gcs") {
    if (!has(env.GCS_BUCKET)) missing.push("GCS_BUCKET");
    if (!has(env.GCS_PROJECT_ID)) missing.push("GCS_PROJECT_ID");
    if (missing.length === 0) {
      return {
        provider: "gcs",
        bucket: env.GCS_BUCKET!.trim(),
        projectId: env.GCS_PROJECT_ID!.trim(),
        keyFilename: has(env.GCS_KEY_FILENAME) ? env.GCS_KEY_FILENAME.trim() : undefined,
      };
    }
  } else {
    if (!has(env.S3_BUCKET)) missing.push("S3_BUCKET");
    if (!has(env.S3_REGION)) missing.push("S3_REGION");
    if (missing.length === 0) {
      return {
        provider: "s3",
        bucket: env.S3_BUCKET!.trim(),
        region: env.S3_REGION!.trim(),
        endpoint: has(env.S3_ENDPOINT) ? env.S3_ENDPOINT.trim() : undefined,
        // Needed by S3-compatible services (MinIO, R2). Real AWS S3 wants false.
        forcePathStyle: (env.S3_FORCE_PATH_STYLE ?? "").trim().toLowerCase() === "true",
        accessKeyId: has(env.S3_ACCESS_KEY_ID) ? env.S3_ACCESS_KEY_ID.trim() : undefined,
        secretAccessKey: has(env.S3_SECRET_ACCESS_KEY) ? env.S3_SECRET_ACCESS_KEY.trim() : undefined,
      };
    }
  }

  // ── configuration is incomplete ───────────────────────────────────────────
  const detail = `[storage] STORAGE_PROVIDER="${provider}" but required variable(s) are missing: ${missing.join(", ")}.`;

  // Build time never throws: the image is built without runtime secrets, so a
  // throw here breaks `next build` instead of catching a real misconfiguration.
  if (ctx.isBuildPhase) {
    return { provider: "local", reason: `${detail} Build phase — not enforced.` };
  }

  if (ctx.isProduction) {
    throw new StorageConfigError(
      `${detail} Refusing to start: uploads would be written to the container filesystem, ` +
        `which is EPHEMERAL on Cloud Run and ECS/Fargate, and every uploaded file would be ` +
        `silently destroyed on the next deploy. Set the variable(s) above, or set ` +
        `STORAGE_PROVIDER explicitly if you meant a different provider.`,
    );
  }

  return {
    provider: "local",
    reason: `${detail} Development only — uploads go to the local filesystem and are NOT persisted.`,
  };
}

/** One-line, value-free summary for the boot log. Never includes a credential. */
export function describeStorage(r: StorageResolution): string {
  switch (r.provider) {
    case "gcs":
      return `[storage] provider=gcs bucket=${r.bucket} project=${r.projectId} credentials=${r.keyFilename ? "key file" : "ADC (attached service account)"}`;
    case "s3":
      return `[storage] provider=s3 bucket=${r.bucket} region=${r.region}${r.endpoint ? ` endpoint=${r.endpoint}` : ""} credentials=${r.accessKeyId ? "explicit key" : "default chain (task role)"}`;
    case "local":
      return `[storage] provider=LOCAL DISK — ${r.reason}`;
  }
}
