# S3 Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `s3` plugin for `@aws-sdk/client-s3` v3.989.0 with 5 core object operations (putObject, getObject, deleteObject, headObject, listObjectsV2).

**Architecture:** Uniform effect pattern (like Stripe). One effect type `s3/command` with `command` name and `input` fields. Factory function `s3(config)` returns `PluginDefinition<S3Methods>`. SDK adapter wraps `S3Client` into a simple `execute(commandName, input)` interface.

**Tech Stack:** TypeScript, vitest, `@aws-sdk/client-s3`, testcontainers (LocalStack for integration tests)

**Worktree:** `../ilo-53` (branch `issue-53`)

**Reference files:** The Stripe plugin is the exact pattern to follow:
- `src/plugins/stripe/2025-04-30.basil/index.ts` — plugin definition
- `src/plugins/stripe/2025-04-30.basil/interpreter.ts` — interpreter fragment
- `src/plugins/stripe/2025-04-30.basil/handler.server.ts` — server handler
- `src/plugins/stripe/2025-04-30.basil/handler.client.ts` — client handler
- `src/plugins/stripe/2025-04-30.basil/client-stripe-sdk.ts` — SDK adapter
- `tests/plugins/stripe/2025-04-30.basil/` — all three test tiers

---

### Task 1: Plugin Definition (`index.ts`)

**Files:**
- Create: `src/plugins/s3/3.989.0/index.ts`
- Test: `tests/plugins/s3/3.989.0/index.test.ts`

**Step 1: Write the failing tests**

Create `tests/plugins/s3/3.989.0/index.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { s3 } from "../../../../src/plugins/s3/3.989.0";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, s3({ region: "us-east-1" }));

// ============================================================
// putObject
// ============================================================

describe("s3: putObject", () => {
  it("produces s3/put_object node with literal params", () => {
    const prog = app(($) => {
      return $.s3.putObject({ Bucket: "my-bucket", Key: "file.txt", Body: "hello" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/put_object");
    expect(ast.result.input.kind).toBe("core/record");
    expect(ast.result.input.fields.Bucket.kind).toBe("core/literal");
    expect(ast.result.input.fields.Bucket.value).toBe("my-bucket");
    expect(ast.result.input.fields.Key.kind).toBe("core/literal");
    expect(ast.result.input.fields.Key.value).toBe("file.txt");
    expect(ast.result.input.fields.Body.kind).toBe("core/literal");
    expect(ast.result.input.fields.Body.value).toBe("hello");
  });

  it("accepts Expr params", () => {
    const prog = app(($) => {
      return $.s3.putObject({
        Bucket: $.input.bucket,
        Key: $.input.key,
        Body: $.input.content,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/put_object");
    expect(ast.result.input.fields.Bucket.kind).toBe("core/prop_access");
    expect(ast.result.input.fields.Key.kind).toBe("core/prop_access");
    expect(ast.result.input.fields.Body.kind).toBe("core/prop_access");
  });
});

// ============================================================
// getObject
// ============================================================

describe("s3: getObject", () => {
  it("produces s3/get_object node", () => {
    const prog = app(($) => {
      return $.s3.getObject({ Bucket: "my-bucket", Key: "file.txt" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/get_object");
    expect(ast.result.input.kind).toBe("core/record");
    expect(ast.result.input.fields.Bucket.value).toBe("my-bucket");
    expect(ast.result.input.fields.Key.value).toBe("file.txt");
  });
});

// ============================================================
// deleteObject
// ============================================================

describe("s3: deleteObject", () => {
  it("produces s3/delete_object node", () => {
    const prog = app(($) => {
      return $.s3.deleteObject({ Bucket: "my-bucket", Key: "file.txt" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/delete_object");
    expect(ast.result.input.fields.Bucket.value).toBe("my-bucket");
    expect(ast.result.input.fields.Key.value).toBe("file.txt");
  });
});

// ============================================================
// headObject
// ============================================================

describe("s3: headObject", () => {
  it("produces s3/head_object node", () => {
    const prog = app(($) => {
      return $.s3.headObject({ Bucket: "my-bucket", Key: "file.txt" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/head_object");
    expect(ast.result.input.fields.Bucket.value).toBe("my-bucket");
    expect(ast.result.input.fields.Key.value).toBe("file.txt");
  });
});

// ============================================================
// listObjectsV2
// ============================================================

describe("s3: listObjectsV2", () => {
  it("produces s3/list_objects_v2 node with params", () => {
    const prog = app(($) => {
      return $.s3.listObjectsV2({ Bucket: "my-bucket", Prefix: "uploads/" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/list_objects_v2");
    expect(ast.result.input.fields.Bucket.value).toBe("my-bucket");
    expect(ast.result.input.fields.Prefix.value).toBe("uploads/");
  });
});

// ============================================================
// $.do() integration
// ============================================================

describe("s3: integration with $.do()", () => {
  it("side-effecting operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const put = $.s3.putObject({ Bucket: "b", Key: "k", Body: "data" });
        const head = $.s3.headObject({ Bucket: "b", Key: "k" });
        return $.do(put, head);
      });
    }).not.toThrow();
  });

  it("orphaned operations are rejected", () => {
    expect(() => {
      app(($) => {
        const get = $.s3.getObject({ Bucket: "b", Key: "k" });
        $.s3.deleteObject({ Bucket: "b", Key: "k" }); // orphan!
        return get;
      });
    }).toThrow(/unreachable node/i);
  });
});

// ============================================================
// Cross-operation dependencies
// ============================================================

describe("s3: cross-operation dependencies", () => {
  it("can use result of one operation as input to another", () => {
    const prog = app(($) => {
      const list = $.s3.listObjectsV2({ Bucket: "my-bucket" });
      const head = $.s3.headObject({
        Bucket: "my-bucket",
        Key: (list as any).Contents[0].Key,
      });
      return $.do(list, head);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd ../ilo-53 && .venv/bin/python -c "pass" 2>/dev/null; npx vitest run tests/plugins/s3/3.989.0/index.test.ts`
Expected: FAIL — cannot find module `../../../../src/plugins/s3/3.989.0`

**Step 3: Write the plugin definition**

Create `src/plugins/s3/3.989.0/index.ts`:

```typescript
// ============================================================
// ILO PLUGIN: s3 (@aws-sdk/client-s3 compatible API)
// ============================================================
//
// Implementation status: PARTIAL (5 of 108 commands)
// Plugin size: LARGE — at pass 1 of 60/30/10 split (5 of 108 commands)
//
// Implemented:
//   - putObject: upload an object
//   - getObject: download an object
//   - deleteObject: delete an object
//   - headObject: check existence / get metadata
//   - listObjectsV2: list objects in a bucket
//
// Not doable (fundamental mismatch with AST model):
//   - SelectObjectContent: event stream output (push-based)
//   - Multipart upload as a workflow: stateful multi-step loop
//
// Remaining (same command pattern, add as needed):
//   CopyObject, DeleteObjects, RenameObject, GetObjectAttributes,
//   GetObjectTagging, PutObjectTagging, DeleteObjectTagging,
//   CreateBucket, DeleteBucket, HeadBucket, ListBuckets,
//   and 80+ bucket configuration commands (lifecycle, CORS,
//   encryption, versioning, etc.).
//
//   Each command follows the same pattern: add node kind,
//   add method to S3Methods, add switch case to interpreter.
//   The interpreter/handler architecture does not need to
//   change — s3/command covers everything.
//
// ============================================================
//
// Goal: An LLM that knows @aws-sdk/client-s3 should be able
// to write Ilo programs with near-zero learning curve. The API
// mirrors the high-level S3 aggregated client (method calls
// with PascalCase input objects).
//
// Real @aws-sdk/client-s3 API (v3.989.0):
//   const s3 = new S3({ region: 'us-east-1' })
//   await s3.putObject({ Bucket: 'b', Key: 'k', Body: 'hello' })
//   const obj = await s3.getObject({ Bucket: 'b', Key: 'k' })
//   await s3.deleteObject({ Bucket: 'b', Key: 'k' })
//   const head = await s3.headObject({ Bucket: 'b', Key: 'k' })
//   const list = await s3.listObjectsV2({ Bucket: 'b', Prefix: 'uploads/' })
//
// Based on source-level analysis of aws-sdk-js-v3
// (github.com/aws/aws-sdk-js-v3, clients/client-s3).
// The SDK uses Smithy-generated Command classes dispatched
// via client.send(). The S3 aggregated class wraps these
// as convenience methods via createAggregatedClient().
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * S3 operations added to the DSL context by the s3 plugin.
 *
 * Mirrors the high-level `S3` aggregated client from
 * `@aws-sdk/client-s3` v3.989.0: putObject, getObject,
 * deleteObject, headObject, listObjectsV2.
 */
export interface S3Methods {
  /** S3 operations, namespaced under `$.s3`. */
  s3: {
    /**
     * Upload an object to S3.
     *
     * @param input - PutObject input (Bucket, Key, Body required).
     * @returns The PutObject response (ETag, VersionId, etc.).
     */
    putObject(
      input: Expr<Record<string, unknown>> | Record<string, unknown>,
    ): Expr<Record<string, unknown>>;

    /**
     * Download an object from S3.
     *
     * @param input - GetObject input (Bucket, Key required).
     * @returns The GetObject response (Body as string, ContentType, etc.).
     */
    getObject(
      input: Expr<Record<string, unknown>> | Record<string, unknown>,
    ): Expr<Record<string, unknown>>;

    /**
     * Delete an object from S3.
     *
     * @param input - DeleteObject input (Bucket, Key required).
     * @returns The DeleteObject response (DeleteMarker, VersionId, etc.).
     */
    deleteObject(
      input: Expr<Record<string, unknown>> | Record<string, unknown>,
    ): Expr<Record<string, unknown>>;

    /**
     * Check existence and retrieve metadata for an object.
     *
     * @param input - HeadObject input (Bucket, Key required).
     * @returns The HeadObject response (ContentLength, ContentType, etc.).
     */
    headObject(
      input: Expr<Record<string, unknown>> | Record<string, unknown>,
    ): Expr<Record<string, unknown>>;

    /**
     * List objects in a bucket (v2).
     *
     * @param input - ListObjectsV2 input (Bucket required, Prefix optional).
     * @returns The ListObjectsV2 response (Contents, IsTruncated, etc.).
     */
    listObjectsV2(
      input: Expr<Record<string, unknown>> | Record<string, unknown>,
    ): Expr<Record<string, unknown>>;
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the s3 plugin.
 *
 * Requires a region. Optionally accepts credentials, a custom
 * endpoint (for S3-compatible services like MinIO/LocalStack),
 * and forcePathStyle for local development.
 */
export interface S3Config {
  /** AWS region (e.g. `us-east-1`). */
  region: string;
  /** AWS credentials. If omitted, the SDK uses default credential resolution. */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  /** Custom endpoint URL for S3-compatible services (e.g. LocalStack, MinIO). */
  endpoint?: string;
  /** Use path-style addressing (required for LocalStack/MinIO). */
  forcePathStyle?: boolean;
}

// ---- Plugin implementation --------------------------------

/**
 * S3 plugin factory. Namespace: `s3/`.
 *
 * Creates a plugin that exposes S3 object operations for building
 * parameterized S3 command AST nodes.
 *
 * @param config - An {@link S3Config} with region and optional credentials.
 * @returns A {@link PluginDefinition} for the s3 plugin.
 *
 * @example
 * ```ts
 * const app = ilo(num, str, s3({ region: "us-east-1" }));
 * const prog = app(($) => $.s3.putObject({ Bucket: "b", Key: "k", Body: "hello" }));
 * ```
 */
export function s3(config: S3Config): PluginDefinition<S3Methods> {
  return {
    name: "s3",
    nodeKinds: [
      "s3/put_object",
      "s3/get_object",
      "s3/delete_object",
      "s3/head_object",
      "s3/list_objects_v2",
    ],

    build(ctx: PluginContext): S3Methods {
      function resolveInput(
        input: Expr<Record<string, unknown>> | Record<string, unknown>,
      ) {
        return ctx.lift(input).__node;
      }

      return {
        s3: {
          putObject(input) {
            return ctx.expr({
              kind: "s3/put_object",
              input: resolveInput(input),
              config,
            });
          },

          getObject(input) {
            return ctx.expr({
              kind: "s3/get_object",
              input: resolveInput(input),
              config,
            });
          },

          deleteObject(input) {
            return ctx.expr({
              kind: "s3/delete_object",
              input: resolveInput(input),
              config,
            });
          },

          headObject(input) {
            return ctx.expr({
              kind: "s3/head_object",
              input: resolveInput(input),
              config,
            });
          },

          listObjectsV2(input) {
            return ctx.expr({
              kind: "s3/list_objects_v2",
              input: resolveInput(input),
              config,
            });
          },
        },
      };
    },
  };
}

// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Basic object operations:
//    Real:  await s3.putObject({ Bucket: 'b', Key: 'k', Body: 'hello' })
//    Ilo:   $.s3.putObject({ Bucket: 'b', Key: 'k', Body: 'hello' })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Parameterized operations with proxy values:
//    const list = $.s3.listObjectsV2({ Bucket: $.input.bucket })
//    const head = $.s3.headObject({ Bucket: $.input.bucket, Key: list.Contents[0].Key })
//    Proxy chains capture the dependency graph perfectly.
//
// 3. Method and parameter naming:
//    Real:  s3.putObject({ Bucket, Key, Body, ContentType, Metadata })
//    Ilo:   $.s3.putObject({ Bucket, Key, Body, ContentType, Metadata })
//    1:1 match. PascalCase params, camelCase methods.
//
// WORKS BUT DIFFERENT:
//
// 4. GetObject Body:
//    Real:  const body = await response.Body.transformToString()
//    Ilo:   const body = result.Body  (already a string)
//    The handler converts the stream to string before returning.
//    More ergonomic but different from the real SDK.
//
// 5. Return types:
//    Real SDK has typed CommandOutput interfaces (PutObjectOutput, etc.)
//    Ilo uses Record<string, unknown>. Property access works via proxy.
//
// DOESN'T WORK / NOT MODELED:
//
// 6. SelectObjectContent: Event stream, not request-response.
// 7. Multipart upload workflow: Stateful multi-step.
// 8. Presigned URLs: Utility function, not a command.
// 9. Waiters: waitUntilObjectExists — polling-based.
//
// SUMMARY:
// For the core 80% use case of "put/get/delete/head/list objects"
// — nearly identical to the real @aws-sdk/client-s3 high-level API.
// An LLM trained on the real SDK can write ilo S3 programs immediately.
// Not supported: streaming, multipart, presigned URLs, waiters.
// ============================================================
```

**Step 4: Run tests to verify they pass**

Run: `cd ../ilo-53 && npx vitest run tests/plugins/s3/3.989.0/index.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/plugins/s3/3.989.0/index.ts tests/plugins/s3/3.989.0/index.test.ts
git commit -m "feat(s3): add plugin definition and AST builder tests (#53)"
```

---

### Task 2: Interpreter Fragment (`interpreter.ts`)

**Files:**
- Create: `src/plugins/s3/3.989.0/interpreter.ts`
- Test: `tests/plugins/s3/3.989.0/interpreter.test.ts`

**Step 1: Write the failing tests**

Create `tests/plugins/s3/3.989.0/interpreter.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { foldAST, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { s3 } from "../../../../src/plugins/s3/3.989.0";
import { s3Interpreter } from "../../../../src/plugins/s3/3.989.0/interpreter";

const app = ilo(num, str, s3({ region: "us-east-1" }));
const fragments = [s3Interpreter, coreInterpreter];

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
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "s3/command": async (effect) => {
      captured.push(effect);
      // Return a mock response matching the command type
      if (effect.command === "GetObject") {
        return { Body: "file content", ContentType: "text/plain", ETag: '"abc123"' };
      }
      if (effect.command === "PutObject") {
        return { ETag: '"abc123"', VersionId: "v1" };
      }
      if (effect.command === "HeadObject") {
        return { ContentLength: 1024, ContentType: "text/plain", ETag: '"abc123"' };
      }
      if (effect.command === "ListObjectsV2") {
        return { Contents: [{ Key: "file.txt", Size: 1024 }], IsTruncated: false };
      }
      if (effect.command === "DeleteObject") {
        return { DeleteMarker: false };
      }
      return {};
    },
  });
  const result = await recurse(ast.result);
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
    expect(captured[0].type).toBe("s3/command");
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
    const prog = app(($) =>
      $.s3.getObject({ Bucket: "my-bucket", Key: "file.txt" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("s3/command");
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
    const prog = app(($) =>
      $.s3.deleteObject({ Bucket: "my-bucket", Key: "file.txt" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("s3/command");
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
    const prog = app(($) =>
      $.s3.headObject({ Bucket: "my-bucket", Key: "file.txt" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("s3/command");
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
    const prog = app(($) =>
      $.s3.listObjectsV2({ Bucket: "my-bucket", Prefix: "uploads/" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("s3/command");
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
```

**Step 2: Run tests to verify they fail**

Run: `cd ../ilo-53 && npx vitest run tests/plugins/s3/3.989.0/interpreter.test.ts`
Expected: FAIL — cannot find module `s3Interpreter`

**Step 3: Write the interpreter**

Create `src/plugins/s3/3.989.0/interpreter.ts`:

```typescript
import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * S3 client interface consumed by the s3 handler.
 *
 * Abstracts over the actual AWS S3 SDK so handlers can be
 * tested with mock clients.
 */
export interface S3Client {
  /** Execute an S3 command and return the response. */
  execute(command: string, input: Record<string, unknown>): Promise<unknown>;
}

/** Map from AST node kind to S3 command name. */
const COMMAND_MAP: Record<string, string> = {
  "s3/put_object": "PutObject",
  "s3/get_object": "GetObject",
  "s3/delete_object": "DeleteObject",
  "s3/head_object": "HeadObject",
  "s3/list_objects_v2": "ListObjectsV2",
};

/**
 * Generator-based interpreter fragment for s3 plugin nodes.
 *
 * Yields `s3/command` effects for all 5 operations. Each effect
 * contains the command name and resolved input, matching the
 * AWS SDK command pattern.
 */
export const s3Interpreter: InterpreterFragment = {
  pluginName: "s3",
  canHandle: (node) => node.kind.startsWith("s3/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    const command = COMMAND_MAP[node.kind];
    if (!command) {
      throw new Error(`S3 interpreter: unknown node kind "${node.kind}"`);
    }

    const input = yield { type: "recurse", child: node.input as ASTNode };
    return yield {
      type: "s3/command",
      command,
      input,
    };
  },
};
```

**Step 4: Run tests to verify they pass**

Run: `cd ../ilo-53 && npx vitest run tests/plugins/s3/3.989.0/interpreter.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/plugins/s3/3.989.0/interpreter.ts tests/plugins/s3/3.989.0/interpreter.test.ts
git commit -m "feat(s3): add interpreter fragment with s3/command effect (#53)"
```

---

### Task 3: Server Handler and SDK Adapter

**Files:**
- Create: `src/plugins/s3/3.989.0/handler.server.ts`
- Create: `src/plugins/s3/3.989.0/client-aws-sdk.ts`

**Step 1: Write the server handler**

Create `src/plugins/s3/3.989.0/handler.server.ts`:

```typescript
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { S3Client } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes S3 effects
 * against a real S3 client.
 *
 * Handles `s3/command` effects by delegating to
 * `client.execute(command, input)`. Throws on unhandled effect types.
 *
 * @param client - The {@link S3Client} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: S3Client): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "s3/command") {
      const { command, input } = effect as {
        type: "s3/command";
        command: string;
        input: Record<string, unknown>;
      };
      const value = await client.execute(command, input);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * an S3 client using the provided interpreter fragments.
 *
 * Convenience wrapper composing fragments + {@link serverHandler} via `runAST`.
 *
 * @param client - The {@link S3Client} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: S3Client,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
```

**Step 2: Write the SDK adapter**

Create `src/plugins/s3/3.989.0/client-aws-sdk.ts`:

```typescript
import type {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client as AwsS3Client,
} from "@aws-sdk/client-s3";
import type { S3Client } from "./interpreter";

/**
 * Map of command names to their AWS SDK Command constructors.
 *
 * Lazily imported to avoid requiring @aws-sdk/client-s3 at module load
 * time in environments that don't use the server handler.
 */
type CommandConstructor = new (input: any) => any;

/**
 * Wraps the official AWS S3 SDK into an {@link S3Client}.
 *
 * Uses `client.send(new XxxCommand(input))` to execute commands.
 * For GetObject, converts the streaming Body to a string.
 *
 * @param client - A configured AWS S3Client instance.
 * @param commands - Map of command name to Command constructor.
 * @returns An {@link S3Client} adapter.
 */
export function wrapAwsSdk(
  client: AwsS3Client,
  commands: Record<string, CommandConstructor>,
): S3Client {
  return {
    async execute(
      command: string,
      input: Record<string, unknown>,
    ): Promise<unknown> {
      const CommandClass = commands[command];
      if (!CommandClass) {
        throw new Error(`wrapAwsSdk: unknown command "${command}"`);
      }
      const result = await client.send(new CommandClass(input));

      // For GetObject, convert streaming Body to string
      if (command === "GetObject" && result.Body) {
        const body = await result.Body.transformToString();
        return { ...result, Body: body };
      }

      return result;
    },
  };
}
```

**Step 3: Commit**

```bash
git add src/plugins/s3/3.989.0/handler.server.ts src/plugins/s3/3.989.0/client-aws-sdk.ts
git commit -m "feat(s3): add server handler and AWS SDK adapter (#53)"
```

---

### Task 4: Client Handler

**Files:**
- Create: `src/plugins/s3/3.989.0/handler.client.ts`

**Step 1: Write the client handler**

Create `src/plugins/s3/3.989.0/handler.client.ts` — this is identical in structure to the Stripe client handler:

```typescript
import type { StepContext, StepEffect, StepHandler } from "../../../core";

/**
 * Options for configuring the client-side handler.
 */
export interface ClientHandlerOptions {
  /** Base URL of the server endpoint (e.g., "https://api.example.com"). */
  baseUrl: string;
  /** Contract hash from the program, used for verification. */
  contractHash: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof globalThis.fetch;
  /** Additional headers to include in requests. */
  headers?: Record<string, string>;
}

/**
 * State tracked by the client handler across steps.
 */
export interface ClientHandlerState {
  /** The current step index, incremented after each effect. */
  stepIndex: number;
}

/**
 * Creates a client-side {@link StepHandler} that sends effects as JSON
 * to a remote server endpoint for execution.
 *
 * Each effect is sent as a POST request to `{baseUrl}/ilo/execute` with
 * the contract hash, step index, path, and effect payload. The server
 * is expected to return `{ result: unknown }` in the response body.
 *
 * @param options - Configuration for the client handler.
 * @returns A {@link StepHandler} that tracks step indices.
 */
export function clientHandler(options: ClientHandlerOptions): StepHandler<ClientHandlerState> {
  const { baseUrl, contractHash, headers = {} } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return async (
    effect: StepEffect,
    context: StepContext,
    state: ClientHandlerState,
  ): Promise<{ value: unknown; state: ClientHandlerState }> => {
    const response = await fetchFn(`${baseUrl}/ilo/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        contractHash,
        stepIndex: state.stepIndex,
        path: context.path,
        effect,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Client handler: server returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { result: unknown };

    return {
      value: data.result,
      state: { stepIndex: state.stepIndex + 1 },
    };
  };
}
```

**Step 2: Commit**

```bash
git add src/plugins/s3/3.989.0/handler.client.ts
git commit -m "feat(s3): add client handler (#53)"
```

---

### Task 5: Integration Test

**Files:**
- Create: `tests/plugins/s3/3.989.0/integration.test.ts`

**Step 1: Write the integration test**

Create `tests/plugins/s3/3.989.0/integration.test.ts`:

```typescript
import { S3Client as AwsS3Client, CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";
import { s3 as s3Plugin } from "../../../../src/plugins/s3/3.989.0";
import { wrapAwsSdk } from "../../../../src/plugins/s3/3.989.0/client-aws-sdk";
import { serverEvaluate } from "../../../../src/plugins/s3/3.989.0/handler.server";
import { s3Interpreter } from "../../../../src/plugins/s3/3.989.0/interpreter";

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

let container: StartedTestContainer;
let awsClient: AwsS3Client;

const BUCKET = "test-bucket";

const allFragments = [
  s3Interpreter,
  coreInterpreter,
  numInterpreter,
  strInterpreter,
];

const commands: Record<string, new (input: any) => any> = {
  PutObject: PutObjectCommand,
  GetObject: GetObjectCommand,
  DeleteObject: DeleteObjectCommand,
  HeadObject: HeadObjectCommand,
  ListObjectsV2: ListObjectsV2Command,
};

const app = ilo(num, str, s3Plugin({ region: "us-east-1" }));

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const client = wrapAwsSdk(awsClient, commands);
  const evaluate = serverEvaluate(client, allFragments);
  return await evaluate(ast.result);
}

beforeAll(async () => {
  container = await new GenericContainer("localstack/localstack:latest")
    .withExposedPorts(4566)
    .withEnvironment({ SERVICES: "s3" })
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(4566);

  awsClient = new AwsS3Client({
    region: "us-east-1",
    endpoint: `http://${host}:${port}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
  });

  // Create the test bucket
  await awsClient.send(new CreateBucketCommand({ Bucket: BUCKET }));
}, 120000);

afterAll(async () => {
  awsClient.destroy();
  await container.stop();
});

// ============================================================
// Object operations
// ============================================================

describe("s3 integration: putObject + getObject", () => {
  it("upload and download an object", async () => {
    // Put
    const putProg = app(($) =>
      $.s3.putObject({ Bucket: BUCKET, Key: "hello.txt", Body: "Hello, S3!" }),
    );
    const putResult = (await run(putProg)) as any;
    expect(putResult.ETag).toBeDefined();

    // Get
    const getProg = app(($) =>
      $.s3.getObject({ Bucket: BUCKET, Key: "hello.txt" }),
    );
    const getResult = (await run(getProg)) as any;
    expect(getResult.Body).toBe("Hello, S3!");
  });
});

describe("s3 integration: headObject", () => {
  it("get object metadata", async () => {
    // Ensure object exists
    await awsClient.send(new PutObjectCommand({
      Bucket: BUCKET, Key: "meta.txt", Body: "metadata test",
    }));

    const prog = app(($) =>
      $.s3.headObject({ Bucket: BUCKET, Key: "meta.txt" }),
    );
    const result = (await run(prog)) as any;
    expect(result.ContentLength).toBeGreaterThan(0);
  });
});

describe("s3 integration: deleteObject", () => {
  it("delete an object", async () => {
    // Create then delete
    await awsClient.send(new PutObjectCommand({
      Bucket: BUCKET, Key: "to-delete.txt", Body: "delete me",
    }));

    const prog = app(($) =>
      $.s3.deleteObject({ Bucket: BUCKET, Key: "to-delete.txt" }),
    );
    const result = await run(prog);
    expect(result).toBeDefined();
  });
});

describe("s3 integration: listObjectsV2", () => {
  it("list objects with prefix", async () => {
    // Create objects with a prefix
    await awsClient.send(new PutObjectCommand({
      Bucket: BUCKET, Key: "list-test/a.txt", Body: "a",
    }));
    await awsClient.send(new PutObjectCommand({
      Bucket: BUCKET, Key: "list-test/b.txt", Body: "b",
    }));

    const prog = app(($) =>
      $.s3.listObjectsV2({ Bucket: BUCKET, Prefix: "list-test/" }),
    );
    const result = (await run(prog)) as any;
    expect(result.Contents).toBeDefined();
    expect(result.Contents.length).toBeGreaterThanOrEqual(2);
    const keys = result.Contents.map((c: any) => c.Key);
    expect(keys).toContain("list-test/a.txt");
    expect(keys).toContain("list-test/b.txt");
  });
});

describe("s3 integration: input resolution", () => {
  it("resolves dynamic input values", async () => {
    await awsClient.send(new PutObjectCommand({
      Bucket: BUCKET, Key: "dynamic.txt", Body: "dynamic content",
    }));

    const prog = app({ key: "string" }, ($) =>
      $.s3.getObject({ Bucket: BUCKET, Key: $.input.key }),
    );
    const result = (await run(prog, { key: "dynamic.txt" })) as any;
    expect(result.Body).toBe("dynamic content");
  });
});
```

**Step 2: Install @aws-sdk/client-s3 as a dev dependency** (needed for integration tests)

Run: `cd ../ilo-53 && npm install --save-dev @aws-sdk/client-s3`

**Step 3: Run the integration test**

Run: `cd ../ilo-53 && npx vitest run tests/plugins/s3/3.989.0/integration.test.ts --timeout 120000`
Expected: All tests PASS (requires Docker for LocalStack)

**Step 4: Commit**

```bash
git add tests/plugins/s3/3.989.0/integration.test.ts package.json package-lock.json
git commit -m "feat(s3): add integration tests with LocalStack (#53)"
```

---

### Task 6: Public Exports and Build Verification

**Files:**
- Modify: `src/index.ts` — add s3 exports following the stripe pattern

**Step 1: Add exports to `src/index.ts`**

Add after the stripe exports block (around line 93):

```typescript
export type { S3Config, S3Methods } from "./plugins/s3/3.989.0";
export { s3 } from "./plugins/s3/3.989.0";
export { wrapAwsSdk } from "./plugins/s3/3.989.0/client-aws-sdk";
export type {
  ClientHandlerOptions as S3ClientHandlerOptions,
  ClientHandlerState as S3ClientHandlerState,
} from "./plugins/s3/3.989.0/handler.client";
export { clientHandler as s3ClientHandler } from "./plugins/s3/3.989.0/handler.client";
export {
  serverEvaluate as s3ServerEvaluate,
  serverHandler as s3ServerHandler,
} from "./plugins/s3/3.989.0/handler.server";
export type { S3Client } from "./plugins/s3/3.989.0/interpreter";
export { s3Interpreter } from "./plugins/s3/3.989.0/interpreter";
```

**Step 2: Run full build and checks**

Run: `cd ../ilo-53 && npm run build && npm run check && npm test`
Expected: All pass with no errors

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(s3): add public exports (#53)"
```

---

### Task 7: Final Verification and PR

**Step 1: Run full validation suite**

Run: `cd ../ilo-53 && npm run build && npm run check && npm test`
Expected: All pass

**Step 2: Create PR**

```bash
gh pr create --title "feat: add S3 plugin (#53)" --body "$(cat <<'EOF'
## Summary

- Implements `s3` plugin for `@aws-sdk/client-s3` v3.989.0
- 5 core operations: putObject, getObject, deleteObject, headObject, listObjectsV2
- Uniform effect pattern (`s3/command`) like the Stripe plugin
- SDK adapter wraps `S3Client` into `execute(command, input)` interface
- Full 3-tier test coverage (AST, interpreter, integration with LocalStack)

Closes #53

## Design alignment

- **API mirrors the real SDK**: Method names and PascalCase parameter names match the high-level `S3` aggregated client 1:1
- **Plugin authoring guide**: Follows all standing rules (namespaced kinds, config in AST nodes, Expr|T params, pure build, TSDoc)
- **Plugin size**: LARGE — pass 1 of 60/30/10 split (5 of 108 commands)

## Validation performed

- `npm run build` — no type errors
- `npm run check` — lint clean
- `npm test` — all tests pass (AST builder, interpreter, integration)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
