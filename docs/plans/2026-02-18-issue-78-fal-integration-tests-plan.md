# Fal Integration Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add integration tests for the fal plugin that replay committed fixtures from real API calls, with a recording mode triggered by `FAL_RECORD=1`.

**Architecture:** A `FalClient` proxy intercepts calls at the interface level. In replay mode it matches requests by `(method, endpointId, normalizedInput)` and returns saved responses. In record mode it delegates to the real SDK and captures responses. Fixtures are committed JSON files.

**Tech Stack:** vitest, `@fal-ai/client` (dev dep, already present), Node `fs` for fixture I/O.

---

### Task 1: Create fixture-client infrastructure

**Files:**
- Create: `packages/plugin-fal/tests/1.9.1/fixture-client.ts`

**Step 1: Write the fixture-client module**

```typescript
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { FalClient } from "../../src/1.9.1/interpreter";

/** A single recorded request/response pair. */
export interface FixtureEntry {
  method: string;
  endpointId: string;
  input: unknown;
  response: unknown;
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

function fixtureKey(method: string, endpointId: string, input: unknown): string {
  return JSON.stringify({ method, endpointId, input: sortKeys(input) });
}

export interface FixtureClient extends FalClient {
  /** Write recorded fixtures to disk (only meaningful in record mode). */
  save(): Promise<void>;
}

/** Create a replaying client that serves responses from committed fixtures. */
export function createReplayClient(fixturePath: string): FixtureClient {
  const raw = readFileSync(fixturePath, "utf-8");
  const entries: FixtureEntry[] = JSON.parse(raw);
  const lookup = new Map<string, FixtureEntry>();
  for (const entry of entries) {
    lookup.set(fixtureKey(entry.method, entry.endpointId, entry.input), entry);
  }

  function replay(method: string, endpointId: string, input: unknown): unknown {
    const key = fixtureKey(method, endpointId, input);
    const entry = lookup.get(key);
    if (!entry) {
      throw new Error(
        `Fixture miss: no recorded response for ${method} ${endpointId}\n` +
        `Input: ${JSON.stringify(sortKeys(input), null, 2)}\n` +
        `Available keys:\n${[...lookup.keys()].join("\n")}`,
      );
    }
    return entry.response;
  }

  return {
    async run(endpointId, options?) { return replay("run", endpointId, options) as any; },
    async subscribe(endpointId, options?) { return replay("subscribe", endpointId, options) as any; },
    async queueSubmit(endpointId, options) { return replay("queueSubmit", endpointId, options) as any; },
    async queueStatus(endpointId, options) { return replay("queueStatus", endpointId, options) as any; },
    async queueResult(endpointId, options) { return replay("queueResult", endpointId, options) as any; },
    async queueCancel(endpointId, options) { replay("queueCancel", endpointId, options); },
    async save() { /* no-op for replay */ },
  };
}

/** Create a recording client that delegates to a real client and captures responses. */
export function createRecordingClient(
  real: FalClient,
  fixturePath: string,
): FixtureClient {
  const entries: FixtureEntry[] = [];

  async function record<T>(method: string, endpointId: string, input: unknown, call: () => Promise<T>): Promise<T> {
    const response = await call();
    entries.push({ method, endpointId, input: sortKeys(input), response });
    return response;
  }

  return {
    run: (eid, opts?) => record("run", eid, opts, () => real.run(eid, opts)),
    subscribe: (eid, opts?) => record("subscribe", eid, opts, () => real.subscribe(eid, opts)),
    queueSubmit: (eid, opts) => record("queueSubmit", eid, opts, () => real.queueSubmit(eid, opts)),
    queueStatus: (eid, opts) => record("queueStatus", eid, opts, () => real.queueStatus(eid, opts)),
    queueResult: (eid, opts) => record("queueResult", eid, opts, () => real.queueResult(eid, opts)),
    async queueCancel(eid, opts) {
      await real.queueCancel(eid, opts);
      entries.push({ method: "queueCancel", endpointId: eid, input: sortKeys(opts), response: undefined });
    },
    async save() {
      mkdirSync(dirname(fixturePath), { recursive: true });
      writeFileSync(fixturePath, JSON.stringify(entries, null, 2) + "\n");
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `cd packages/plugin-fal && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/plugin-fal/tests/1.9.1/fixture-client.ts
git commit -m "feat(fal): add fixture recording/replay client for integration tests"
```

---

### Task 2: Record real fixtures

**Files:**
- Create: `packages/plugin-fal/tests/1.9.1/fixtures/integration.json`

**Step 1: Write a recording script**

Create a temporary script at `packages/plugin-fal/tests/1.9.1/record-fixtures.ts`:

```typescript
import { fal } from "@fal-ai/client";
import { join } from "node:path";
import { wrapFalSdk } from "../../src/1.9.1/client-fal-sdk";
import { createRecordingClient } from "./fixture-client";

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) throw new Error("FAL_API_KEY required");

fal.config({ credentials: FAL_API_KEY });
const realClient = wrapFalSdk(fal);
const fixturePath = join(__dirname, "fixtures/integration.json");
const client = createRecordingClient(realClient, fixturePath);

async function main() {
  // 1. run
  console.log("Recording fal.run...");
  await client.run("fal-ai/fast-sdxl", { input: { prompt: "a cat sitting on a windowsill" } });

  // 2. subscribe
  console.log("Recording fal.subscribe...");
  await client.subscribe("fal-ai/fast-sdxl", {
    input: { prompt: "a dog in a park" },
    mode: "polling",
    pollInterval: 1000,
  });

  // 3. queue.submit
  console.log("Recording queue.submit...");
  const submitted = await client.queueSubmit("fal-ai/fast-sdxl", {
    input: { prompt: "a mountain landscape" },
  });
  const requestId = (submitted as any).request_id;

  // 4. queue.status (wait for completion first)
  console.log("Waiting for completion...");
  await new Promise((r) => setTimeout(r, 5000));
  console.log("Recording queue.status...");
  await client.queueStatus("fal-ai/fast-sdxl", { requestId, logs: true });

  // 5. queue.result
  console.log("Recording queue.result...");
  await client.queueResult("fal-ai/fast-sdxl", { requestId });

  // 6. queue.cancel (separate submission)
  console.log("Recording queue.cancel...");
  const toCancel = await client.queueSubmit("fal-ai/fast-sdxl", {
    input: { prompt: "cancel me" },
  });
  const cancelId = (toCancel as any).request_id;
  await client.queueCancel("fal-ai/fast-sdxl", { requestId: cancelId });

  await client.save();
  console.log("Fixtures saved to", fixturePath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**Step 2: Run the recording script**

Run: `cd packages/plugin-fal && FAL_API_KEY="<from .env>" npx tsx tests/1.9.1/record-fixtures.ts`
Expected: "Fixtures saved to .../fixtures/integration.json"

**Step 3: Verify fixtures look correct**

Read `packages/plugin-fal/tests/1.9.1/fixtures/integration.json` and verify:
- 7 entries (run, subscribe, submit, status, result, submit-for-cancel, cancel)
- `run` response has `data.images[0].url`, `data.seed`, `requestId`
- `subscribe` response has same shape
- `queueSubmit` response has `status: "IN_QUEUE"`, `request_id`, `response_url`, `status_url`, `cancel_url`
- `queueStatus` response has `status` (likely `"COMPLETED"`), `logs` array
- `queueResult` response has `data.images`, `requestId`
- `queueCancel` response is `undefined`

**Step 4: Delete the recording script**

Delete `packages/plugin-fal/tests/1.9.1/record-fixtures.ts` — recording will be done via `FAL_RECORD=1` in the test file itself.

**Step 5: Commit fixtures**

```bash
git add packages/plugin-fal/tests/1.9.1/fixtures/integration.json
git commit -m "feat(fal): add recorded fixtures from real fal API"
```

---

### Task 3: Rewrite integration tests with fixture replay

**Files:**
- Modify: `packages/plugin-fal/tests/1.9.1/integration.test.ts`

The existing file uses mock clients. Replace it entirely with fixture-backed tests.

**Step 1: Write the new integration test file**

```typescript
import { coreInterpreter, injectInput, mvfm, num, str } from "@mvfm/core";
import { join } from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { fal as falPlugin } from "../../src/1.9.1";
import { wrapFalSdk } from "../../src/1.9.1/client-fal-sdk";
import { serverEvaluate } from "../../src/1.9.1/handler.server";
import {
  createRecordingClient,
  createReplayClient,
  type FixtureClient,
} from "./fixture-client";

const FIXTURE_PATH = join(__dirname, "fixtures/integration.json");
const isRecording = !!process.env.FAL_RECORD;

let client: FixtureClient;

beforeAll(async () => {
  if (isRecording) {
    const { fal } = await import("@fal-ai/client");
    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) throw new Error("FAL_API_KEY required when FAL_RECORD=1");
    fal.config({ credentials: apiKey });
    client = createRecordingClient(wrapFalSdk(fal), FIXTURE_PATH);
  } else {
    client = createReplayClient(FIXTURE_PATH);
  }
}, 30_000);

afterAll(async () => {
  await client.save();
}, 10_000);

function evaluate(root: any) {
  return serverEvaluate(client, coreInterpreter)(root);
}

describe("fal integration: real API fixtures", () => {
  it("run returns image data", async () => {
    const app = mvfm(num, str, falPlugin({ credentials: "fixture" }));
    const prog = app(($) =>
      $.fal.run("fal-ai/fast-sdxl", {
        input: { prompt: "a cat sitting on a windowsill" },
      }),
    );
    const result = (await evaluate(injectInput(prog, {}).ast.result)) as any;

    expect(result).toHaveProperty("requestId");
    expect(result).toHaveProperty("data.images");
    expect(result.data.images).toBeInstanceOf(Array);
    expect(result.data.images.length).toBeGreaterThan(0);
    expect(result.data.images[0]).toHaveProperty("url");
    expect(result.data.images[0]).toHaveProperty("width");
    expect(result.data.images[0]).toHaveProperty("height");
    expect(result.data.seed).toEqual(expect.any(Number));
  }, 30_000);

  it("subscribe returns image data", async () => {
    const app = mvfm(num, str, falPlugin({ credentials: "fixture" }));
    const prog = app(($) =>
      $.fal.subscribe("fal-ai/fast-sdxl", {
        input: { prompt: "a dog in a park" },
        mode: "polling",
        pollInterval: 1000,
      }),
    );
    const result = (await evaluate(injectInput(prog, {}).ast.result)) as any;

    expect(result).toHaveProperty("requestId");
    expect(result.data.images.length).toBeGreaterThan(0);
    expect(result.data.images[0].url).toEqual(expect.any(String));
  }, 60_000);

  it("queue lifecycle: submit → status → result", async () => {
    const app = mvfm(num, str, falPlugin({ credentials: "fixture" }));

    // submit
    const submitProg = app(($) =>
      $.fal.queue.submit("fal-ai/fast-sdxl", {
        input: { prompt: "a mountain landscape" },
      }),
    );
    const submitted = (await evaluate(injectInput(submitProg, {}).ast.result)) as any;
    expect(submitted).toHaveProperty("request_id");
    expect(submitted).toHaveProperty("status", "IN_QUEUE");
    expect(submitted).toHaveProperty("response_url");
    expect(submitted).toHaveProperty("status_url");
    expect(submitted).toHaveProperty("cancel_url");

    const requestId = submitted.request_id;

    // status
    const statusProg = app(($) =>
      $.fal.queue.status("fal-ai/fast-sdxl", { requestId, logs: true }),
    );
    const status = (await evaluate(injectInput(statusProg, {}).ast.result)) as any;
    expect(["IN_QUEUE", "IN_PROGRESS", "COMPLETED"]).toContain(status.status);
    expect(status).toHaveProperty("request_id");

    // result
    const resultProg = app(($) =>
      $.fal.queue.result("fal-ai/fast-sdxl", { requestId }),
    );
    const result = (await evaluate(injectInput(resultProg, {}).ast.result)) as any;
    expect(result).toHaveProperty("requestId");
    expect(result.data.images.length).toBeGreaterThan(0);
  }, 60_000);

  it("queue cancel returns undefined", async () => {
    const app = mvfm(num, str, falPlugin({ credentials: "fixture" }));

    // submit something to cancel
    const submitProg = app(($) =>
      $.fal.queue.submit("fal-ai/fast-sdxl", {
        input: { prompt: "cancel me" },
      }),
    );
    const submitted = (await evaluate(injectInput(submitProg, {}).ast.result)) as any;

    // cancel it
    const cancelProg = app(($) =>
      $.fal.queue.cancel("fal-ai/fast-sdxl", {
        requestId: submitted.request_id,
      }),
    );
    const cancelResult = await evaluate(injectInput(cancelProg, {}).ast.result);
    expect(cancelResult).toBeUndefined();
  }, 30_000);
});
```

**Step 2: Run tests in replay mode**

Run: `cd packages/plugin-fal && npx vitest run tests/1.9.1/integration.test.ts`
Expected: All 4 tests pass

**Step 3: Verify fixture miss detection works**

Temporarily change a prompt string in one test (e.g., "a cat" → "a bird"), run tests, and confirm it throws `Fixture miss: no recorded response for run fal-ai/fast-sdxl`. Revert after confirming.

**Step 4: Commit**

```bash
git add packages/plugin-fal/tests/1.9.1/integration.test.ts
git commit -m "feat(fal): rewrite integration tests with fixture replay"
```

---

### Task 4: Verify full build pipeline

**Step 1: Run full validation**

Run: `npm run build && npm run check && npm test`
Expected: All pass. No regressions.

**Step 2: Final commit if any fixups needed**

---

### Task 5: Note on fixture recording for future use

The test file supports `FAL_RECORD=1` mode. To re-record fixtures:

```bash
cd packages/plugin-fal
FAL_RECORD=1 FAL_API_KEY="<key>" npx vitest run tests/1.9.1/integration.test.ts
git add tests/1.9.1/fixtures/
git commit -m "chore(fal): update integration test fixtures"
```

No code change needed for this task — it's documentation of the recording workflow that should be mentioned in the PR description.
