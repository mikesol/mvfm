import { coreInterpreter, foldAST, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { s3 } from "../../src/3.989.0";
import { createS3Interpreter, type S3Client } from "../../src/3.989.0/interpreter";

const app = mvfm(num, str, s3({ region: "us-east-1" }));

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: Array<{ command: string; input: Record<string, unknown> }> = [];
  const ast = injectInput(prog.ast, input);
  const mockClient: S3Client = {
    async execute(command: string, input: Record<string, unknown>) {
      captured.push({ command, input });
      // Return a mock response matching the command type
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
  const combined = { ...createS3Interpreter(mockClient), ...coreInterpreter };
  const result = await foldAST(combined, ast.result);
  return { result, captured };
}

// ============================================================
// putObject
// ============================================================

describe("s3 interpreter: putObject", () => {
  it("yields s3/command with PutObject and correct input", async () => {
    const prog = app(($) =>
      $.s3.putObject({ Bucket: "my-bucket", Key: "file.txt", Body: "hello" }),
    );
    const { captured } = await run(prog);
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
  it("yields s3/command with GetObject and correct input", async () => {
    const prog = app(($) => $.s3.getObject({ Bucket: "my-bucket", Key: "file.txt" }));
    const { captured } = await run(prog);
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
  it("yields s3/command with DeleteObject", async () => {
    const prog = app(($) => $.s3.deleteObject({ Bucket: "my-bucket", Key: "file.txt" }));
    const { captured } = await run(prog);
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
  it("yields s3/command with HeadObject", async () => {
    const prog = app(($) => $.s3.headObject({ Bucket: "my-bucket", Key: "file.txt" }));
    const { captured } = await run(prog);
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
  it("yields s3/command with ListObjectsV2 and correct input", async () => {
    const prog = app(($) => $.s3.listObjectsV2({ Bucket: "my-bucket", Prefix: "uploads/" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].command).toBe("ListObjectsV2");
    expect(captured[0].input).toEqual({
      Bucket: "my-bucket",
      Prefix: "uploads/",
    });
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("s3 interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ bucket: "string", key: "string" }, ($) =>
      $.s3.getObject({ Bucket: $.input.bucket, Key: $.input.key }),
    );
    const { captured } = await run(prog, { bucket: "dynamic-bucket", key: "dynamic-key" });
    expect(captured).toHaveLength(1);
    expect(captured[0].input).toEqual({
      Bucket: "dynamic-bucket",
      Key: "dynamic-key",
    });
  });
});

// ============================================================
// Return value
// ============================================================

describe("s3 interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.s3.headObject({ Bucket: "b", Key: "k" }));
    const { result } = await run(prog);
    expect(result).toEqual({ ContentLength: 1024, ContentType: "text/plain", ETag: '"abc123"' });
  });
});
