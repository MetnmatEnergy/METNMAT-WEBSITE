import { describe, it, expect } from "vitest";
import {
  resolveStorageConfig,
  describeStorage,
  StorageConfigError,
  STORAGE_PROVIDERS,
} from "../apps/dashboard/src/lib/storage-config";

/**
 * The behaviour under test is a data-loss guard.
 *
 * Payload writes uploads to the CONTAINER FILESYSTEM when no storage adapter is
 * configured. On Cloud Run and ECS/Fargate that filesystem is ephemeral, so the
 * upload returns 200, the thumbnail renders, and the file is destroyed on the
 * next deploy — with nothing logged. Most of these tests exist to keep that path
 * unreachable in production.
 */
const PROD = { isProduction: true, isBuildPhase: false };
const DEV = { isProduction: false, isBuildPhase: false };
const BUILD = { isProduction: true, isBuildPhase: true };

const GCS = { GCS_BUCKET: "metnmat-media-prod", GCS_PROJECT_ID: "metnmat-website" };
const S3 = { STORAGE_PROVIDER: "s3", S3_BUCKET: "metnmat-media", S3_REGION: "ap-south-1" };

describe("resolveStorageConfig — valid GCS", () => {
  it("defaults to GCS when STORAGE_PROVIDER is unset, so production is unchanged", () => {
    const r = resolveStorageConfig(GCS, PROD);
    expect(r.provider).toBe("gcs");
  });

  it("carries bucket and project through", () => {
    const r = resolveStorageConfig(GCS, PROD);
    expect(r).toMatchObject({ provider: "gcs", bucket: "metnmat-media-prod", projectId: "metnmat-website" });
  });

  it("leaves keyFilename undefined so the adapter uses ADC", () => {
    const r = resolveStorageConfig(GCS, PROD);
    expect(r.provider === "gcs" && r.keyFilename).toBeUndefined();
  });

  it("passes an explicit key file through when one is given", () => {
    const r = resolveStorageConfig({ ...GCS, GCS_KEY_FILENAME: "/secrets/gcs.json" }, PROD);
    expect(r.provider === "gcs" && r.keyFilename).toBe("/secrets/gcs.json");
  });

  it("accepts an explicit STORAGE_PROVIDER=gcs, case-insensitively", () => {
    expect(resolveStorageConfig({ ...GCS, STORAGE_PROVIDER: "GCS" }, PROD).provider).toBe("gcs");
  });
});

describe("resolveStorageConfig — missing GCS config", () => {
  it("THROWS in production rather than falling back to local disk", () => {
    expect(() => resolveStorageConfig({}, PROD)).toThrow(StorageConfigError);
  });

  it("names the missing variables in the error", () => {
    expect(() => resolveStorageConfig({}, PROD)).toThrow(/GCS_BUCKET.*GCS_PROJECT_ID/);
  });

  it("explains WHY it refuses — ephemeral filesystem, silent data loss", () => {
    expect(() => resolveStorageConfig({}, PROD)).toThrow(/EPHEMERAL|silently destroyed/i);
  });

  it("throws when only one of the pair is set", () => {
    expect(() => resolveStorageConfig({ GCS_BUCKET: "b" }, PROD)).toThrow(StorageConfigError);
    expect(() => resolveStorageConfig({ GCS_PROJECT_ID: "p" }, PROD)).toThrow(StorageConfigError);
  });

  it("treats whitespace-only as missing", () => {
    expect(() => resolveStorageConfig({ GCS_BUCKET: "   ", GCS_PROJECT_ID: "p" }, PROD)).toThrow(StorageConfigError);
  });
});

describe("resolveStorageConfig — valid S3", () => {
  it("selects S3 only when explicitly asked", () => {
    expect(resolveStorageConfig(S3, PROD).provider).toBe("s3");
  });

  it("does NOT select S3 merely because S3 vars are present — GCS stays the default", () => {
    const r = resolveStorageConfig({ ...GCS, S3_BUCKET: "b", S3_REGION: "ap-south-1" }, PROD);
    expect(r.provider).toBe("gcs");
  });

  it("omits credentials so the AWS default chain (ECS task role) is used", () => {
    const r = resolveStorageConfig(S3, PROD);
    expect(r.provider === "s3" && r.accessKeyId).toBeUndefined();
    expect(r.provider === "s3" && r.secretAccessKey).toBeUndefined();
  });

  it("passes explicit credentials through when both are supplied", () => {
    const r = resolveStorageConfig({ ...S3, S3_ACCESS_KEY_ID: "AKIA_x", S3_SECRET_ACCESS_KEY: "s" }, PROD);
    expect(r.provider === "s3" && r.accessKeyId).toBe("AKIA_x");
  });

  it("supports S3-compatible endpoints with path-style addressing", () => {
    const r = resolveStorageConfig(
      { ...S3, S3_ENDPOINT: "https://minio.internal", S3_FORCE_PATH_STYLE: "true" },
      PROD,
    );
    expect(r).toMatchObject({ provider: "s3", endpoint: "https://minio.internal", forcePathStyle: true });
  });

  it("defaults forcePathStyle to false for real AWS S3", () => {
    expect(resolveStorageConfig(S3, PROD)).toMatchObject({ forcePathStyle: false });
  });
});

describe("resolveStorageConfig — missing S3 config", () => {
  it("THROWS in production when the bucket or region is absent", () => {
    expect(() => resolveStorageConfig({ STORAGE_PROVIDER: "s3" }, PROD)).toThrow(StorageConfigError);
  });

  it("names the missing S3 variables specifically, not the GCS ones", () => {
    try {
      resolveStorageConfig({ STORAGE_PROVIDER: "s3" }, PROD);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).toMatch(/S3_BUCKET.*S3_REGION/);
      expect((e as Error).message).not.toMatch(/GCS_BUCKET/);
    }
  });

  it("does not treat missing credentials as missing config — the task role supplies them", () => {
    expect(() => resolveStorageConfig(S3, PROD)).not.toThrow();
  });
});

describe("resolveStorageConfig — unsupported provider", () => {
  it("throws in production", () => {
    expect(() => resolveStorageConfig({ STORAGE_PROVIDER: "azure" }, PROD)).toThrow(StorageConfigError);
  });

  it("throws in DEVELOPMENT too — a typo must never quietly downgrade to local disk", () => {
    expect(() => resolveStorageConfig({ STORAGE_PROVIDER: "s3!" }, DEV)).toThrow(StorageConfigError);
  });

  it("throws even during the build phase", () => {
    expect(() => resolveStorageConfig({ STORAGE_PROVIDER: "gcs2" }, BUILD)).toThrow(StorageConfigError);
  });

  it("lists the accepted values", () => {
    expect(() => resolveStorageConfig({ STORAGE_PROVIDER: "azure" }, PROD)).toThrow(/gcs, s3/);
  });
});

describe("production local-disk fallback prevention", () => {
  it("NEVER returns provider=local in production, for any input", () => {
    const inputs = [{}, { GCS_BUCKET: "b" }, { STORAGE_PROVIDER: "s3" }, { STORAGE_PROVIDER: "gcs" }];
    for (const env of inputs) {
      let result: string | undefined;
      try {
        result = resolveStorageConfig(env, PROD).provider;
      } catch {
        result = undefined; // threw — which is the desired outcome
      }
      expect(result).not.toBe("local");
    }
  });

  it("preserves the developer experience — dev falls back to local instead of throwing", () => {
    const r = resolveStorageConfig({}, DEV);
    expect(r.provider).toBe("local");
  });

  it("says loudly in dev that uploads are not persisted", () => {
    const r = resolveStorageConfig({}, DEV);
    expect(r.provider === "local" && r.reason).toMatch(/NOT persisted/i);
  });

  it("does NOT throw during next build — secrets arrive at container start, not build time", () => {
    expect(() => resolveStorageConfig({}, BUILD)).not.toThrow();
    expect(resolveStorageConfig({}, BUILD).provider).toBe("local");
  });
});

describe("describeStorage — safe for the boot log", () => {
  it("never prints a credential value", () => {
    const line = describeStorage(
      resolveStorageConfig({ ...S3, S3_ACCESS_KEY_ID: "AKIA_SECRET", S3_SECRET_ACCESS_KEY: "shhh" }, PROD),
    );
    expect(line).not.toContain("AKIA_SECRET");
    expect(line).not.toContain("shhh");
  });

  it("reports the credential SOURCE, which is what an operator needs", () => {
    expect(describeStorage(resolveStorageConfig(GCS, PROD))).toMatch(/ADC/);
    expect(describeStorage(resolveStorageConfig(S3, PROD))).toMatch(/default chain/);
  });

  it("makes a local-disk boot unmistakable", () => {
    expect(describeStorage(resolveStorageConfig({}, DEV))).toMatch(/LOCAL DISK/);
  });

  it("exposes exactly the two supported providers", () => {
    expect([...STORAGE_PROVIDERS]).toEqual(["gcs", "s3"]);
  });
});
