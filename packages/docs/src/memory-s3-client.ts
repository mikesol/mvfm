import type { S3Client } from "@mvfm/plugin-s3";

interface StoredObject {
  body: string;
  contentType?: string;
  metadata?: Record<string, string>;
  lastModified: Date;
}

/**
 * In-memory implementation of {@link S3Client} for the docs playground.
 *
 * Stores objects in nested Maps, emulating basic S3 put/get/delete/head/list
 * semantics. Not suitable for production use — designed for deterministic
 * doc examples that run entirely in the browser.
 */
export class MemoryS3Client implements S3Client {
  private buckets = new Map<string, Map<string, StoredObject>>();

  private getBucket(name: string): Map<string, StoredObject> {
    let b = this.buckets.get(name);
    if (!b) {
      b = new Map();
      this.buckets.set(name, b);
    }
    return b;
  }

  async execute(command: string, input: Record<string, unknown>): Promise<unknown> {
    const bucket = input.Bucket as string;
    const key = input.Key as string;

    switch (command) {
      case "PutObject": {
        const obj: StoredObject = {
          body: String(input.Body ?? ""),
          contentType: (input.ContentType as string) ?? "application/octet-stream",
          metadata: (input.Metadata as Record<string, string>) ?? {},
          lastModified: new Date(),
        };
        this.getBucket(bucket).set(key, obj);
        return { ETag: `"${simpleHash(obj.body)}"` };
      }

      case "GetObject": {
        const obj = this.getBucket(bucket).get(key);
        if (!obj) throw new Error(`NoSuchKey: ${key}`);
        return {
          Body: obj.body,
          ContentType: obj.contentType,
          ContentLength: obj.body.length,
          LastModified: obj.lastModified,
          ETag: `"${simpleHash(obj.body)}"`,
          Metadata: obj.metadata,
        };
      }

      case "DeleteObject": {
        this.getBucket(bucket).delete(key);
        return {};
      }

      case "HeadObject": {
        const obj = this.getBucket(bucket).get(key);
        if (!obj) throw new Error(`NotFound: ${key}`);
        return {
          ContentType: obj.contentType,
          ContentLength: obj.body.length,
          LastModified: obj.lastModified,
          ETag: `"${simpleHash(obj.body)}"`,
          Metadata: obj.metadata,
        };
      }

      case "ListObjectsV2": {
        const b = this.getBucket(bucket);
        const prefix = (input.Prefix as string) ?? "";
        const contents: unknown[] = [];
        for (const [k, obj] of b) {
          if (k.startsWith(prefix)) {
            contents.push({
              Key: k,
              Size: obj.body.length,
              LastModified: obj.lastModified,
              ETag: `"${simpleHash(obj.body)}"`,
            });
          }
        }
        return {
          Contents: contents,
          KeyCount: contents.length,
          IsTruncated: false,
        };
      }

      default:
        throw new Error(`MemoryS3Client: unsupported command "${command}"`);
    }
  }
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, "0");
}
