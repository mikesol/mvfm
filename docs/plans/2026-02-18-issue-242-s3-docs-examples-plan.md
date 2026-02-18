# S3 Plugin Documentation Examples Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add documentation examples for all 5 S3 node kinds, backed by an in-memory S3 mock for the browser playground.

**Architecture:** In-memory `MemoryS3Client` class implements the `S3Client` interface, storing objects in nested Maps. Playground wires it via an `s3?: true` flag on `NodeExample`. One example file covers all 5 node kinds.

**Tech Stack:** TypeScript, `@mvfm/plugin-s3` (`S3Client` interface, `createS3Interpreter`, `s3` factory)

---

### Task 1: Create MemoryS3Client

**Files:**
- Create: `packages/docs/src/memory-s3-client.ts`

**Step 1: Write the mock**

```ts
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

  async execute(
    command: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
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
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit -p packages/docs/tsconfig.json`
Expected: No errors (or run full `npm run build` if docs tsconfig doesn't exist standalone)

**Step 3: Commit**

```bash
git add packages/docs/src/memory-s3-client.ts
git commit -m "feat(docs): add in-memory S3 client for playground (#242)"
```

---

### Task 2: Add `s3` flag to NodeExample and playground scope

**Files:**
- Modify: `packages/docs/src/examples/types.ts`
- Modify: `packages/docs/src/playground-scope.ts`

**Step 1: Add `s3` flag to types**

In `packages/docs/src/examples/types.ts`, add to `NodeExample` interface:

```ts
  /** When set, the playground provides an in-memory S3 client. */
  s3?: true;
```

**Step 2: Add `s3` parameter to playground scope**

In `packages/docs/src/playground-scope.ts`:

1. Add `s3?: true` parameter to `createPlaygroundScope`:

```ts
export async function createPlaygroundScope(
  fakeConsole: Record<string, (...args: unknown[]) => void>,
  mockInterpreter?: Record<string, unknown>,
  pgliteDb?: unknown,
  redis?: true,
  s3?: true,
) {
```

2. After the Redis wiring block (after line 87), add S3 wiring:

```ts
  // Wire in-memory S3 when s3 flag is set
  if (s3) {
    const { MemoryS3Client } = await import("./memory-s3-client");
    const pluginS3 = await import("@mvfm/plugin-s3");
    const client = new MemoryS3Client();
    injected.s3_ = pluginS3.s3({ region: "us-east-1" });
    injected.memoryS3Interpreter = pluginS3.createS3Interpreter(client);
  }
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/docs/src/examples/types.ts packages/docs/src/playground-scope.ts
git commit -m "feat(docs): wire in-memory S3 client into playground scope (#242)"
```

---

### Task 3: Create S3 doc examples

**Files:**
- Create: `packages/docs/src/examples/s3.ts`
- Modify: `packages/docs/src/examples/index.ts`

**Step 1: Write examples**

Create `packages/docs/src/examples/s3.ts`:

```ts
import type { NodeExample } from "./types";

const S3 = ["@mvfm/plugin-s3"];

const examples: Record<string, NodeExample> = {
  "s3/put_object": {
    description: "Upload a text object to an S3 bucket",
    code: `const app = mvfm(prelude, s3_);
const prog = app({}, ($) => {
  return $.s3.putObject({
    Bucket: "my-bucket",
    Key: "greeting.txt",
    Body: "hello world",
  });
});
await foldAST(
  defaults(app, { s3: memoryS3Interpreter }),
  prog
);`,
    plugins: S3,
    s3: true,
  },

  "s3/get_object": {
    description: "Download an object from S3 and read its body",
    code: `const app = mvfm(prelude, s3_);
const prog = app({}, ($) => {
  return $.begin(
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "data.json",
      Body: '{"count":42}',
    }),
    $.s3.getObject({ Bucket: "my-bucket", Key: "data.json" })
  );
});
await foldAST(
  defaults(app, { s3: memoryS3Interpreter }),
  prog
);`,
    plugins: S3,
    s3: true,
  },

  "s3/delete_object": {
    description: "Delete an object from an S3 bucket",
    code: `const app = mvfm(prelude, s3_);
const prog = app({}, ($) => {
  return $.begin(
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "temp.txt",
      Body: "temporary data",
    }),
    $.s3.deleteObject({ Bucket: "my-bucket", Key: "temp.txt" })
  );
});
await foldAST(
  defaults(app, { s3: memoryS3Interpreter }),
  prog
);`,
    plugins: S3,
    s3: true,
  },

  "s3/head_object": {
    description: "Check if an object exists and retrieve its metadata",
    code: `const app = mvfm(prelude, s3_);
const prog = app({}, ($) => {
  return $.begin(
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "report.csv",
      Body: "name,score\\nAlice,95\\nBob,87",
      ContentType: "text/csv",
    }),
    $.s3.headObject({ Bucket: "my-bucket", Key: "report.csv" })
  );
});
await foldAST(
  defaults(app, { s3: memoryS3Interpreter }),
  prog
);`,
    plugins: S3,
    s3: true,
  },

  "s3/list_objects_v2": {
    description: "List objects in an S3 bucket filtered by prefix",
    code: `const app = mvfm(prelude, s3_);
const prog = app({}, ($) => {
  return $.begin(
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "uploads/photo.jpg",
      Body: "<photo data>",
    }),
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "uploads/doc.pdf",
      Body: "<pdf data>",
    }),
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "config/settings.json",
      Body: '{"theme":"dark"}',
    }),
    $.s3.listObjectsV2({
      Bucket: "my-bucket",
      Prefix: "uploads/",
    })
  );
});
await foldAST(
  defaults(app, { s3: memoryS3Interpreter }),
  prog
);`,
    plugins: S3,
    s3: true,
  },
};

export default examples;
```

**Step 2: Register in index**

In `packages/docs/src/examples/index.ts`, add import and register:

```ts
import s3 from "./s3";
```

Add `s3,` to the `modules` array (after `redisStrings`).

**Step 3: Build and verify**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/docs/src/examples/s3.ts packages/docs/src/examples/index.ts
git commit -m "feat(docs): add S3 plugin documentation examples (#242)"
```

---

### Task 4: Add S3 to coverage script

**Files:**
- Modify: `scripts/check-docs-coverage.ts`

**Step 1: Add S3 plugin import**

In `scripts/check-docs-coverage.ts`, add after the redis import (line 26):

```ts
import { s3 as s3Plugin } from "../packages/plugin-s3/src/3.989.0/index.js";
```

Add to the `plugins` array:

```ts
  s3Plugin({ region: "us-east-1" }),
```

**Step 2: Run coverage check**

Run: `npx tsx scripts/check-docs-coverage.ts`
Expected: "All N node kinds have documentation examples."

**Step 3: Commit**

```bash
git add scripts/check-docs-coverage.ts
git commit -m "feat(docs): add S3 plugin to docs coverage check (#242)"
```

---

### Task 5: Final validation

**Step 1: Full build and test**

Run: `npm run build && npm run check && npm test`
Expected: All pass

**Step 2: Run docs coverage**

Run: `npx tsx scripts/check-docs-coverage.ts`
Expected: All node kinds covered

**Step 3: Verify line counts**

Check that all new/modified files are under 300 lines:
- `packages/docs/src/memory-s3-client.ts` — ~95 lines
- `packages/docs/src/examples/s3.ts` — ~95 lines
