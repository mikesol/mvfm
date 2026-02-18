# Twilio Fixture-Backed Integration Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace in-memory mock client with Prism-recorded, fixture-backed integration tests that detect contract drift.

**Architecture:** Follow the established Anthropic plugin fixture pattern — route table maps method+path to operation names, one JSON fixture file per operation, `createFixtureClient` for replay with contract drift detection. Add a recording client + Prism orchestration script (first of its kind in the repo) for generating fixtures.

**Tech Stack:** Vitest, Prism CLI (`@stoplight/prism-cli`), Twilio OpenAPI spec, Node.js `child_process`

---

### Task 1: Create the fixture client module

**Files:**
- Create: `packages/plugin-twilio/tests/5.5.1/fixture-client.ts`

**Step 1: Write the fixture client with route table, replay, and recording support**

Follow the Anthropic pattern from `packages/plugin-anthropic/tests/0.74.0/fixture-client.ts`. The Twilio plugin has 6 operations on 2 resources.

```typescript
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TwilioClient } from "../../src/5.5.1/interpreter";

/** Shape of a recorded fixture file. */
export interface Fixture {
  request: { method: string; path: string; params?: Record<string, unknown> };
  response: unknown;
}

/** Route table entry mapping HTTP method + path regex to an operation name. */
interface Route {
  method: string;
  pattern: RegExp;
  operation: string;
}

const routes: Route[] = [
  { method: "POST", pattern: /\/Messages\.json$/, operation: "create_message" },
  { method: "GET", pattern: /\/Messages\/[^/]+\.json$/, operation: "fetch_message" },
  { method: "GET", pattern: /\/Messages\.json$/, operation: "list_messages" },
  { method: "POST", pattern: /\/Calls\.json$/, operation: "create_call" },
  { method: "GET", pattern: /\/Calls\/[^/]+\.json$/, operation: "fetch_call" },
  { method: "GET", pattern: /\/Calls\.json$/, operation: "list_calls" },
];

/**
 * Resolve an HTTP method + path to the canonical operation name.
 */
export function resolveOperation(method: string, path: string): string {
  const stripped = path.split("?")[0];
  for (const route of routes) {
    if (route.method === method && route.pattern.test(stripped)) {
      return route.operation;
    }
  }
  throw new Error(`No matching operation for ${method} ${path}`);
}

/**
 * Deterministic JSON stringify with sorted object keys.
 */
export function sortedStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

/**
 * Create a replay TwilioClient that serves responses from JSON fixture files
 * and detects contract drift when request params change.
 */
export function createFixtureClient(fixturesDir: string): TwilioClient {
  const cache = new Map<string, Fixture>();

  function loadFixture(operation: string): Fixture {
    const cached = cache.get(operation);
    if (cached) return cached;
    const filePath = join(fixturesDir, `${operation}.json`);
    const raw = readFileSync(filePath, "utf-8");
    const fixture = JSON.parse(raw) as Fixture;
    cache.set(operation, fixture);
    return fixture;
  }

  return {
    async request(method, path, params?) {
      const operation = resolveOperation(method, path);
      const fixture = loadFixture(operation);

      if (fixture.request.params !== undefined) {
        const expected = sortedStringify(fixture.request.params);
        const actual = sortedStringify(params);
        if (expected !== actual) {
          throw new Error(
            `Contract drift detected for "${operation}".\n` +
              `Expected params: ${expected}\n` +
              `Actual params:   ${actual}`,
          );
        }
      }

      return fixture.response;
    },
  };
}

/**
 * Create a recording TwilioClient that proxies requests to a real backend
 * (e.g. Prism) and captures request/response pairs to fixture files.
 */
export function createRecordingClient(
  baseUrl: string,
  fixturesDir: string,
  credentials: { accountSid: string; authToken: string },
): TwilioClient & { save(): void } {
  const fixtures = new Map<string, Fixture>();

  return {
    async request(method, path, params?) {
      const url = new URL(path, baseUrl);
      const headers: Record<string, string> = {
        Authorization: `Basic ${btoa(`${credentials.accountSid}:${credentials.authToken}`)}`,
      };

      let body: string | undefined;
      if (method === "POST" && params) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        body = new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ).toString();
      } else if (params) {
        for (const [k, v] of Object.entries(params)) {
          url.searchParams.set(k, String(v));
        }
      }

      const res = await fetch(url.toString(), { method, headers, body });
      const response = await res.json();
      const operation = resolveOperation(method, path);

      fixtures.set(operation, {
        request: { method, path, ...(params ? { params } : {}) },
        response,
      });

      return response;
    },

    save() {
      const { mkdirSync } = require("node:fs") as typeof import("node:fs");
      mkdirSync(fixturesDir, { recursive: true });
      for (const [operation, fixture] of fixtures) {
        const filePath = join(fixturesDir, `${operation}.json`);
        writeFileSync(filePath, `${JSON.stringify(fixture, null, 2)}\n`);
      }
    },
  };
}
```

**Step 2: Run type check**

Run: `cd packages/plugin-twilio && npx tsc --noEmit`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add packages/plugin-twilio/tests/5.5.1/fixture-client.ts
git commit -m "feat(twilio): add fixture client with replay and recording support (#87)"
```

---

### Task 2: Create fixture JSON files

**Files:**
- Create: `packages/plugin-twilio/tests/5.5.1/fixtures/create_message.json`
- Create: `packages/plugin-twilio/tests/5.5.1/fixtures/fetch_message.json`
- Create: `packages/plugin-twilio/tests/5.5.1/fixtures/list_messages.json`
- Create: `packages/plugin-twilio/tests/5.5.1/fixtures/create_call.json`
- Create: `packages/plugin-twilio/tests/5.5.1/fixtures/fetch_call.json`
- Create: `packages/plugin-twilio/tests/5.5.1/fixtures/list_calls.json`

**Step 1: Create fixture files with Twilio-realistic response shapes**

These should match the Twilio API v2010 response schema. Since we're recording from Prism later, start with hand-crafted fixtures based on the OpenAPI spec. Prism returns mostly null fields; we provide slightly more realistic data so assertions are meaningful.

`create_message.json`:
```json
{
  "request": {
    "method": "POST",
    "path": "/2010-04-01/Accounts/AC_test_123/Messages.json",
    "params": {
      "to": "+15551234567",
      "from": "+15559876543",
      "body": "Hello"
    }
  },
  "response": {
    "sid": "SM00000000000000000000000000000001",
    "account_sid": "AC_test_123",
    "to": "+15551234567",
    "from": "+15559876543",
    "body": "Hello",
    "status": "queued",
    "direction": "outbound-api",
    "date_created": "Wed, 01 Jan 2025 00:00:00 +0000",
    "date_updated": "Wed, 01 Jan 2025 00:00:00 +0000",
    "date_sent": null,
    "num_segments": "1",
    "num_media": "0",
    "price": null,
    "price_unit": "USD",
    "api_version": "2010-04-01",
    "uri": "/2010-04-01/Accounts/AC_test_123/Messages/SM00000000000000000000000000000001.json"
  }
}
```

`fetch_message.json`:
```json
{
  "request": {
    "method": "GET",
    "path": "/2010-04-01/Accounts/AC_test_123/Messages/SM00000000000000000000000000000001.json"
  },
  "response": {
    "sid": "SM00000000000000000000000000000001",
    "account_sid": "AC_test_123",
    "to": "+15551234567",
    "from": "+15559876543",
    "body": "Hello",
    "status": "delivered",
    "direction": "outbound-api",
    "date_created": "Wed, 01 Jan 2025 00:00:00 +0000",
    "date_updated": "Wed, 01 Jan 2025 00:00:01 +0000",
    "date_sent": "Wed, 01 Jan 2025 00:00:00 +0000",
    "num_segments": "1",
    "num_media": "0",
    "price": "-0.0075",
    "price_unit": "USD",
    "api_version": "2010-04-01",
    "uri": "/2010-04-01/Accounts/AC_test_123/Messages/SM00000000000000000000000000000001.json"
  }
}
```

`list_messages.json`:
```json
{
  "request": {
    "method": "GET",
    "path": "/2010-04-01/Accounts/AC_test_123/Messages.json",
    "params": {
      "limit": 10
    }
  },
  "response": {
    "messages": [
      { "sid": "SM00000000000000000000000000000001", "status": "delivered", "direction": "outbound-api" },
      { "sid": "SM00000000000000000000000000000002", "status": "queued", "direction": "outbound-api" }
    ],
    "uri": "/2010-04-01/Accounts/AC_test_123/Messages.json",
    "page": 0,
    "page_size": 50,
    "first_page_uri": "/2010-04-01/Accounts/AC_test_123/Messages.json?PageSize=50&Page=0",
    "next_page_uri": null,
    "previous_page_uri": null
  }
}
```

`create_call.json`:
```json
{
  "request": {
    "method": "POST",
    "path": "/2010-04-01/Accounts/AC_test_123/Calls.json",
    "params": {
      "to": "+15551234567",
      "from": "+15559876543",
      "url": "https://example.com/twiml"
    }
  },
  "response": {
    "sid": "CA00000000000000000000000000000001",
    "account_sid": "AC_test_123",
    "to": "+15551234567",
    "from": "+15559876543",
    "status": "queued",
    "direction": "outbound-api",
    "date_created": "Wed, 01 Jan 2025 00:00:00 +0000",
    "date_updated": "Wed, 01 Jan 2025 00:00:00 +0000",
    "duration": null,
    "price": null,
    "price_unit": "USD",
    "api_version": "2010-04-01",
    "uri": "/2010-04-01/Accounts/AC_test_123/Calls/CA00000000000000000000000000000001.json"
  }
}
```

`fetch_call.json`:
```json
{
  "request": {
    "method": "GET",
    "path": "/2010-04-01/Accounts/AC_test_123/Calls/CA00000000000000000000000000000001.json"
  },
  "response": {
    "sid": "CA00000000000000000000000000000001",
    "account_sid": "AC_test_123",
    "to": "+15551234567",
    "from": "+15559876543",
    "status": "completed",
    "direction": "outbound-api",
    "duration": "42",
    "date_created": "Wed, 01 Jan 2025 00:00:00 +0000",
    "date_updated": "Wed, 01 Jan 2025 00:00:42 +0000",
    "price": "-0.0200",
    "price_unit": "USD",
    "api_version": "2010-04-01",
    "uri": "/2010-04-01/Accounts/AC_test_123/Calls/CA00000000000000000000000000000001.json"
  }
}
```

`list_calls.json`:
```json
{
  "request": {
    "method": "GET",
    "path": "/2010-04-01/Accounts/AC_test_123/Calls.json",
    "params": {
      "limit": 20
    }
  },
  "response": {
    "calls": [
      { "sid": "CA00000000000000000000000000000001", "status": "completed", "direction": "outbound-api" },
      { "sid": "CA00000000000000000000000000000002", "status": "in-progress", "direction": "outbound-api" }
    ],
    "uri": "/2010-04-01/Accounts/AC_test_123/Calls.json",
    "page": 0,
    "page_size": 50,
    "first_page_uri": "/2010-04-01/Accounts/AC_test_123/Calls.json?PageSize=50&Page=0",
    "next_page_uri": null,
    "previous_page_uri": null
  }
}
```

**Step 2: Commit**

```bash
git add packages/plugin-twilio/tests/5.5.1/fixtures/
git commit -m "feat(twilio): add fixture JSON files for 6 operations (#87)"
```

---

### Task 3: Update integration tests to use fixture client

**Files:**
- Modify: `packages/plugin-twilio/tests/5.5.1/integration.test.ts`

**Step 1: Rewrite integration tests to use fixture client**

Replace the entire file. Key changes:
- Remove `createMockClient()`
- Import `createFixtureClient` from `./fixture-client`
- Use `foldAST` directly instead of `serverEvaluate` (matches Anthropic pattern)
- Update assertions to match realistic fixture response shapes
- Keep the chaining test but note it uses the `fetch_message` fixture regardless of SID (fixture matches by operation, not by SID in path — same as Anthropic pattern for ID-based operations)

```typescript
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Program } from "@mvfm/core";
import {
  coreInterpreter,
  foldAST,
  injectInput,
  mvfm,
  num,
  numInterpreter,
  str,
  strInterpreter,
} from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { twilio as twilioPlugin } from "../../src/5.5.1";
import { createTwilioInterpreter } from "../../src/5.5.1/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const app = mvfm(
  num,
  str,
  twilioPlugin({ accountSid: "AC_test_123", authToken: "auth_test_456" }),
);

async function run(prog: Program) {
  const injected = injectInput(prog, {});
  const combined = {
    ...createTwilioInterpreter(fixtureClient),
    ...coreInterpreter,
    ...numInterpreter,
    ...strInterpreter,
  };
  return await foldAST(combined, injected);
}

// ============================================================
// Messages
// ============================================================

describe("twilio integration: messages", () => {
  it("create message", async () => {
    const prog = app(($) =>
      $.twilio.messages.create({
        to: "+15551234567",
        from: "+15559876543",
        body: "Hello",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.sid).toMatch(/^SM/);
    expect(result.status).toBe("queued");
    expect(result.to).toBe("+15551234567");
    expect(result.from).toBe("+15559876543");
    expect(result.body).toBe("Hello");
    expect(result.direction).toBe("outbound-api");
  });

  it("fetch message", async () => {
    const prog = app(($) =>
      $.twilio.messages("SM00000000000000000000000000000001").fetch(),
    );
    const result = (await run(prog)) as any;
    expect(result.sid).toMatch(/^SM/);
    expect(result.status).toBe("delivered");
    expect(result.body).toBe("Hello");
  });

  it("list messages", async () => {
    const prog = app(($) => $.twilio.messages.list({ limit: 10 }));
    const result = (await run(prog)) as any;
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].sid).toMatch(/^SM/);
  });
});

// ============================================================
// Calls
// ============================================================

describe("twilio integration: calls", () => {
  it("create call", async () => {
    const prog = app(($) =>
      $.twilio.calls.create({
        to: "+15551234567",
        from: "+15559876543",
        url: "https://example.com/twiml",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.sid).toMatch(/^CA/);
    expect(result.status).toBe("queued");
    expect(result.to).toBe("+15551234567");
  });

  it("fetch call", async () => {
    const prog = app(($) =>
      $.twilio.calls("CA00000000000000000000000000000001").fetch(),
    );
    const result = (await run(prog)) as any;
    expect(result.sid).toMatch(/^CA/);
    expect(result.status).toBe("completed");
    expect(result.duration).toBe("42");
  });

  it("list calls", async () => {
    const prog = app(($) => $.twilio.calls.list({ limit: 20 }));
    const result = (await run(prog)) as any;
    expect(result.calls).toHaveLength(2);
    expect(result.calls[0].sid).toMatch(/^CA/);
  });
});

// ============================================================
// Chaining
// ============================================================

describe("twilio integration: chaining", () => {
  it("create message then fetch it by sid", async () => {
    const prog = app(($) => {
      const msg = $.twilio.messages.create({
        to: "+15551234567",
        from: "+15559876543",
        body: "Hello",
      });
      return $.twilio.messages((msg as any).sid).fetch();
    });
    const result = (await run(prog)) as any;
    // Fetch uses the fixture's fetch_message response regardless of SID
    expect(result.sid).toBeDefined();
    expect(result.status).toBe("delivered");
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `cd packages/plugin-twilio && npx vitest run tests/5.5.1/integration.test.ts`
Expected: All 7 tests PASS

**Step 3: Commit**

```bash
git add packages/plugin-twilio/tests/5.5.1/integration.test.ts
git commit -m "feat(twilio): switch integration tests to fixture-backed client (#87)"
```

---

### Task 4: Add fixture-client unit tests

**Files:**
- Create: `packages/plugin-twilio/tests/5.5.1/fixture-client.test.ts`

**Step 1: Write tests for resolveOperation and contract drift detection**

```typescript
import { describe, expect, it } from "vitest";
import { resolveOperation, sortedStringify } from "./fixture-client";

describe("resolveOperation", () => {
  it("matches POST Messages.json to create_message", () => {
    expect(resolveOperation("POST", "/2010-04-01/Accounts/AC123/Messages.json")).toBe(
      "create_message",
    );
  });

  it("matches GET Messages/{sid}.json to fetch_message", () => {
    expect(resolveOperation("GET", "/2010-04-01/Accounts/AC123/Messages/SM123.json")).toBe(
      "fetch_message",
    );
  });

  it("matches GET Messages.json to list_messages", () => {
    expect(resolveOperation("GET", "/2010-04-01/Accounts/AC123/Messages.json")).toBe(
      "list_messages",
    );
  });

  it("matches POST Calls.json to create_call", () => {
    expect(resolveOperation("POST", "/2010-04-01/Accounts/AC123/Calls.json")).toBe("create_call");
  });

  it("matches GET Calls/{sid}.json to fetch_call", () => {
    expect(resolveOperation("GET", "/2010-04-01/Accounts/AC123/Calls/CA123.json")).toBe(
      "fetch_call",
    );
  });

  it("matches GET Calls.json to list_calls", () => {
    expect(resolveOperation("GET", "/2010-04-01/Accounts/AC123/Calls.json")).toBe("list_calls");
  });

  it("throws for unknown route", () => {
    expect(() => resolveOperation("DELETE", "/unknown")).toThrow("No matching operation");
  });
});

describe("sortedStringify", () => {
  it("produces stable output regardless of key order", () => {
    const a = sortedStringify({ z: 1, a: 2 });
    const b = sortedStringify({ a: 2, z: 1 });
    expect(a).toBe(b);
  });

  it("handles nested objects", () => {
    const result = sortedStringify({ b: { d: 1, c: 2 }, a: 3 });
    expect(result).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });
});
```

**Step 2: Run tests**

Run: `cd packages/plugin-twilio && npx vitest run tests/5.5.1/fixture-client.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/plugin-twilio/tests/5.5.1/fixture-client.test.ts
git commit -m "test(twilio): add fixture-client unit tests (#87)"
```

---

### Task 5: Create Prism recording script

**Files:**
- Create: `packages/plugin-twilio/scripts/record-fixtures.ts`
- Modify: `packages/plugin-twilio/package.json` (add `record:fixtures` script)

**Step 1: Write the recording script**

This script starts Prism, runs the recording client against it, and saves fixtures. Uses `child_process` to manage Prism lifecycle.

```typescript
import { execSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRecordingClient } from "../tests/5.5.1/fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../tests/5.5.1/fixtures");
const PRISM_PORT = 4010;
const PRISM_URL = `http://127.0.0.1:${PRISM_PORT}`;
const TWILIO_SPEC =
  "https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json";

// Ensure prism is installed
try {
  execSync("npx @stoplight/prism-cli --version", { stdio: "ignore" });
} catch {
  console.error("Error: @stoplight/prism-cli not found. Install with: npm i -D @stoplight/prism-cli");
  process.exit(1);
}

console.log("Starting Prism mock server...");
const prism = spawn("npx", ["@stoplight/prism-cli", "mock", "-p", String(PRISM_PORT), TWILIO_SPEC], {
  stdio: ["ignore", "pipe", "pipe"],
});

// Wait for Prism to be ready
await new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Prism failed to start within 30s")), 30000);
  prism.stderr?.on("data", (data: Buffer) => {
    const line = data.toString();
    if (line.includes("Prism is listening")) {
      clearTimeout(timeout);
      resolve();
    }
  });
  prism.on("error", (err) => {
    clearTimeout(timeout);
    reject(err);
  });
});

console.log(`Prism listening on ${PRISM_URL}`);

const accountSid = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const authToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const client = createRecordingClient(PRISM_URL, fixturesDir, { accountSid, authToken });

try {
  console.log("Recording create_message...");
  await client.request("POST", `/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    to: "+15551234567",
    from: "+15559876543",
    body: "Hello",
  });

  console.log("Recording fetch_message...");
  await client.request("GET", `/2010-04-01/Accounts/${accountSid}/Messages/SM00000000000000000000000000000001.json`);

  console.log("Recording list_messages...");
  await client.request("GET", `/2010-04-01/Accounts/${accountSid}/Messages.json`, { limit: 10 });

  console.log("Recording create_call...");
  await client.request("POST", `/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    to: "+15551234567",
    from: "+15559876543",
    url: "https://example.com/twiml",
  });

  console.log("Recording fetch_call...");
  await client.request("GET", `/2010-04-01/Accounts/${accountSid}/Calls/CA00000000000000000000000000000001.json`);

  console.log("Recording list_calls...");
  await client.request("GET", `/2010-04-01/Accounts/${accountSid}/Calls.json`, { limit: 20 });

  client.save();
  console.log(`Fixtures saved to ${fixturesDir}`);
} finally {
  prism.kill();
  console.log("Prism stopped.");
}
```

**Step 2: Add npm script to package.json**

Add to `scripts` in `packages/plugin-twilio/package.json`:
```json
"record:fixtures": "npx tsx scripts/record-fixtures.ts"
```

**Step 3: Commit**

```bash
git add packages/plugin-twilio/scripts/record-fixtures.ts packages/plugin-twilio/package.json
git commit -m "feat(twilio): add Prism-based fixture recording script (#87)"
```

---

### Task 6: Run full validation

**Step 1: Run all twilio plugin tests**

Run: `cd packages/plugin-twilio && npm test`
Expected: All tests PASS

**Step 2: Run type check and lint**

Run: `cd packages/plugin-twilio && npm run check`
Expected: PASS

**Step 3: Run build from root**

Run: `npm run build`
Expected: PASS

**Step 4: Commit any remaining fixes, then final validation**

Run: `npm run build && npm run check && npm test` from root
Expected: All PASS
