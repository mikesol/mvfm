import { createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { s3 } from "../../src/3.989.0";
import { createS3Interpreter, type S3Client } from "../../src/3.989.0/interpreter";

const plugin = s3({ region: "us-east-1" });
const plugins = [numPluginU, strPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const captured: Array<{ command: string; input: Record<string, unknown> }> = [];
  const mockClient: S3Client = {
    async execute(command: string, input: Record<string, unknown>) {
      captured.push({ command, input });
      if (command === "GetObject") {
        return { Body: "file content", ContentType: "text/plain", ETag: '"abc123"' };
      }
      if (command === "PutObject") {
        return { ETag: '"abc123"', VersionId: "v1" };
      }
      if (command === "HeadObject") {
        return { ContentLength: 1024, ContentType: "text/plain", ETag: '"abc123"' };
      }
      if (command === "ListObjectsV2") {
        return { Contents: [{ Key: "file.txt", Size: 1024 }], IsTruncated: false };
      }
      if (command === "DeleteObject") {
        return { DeleteMarker: false };
      }
      return {};
    },
  };
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, { s3: createS3Interpreter(mockClient) });
  const result = await fold(nexpr, interp);
  return { result, captured };
}

// ============================================================
// putObject
// ============================================================

describe("s3 interpreter: putObject", () => {
  it("yields PutObject command with correct input", async () => {
    const expr = $.s3.putObject({ Bucket: "my-bucket", Key: "file.txt", Body: "hello" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].command).toBe("PutObject");
    expect(captured[0].input).toEqual({
      Bucket: "my-bucket",
      Key: "file.txt",
      Body: "hello",
    });
  });
});

// ============================================================
// getObject
// ============================================================

describe("s3 interpreter: getObject", () => {
  it("yields GetObject command with correct input", async () => {
    const expr = $.s3.getObject({ Bucket: "my-bucket", Key: "file.txt" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].command).toBe("GetObject");
    expect(captured[0].input).toEqual({
      Bucket: "my-bucket",
      Key: "file.txt",
    });
  });
});

// ============================================================
// deleteObject
// ============================================================

describe("s3 interpreter: deleteObject", () => {
  it("yields DeleteObject command", async () => {
    const expr = $.s3.deleteObject({ Bucket: "my-bucket", Key: "file.txt" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].command).toBe("DeleteObject");
    expect(captured[0].input).toEqual({
      Bucket: "my-bucket",
      Key: "file.txt",
    });
  });
});

// ============================================================
// headObject
// ============================================================

describe("s3 interpreter: headObject", () => {
  it("yields HeadObject command", async () => {
    const expr = $.s3.headObject({ Bucket: "my-bucket", Key: "file.txt" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].command).toBe("HeadObject");
    expect(captured[0].input).toEqual({
      Bucket: "my-bucket",
      Key: "file.txt",
    });
  });
});

// ============================================================
// listObjectsV2
// ============================================================

describe("s3 interpreter: listObjectsV2", () => {
  it("yields ListObjectsV2 command with correct input", async () => {
    const expr = $.s3.listObjectsV2({ Bucket: "my-bucket", Prefix: "uploads/" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].command).toBe("ListObjectsV2");
    expect(captured[0].input).toEqual({
      Bucket: "my-bucket",
      Prefix: "uploads/",
    });
  });
});

// ============================================================
// Return value
// ============================================================

describe("s3 interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const expr = $.s3.headObject({ Bucket: "b", Key: "k" });
    const { result } = await run(expr);
    expect(result).toEqual({
      ContentLength: 1024,
      ContentType: "text/plain",
      ETag: '"abc123"',
    });
  });
});

// ============================================================
// defaults() throws without override
// ============================================================

describe("s3 interpreter: defaults() without override", () => {
  it("throws when no override provided for s3 plugin", () => {
    expect(() => defaults(plugins)).toThrow(/no defaultInterpreter/i);
  });
});
