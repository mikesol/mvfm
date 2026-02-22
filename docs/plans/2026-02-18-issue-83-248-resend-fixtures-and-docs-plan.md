# Resend Fixture Tests + Docs Examples Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Resend's local HTTP mock tests with Twilio-style fixture-backed tests, and add docs examples for all 7 node kinds.

**Architecture:** Fixture client implements `ResendClient` interface with replay/recording modes. Route table maps method+regex→operation. Crystal ball client provides playground mocks. All follows the Twilio pattern exactly.

**Tech Stack:** TypeScript, Vitest, Prism (OpenAPI mock server), `@mvfm/plugin-resend`

---

### Task 1: Create fixture client

**Files:**
- Create: `packages/plugin-resend/tests/6.9.2/fixture-client.ts`

**Step 1: Write the fixture client test file**

Create `packages/plugin-resend/tests/6.9.2/fixture-client.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { resolveOperation, sortedStringify } from "./fixture-client";

describe("resolveOperation", () => {
  it("matches POST /emails to send_email", () => {
    expect(resolveOperation("POST", "/emails")).toBe("send_email");
  });

  it("matches GET /emails/{id} to get_email", () => {
    expect(resolveOperation("GET", "/emails/email_abc123")).toBe("get_email");
  });

  it("matches POST /emails/batch to send_batch", () => {
    expect(resolveOperation("POST", "/emails/batch")).toBe("send_batch");
  });

  it("matches POST /contacts to create_contact", () => {
    expect(resolveOperation("POST", "/contacts")).toBe("create_contact");
  });

  it("matches GET /contacts/{id} to get_contact", () => {
    expect(resolveOperation("GET", "/contacts/contact_abc123")).toBe("get_contact");
  });

  it("matches GET /contacts to list_contacts", () => {
    expect(resolveOperation("GET", "/contacts")).toBe("list_contacts");
  });

  it("matches DELETE /contacts/{id} to remove_contact", () => {
    expect(resolveOperation("DELETE", "/contacts/contact_abc123")).toBe("remove_contact");
  });

  it("throws for unknown route", () => {
    expect(() => resolveOperation("PUT", "/unknown")).toThrow("No matching operation");
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

**Step 2: Run test to verify it fails**

Run: `cd packages/plugin-resend && npx vitest run tests/6.9.2/fixture-client.test.ts`
Expected: FAIL — cannot find `./fixture-client`

**Step 3: Write the fixture client implementation**

Create `packages/plugin-resend/tests/6.9.2/fixture-client.ts`:

```typescript
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ResendClient } from "../../src/6.9.2/interpreter";

/** Shape of a recorded fixture file. */
export interface Fixture {
  request: { method: string; path: string; params?: unknown };
  response: unknown;
}

/** Route table entry mapping HTTP method + path regex to an operation name. */
interface Route {
  method: string;
  pattern: RegExp;
  operation: string;
}

// Order matters: more specific patterns first (e.g. /emails/batch before /emails/{id})
const routes: Route[] = [
  { method: "POST", pattern: /^\/emails\/batch$/, operation: "send_batch" },
  { method: "POST", pattern: /^\/emails$/, operation: "send_email" },
  { method: "GET", pattern: /^\/emails\/[^/]+$/, operation: "get_email" },
  { method: "POST", pattern: /^\/contacts$/, operation: "create_contact" },
  { method: "GET", pattern: /^\/contacts\/[^/]+$/, operation: "get_contact" },
  { method: "GET", pattern: /^\/contacts$/, operation: "list_contacts" },
  { method: "DELETE", pattern: /^\/contacts\/[^/]+$/, operation: "remove_contact" },
];

/**
 * Resolve an HTTP method + path to the canonical operation name.
 * Query strings are stripped before matching.
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
 * Recursively sorts keys so structurally-equal objects produce identical strings.
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
 * Create a replay {@link ResendClient} that serves responses from JSON
 * fixture files and detects contract drift when request params change.
 *
 * @param fixturesDir - Absolute path to the directory containing fixture JSON files.
 * @returns A {@link ResendClient} backed by fixtures.
 */
export function createFixtureClient(fixturesDir: string): ResendClient {
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
    async request(
      method: string,
      path: string,
      params?: unknown,
    ): Promise<unknown> {
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

/** A {@link ResendClient} that can persist its recordings. */
export interface RecordingResendClient extends ResendClient {
  /** Write captured fixtures to disk as per-operation JSON files. */
  save(): void;
}

/**
 * Create a recording client that proxies HTTP requests to a real backend
 * (e.g. a Prism mock server), captures request/response pairs, and saves
 * per-operation JSON files on {@link RecordingResendClient.save}.
 *
 * @param baseUrl - Base URL of the backend (e.g. `http://localhost:4010`).
 * @param fixturesDir - Directory to write fixture JSON files into.
 * @returns A {@link RecordingResendClient} that records and saves fixtures.
 */
export function createRecordingClient(
  baseUrl: string,
  fixturesDir: string,
): RecordingResendClient {
  const recorded = new Map<string, Fixture>();

  return {
    async request(
      method: string,
      path: string,
      params?: unknown,
    ): Promise<unknown> {
      const headers: Record<string, string> = {
        Authorization: "Bearer re_test_fixture_recording",
        "Content-Type": "application/json",
      };

      let url = `${baseUrl}${path}`;
      let body: string | undefined;

      if ((method === "POST" || method === "PATCH") && params != null) {
        body = JSON.stringify(params);
      }

      const response = await fetch(url, { method, headers, body });
      const responseBody: unknown = await response.json();
      const operation = resolveOperation(method, path);

      recorded.set(operation, {
        request: { method, path, ...(params !== undefined ? { params } : {}) },
        response: responseBody,
      });

      return responseBody;
    },

    save(): void {
      mkdirSync(fixturesDir, { recursive: true });
      for (const [operation, fixture] of recorded) {
        const filePath = join(fixturesDir, `${operation}.json`);
        writeFileSync(filePath, `${JSON.stringify(fixture, null, 2)}\n`);
      }
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/plugin-resend && npx vitest run tests/6.9.2/fixture-client.test.ts`
Expected: PASS (all 9 tests)

**Step 5: Commit**

```bash
git add packages/plugin-resend/tests/6.9.2/fixture-client.ts packages/plugin-resend/tests/6.9.2/fixture-client.test.ts
git commit -m "feat(resend): add fixture client with replay and recording modes"
```

---

### Task 2: Create fixture files and record-fixtures script

**Files:**
- Create: `packages/plugin-resend/scripts/record-fixtures.ts`
- Create: `packages/plugin-resend/tests/6.9.2/fixtures/send_email.json`
- Create: `packages/plugin-resend/tests/6.9.2/fixtures/get_email.json`
- Create: `packages/plugin-resend/tests/6.9.2/fixtures/send_batch.json`
- Create: `packages/plugin-resend/tests/6.9.2/fixtures/create_contact.json`
- Create: `packages/plugin-resend/tests/6.9.2/fixtures/get_contact.json`
- Create: `packages/plugin-resend/tests/6.9.2/fixtures/list_contacts.json`
- Create: `packages/plugin-resend/tests/6.9.2/fixtures/remove_contact.json`

**Step 1: Create the record-fixtures script**

Create `packages/plugin-resend/scripts/record-fixtures.ts`:

```typescript
import { execSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRecordingClient } from "../tests/6.9.2/fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../tests/6.9.2/fixtures");
const PRISM_PORT = 4010;
const PRISM_URL = `http://127.0.0.1:${PRISM_PORT}`;
const RESEND_SPEC =
  "https://raw.githubusercontent.com/resend/resend-openapi/main/resend.yaml";

// Ensure prism is installed
try {
  execSync("npx @stoplight/prism-cli --version", { stdio: "ignore" });
} catch {
  console.error("Error: @stoplight/prism-cli not found. Install with: npm i -D @stoplight/prism-cli");
  process.exit(1);
}

console.log("Starting Prism mock server...");
const prism = spawn("npx", ["@stoplight/prism-cli", "mock", "-p", String(PRISM_PORT), RESEND_SPEC], {
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

const client = createRecordingClient(PRISM_URL, fixturesDir);

try {
  console.log("Recording send_email...");
  await client.request("POST", "/emails", {
    from: "onboarding@resend.dev",
    to: "user@example.com",
    subject: "Hello World",
    html: "<p>Welcome!</p>",
  });

  console.log("Recording get_email...");
  await client.request("GET", "/emails/email_00000000-0000-0000-0000-000000000001");

  console.log("Recording send_batch...");
  await client.request("POST", "/emails/batch", [
    {
      from: "onboarding@resend.dev",
      to: "user1@example.com",
      subject: "Hello User 1",
      html: "<p>Hi 1</p>",
    },
    {
      from: "onboarding@resend.dev",
      to: "user2@example.com",
      subject: "Hello User 2",
      html: "<p>Hi 2</p>",
    },
  ]);

  console.log("Recording create_contact...");
  await client.request("POST", "/contacts", {
    email: "user@example.com",
    first_name: "John",
    last_name: "Doe",
  });

  console.log("Recording get_contact...");
  await client.request("GET", "/contacts/contact_00000000-0000-0000-0000-000000000001");

  console.log("Recording list_contacts...");
  await client.request("GET", "/contacts");

  console.log("Recording remove_contact...");
  await client.request("DELETE", "/contacts/contact_00000000-0000-0000-0000-000000000001");

  client.save();
  console.log(`Fixtures saved to ${fixturesDir}`);
} finally {
  prism.kill();
  console.log("Prism stopped.");
}
```

**Step 2: Add record:fixtures script to package.json**

In `packages/plugin-resend/package.json`, add to `"scripts"`:
```json
"record:fixtures": "tsx scripts/record-fixtures.ts"
```

**Step 3: Try running the recording script**

Run: `cd packages/plugin-resend && npm run record:fixtures`

If Prism works: fixtures are saved. If Prism fails with the YAML spec, hand-write the fixture files instead (see Step 4).

**Step 4: Create fixture files manually (fallback)**

If Prism doesn't work cleanly with the Resend spec, write the 7 fixture files by hand. The responses should match what the current `node:http` mock server returns (from the existing `integration.test.ts`).

Create `packages/plugin-resend/tests/6.9.2/fixtures/send_email.json`:
```json
{
  "request": {
    "method": "POST",
    "path": "/emails",
    "params": {
      "from": "sender@example.com",
      "to": "recipient@example.com",
      "subject": "Hello",
      "html": "<p>World</p>"
    }
  },
  "response": {
    "id": "email_mock_001",
    "object": "email"
  }
}
```

Create `packages/plugin-resend/tests/6.9.2/fixtures/get_email.json`:
```json
{
  "request": {
    "method": "GET",
    "path": "/emails/email_abc"
  },
  "response": {
    "id": "email_abc",
    "object": "email",
    "from": "sender@example.com",
    "to": ["recipient@example.com"],
    "subject": "Test",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

Create `packages/plugin-resend/tests/6.9.2/fixtures/send_batch.json`:
```json
{
  "request": {
    "method": "POST",
    "path": "/emails/batch",
    "params": [
      { "from": "a@example.com", "to": "b@example.com", "subject": "One", "html": "<p>1</p>" },
      { "from": "a@example.com", "to": "c@example.com", "subject": "Two", "html": "<p>2</p>" }
    ]
  },
  "response": {
    "data": [
      { "id": "email_batch_0" },
      { "id": "email_batch_1" }
    ]
  }
}
```

Create `packages/plugin-resend/tests/6.9.2/fixtures/create_contact.json`:
```json
{
  "request": {
    "method": "POST",
    "path": "/contacts",
    "params": {
      "email": "user@example.com"
    }
  },
  "response": {
    "id": "contact_mock_001",
    "object": "contact"
  }
}
```

Create `packages/plugin-resend/tests/6.9.2/fixtures/get_contact.json`:
```json
{
  "request": {
    "method": "GET",
    "path": "/contacts/contact_xyz"
  },
  "response": {
    "id": "contact_xyz",
    "object": "contact",
    "email": "user@example.com"
  }
}
```

Create `packages/plugin-resend/tests/6.9.2/fixtures/list_contacts.json`:
```json
{
  "request": {
    "method": "GET",
    "path": "/contacts"
  },
  "response": {
    "object": "list",
    "data": [
      { "id": "contact_1", "email": "a@example.com" }
    ]
  }
}
```

Create `packages/plugin-resend/tests/6.9.2/fixtures/remove_contact.json`:
```json
{
  "request": {
    "method": "DELETE",
    "path": "/contacts/contact_del"
  },
  "response": {
    "object": "contact",
    "id": "contact_mock_001",
    "deleted": true
  }
}
```

**Step 5: Commit**

```bash
git add packages/plugin-resend/scripts/record-fixtures.ts packages/plugin-resend/tests/6.9.2/fixtures/ packages/plugin-resend/package.json
git commit -m "feat(resend): add fixture files and recording script"
```

---

### Task 3: Rewrite integration tests to use fixtures

**Files:**
- Modify: `packages/plugin-resend/tests/6.9.2/integration.test.ts`

**Step 1: Rewrite integration tests**

Replace the entire file with fixture-backed tests. Key changes:
- Remove `node:http` server setup/teardown (`beforeAll`/`afterAll`)
- Remove `createMockClient()` and `serverEvaluate()` usage
- Use `createFixtureClient(fixturesDir)` + `createResendInterpreter(fixtureClient)` + `foldAST()`
- Same test assertions, simpler execution

New `packages/plugin-resend/tests/6.9.2/integration.test.ts`:

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
import { resend as resendPlugin } from "../../src/6.9.2";
import { createResendInterpreter } from "../../src/6.9.2/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const app = mvfm(num, str, resendPlugin({ apiKey: "re_test_fake" }));

async function run(prog: Program) {
  const injected = injectInput(prog, {});
  const combined = {
    ...createResendInterpreter(fixtureClient),
    ...coreInterpreter,
    ...numInterpreter,
    ...strInterpreter,
  };
  return await foldAST(combined, injected);
}

// ============================================================
// Emails
// ============================================================

describe("resend integration: emails", () => {
  it("send email", async () => {
    const prog = app(($) =>
      $.resend.emails.send({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Hello",
        html: "<p>World</p>",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.id).toBe("email_mock_001");
    expect(result.object).toBe("email");
  });

  it("get email", async () => {
    const prog = app(($) => $.resend.emails.get("email_abc"));
    const result = (await run(prog)) as any;
    expect(result.id).toBe("email_abc");
    expect(result.object).toBe("email");
  });
});

// ============================================================
// Batch
// ============================================================

describe("resend integration: batch", () => {
  it("send batch", async () => {
    const prog = app(($) =>
      $.resend.batch.send([
        { from: "a@example.com", to: "b@example.com", subject: "One", html: "<p>1</p>" },
        { from: "a@example.com", to: "c@example.com", subject: "Two", html: "<p>2</p>" },
      ]),
    );
    const result = (await run(prog)) as any;
    expect(result.data).toHaveLength(2);
  });
});

// ============================================================
// Contacts
// ============================================================

describe("resend integration: contacts", () => {
  it("create contact", async () => {
    const prog = app(($) => $.resend.contacts.create({ email: "user@example.com" }));
    const result = (await run(prog)) as any;
    expect(result.id).toBe("contact_mock_001");
  });

  it("get contact", async () => {
    const prog = app(($) => $.resend.contacts.get("contact_xyz"));
    const result = (await run(prog)) as any;
    expect(result.id).toBe("contact_xyz");
    expect(result.email).toBe("user@example.com");
  });

  it("list contacts", async () => {
    const prog = app(($) => $.resend.contacts.list());
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("remove contact", async () => {
    const prog = app(($) => $.resend.contacts.remove("contact_del"));
    const result = (await run(prog)) as any;
    expect(result.deleted).toBe(true);
  });
});

// ============================================================
// Chaining
// ============================================================

describe("resend integration: chaining", () => {
  it("send email then get it by id", async () => {
    const prog = app(($) => {
      const sent = $.resend.emails.send({
        from: "a@example.com",
        to: "b@example.com",
        subject: "Chain",
        html: "<p>Test</p>",
      });
      return $.resend.emails.get((sent as any).id);
    });
    const result = (await run(prog)) as any;
    expect(result.object).toBe("email");
  });
});
```

**Step 2: Run all tests to verify they pass**

Run: `cd packages/plugin-resend && npx vitest run`
Expected: All tests pass (fixture-client tests + rewritten integration tests + existing index/interpreter tests)

**Step 3: Commit**

```bash
git add packages/plugin-resend/tests/6.9.2/integration.test.ts
git commit -m "feat(resend): replace HTTP mock server with fixture-backed tests"
```

---

### Task 4: Add crystal ball client and playground wiring for resend

**Files:**
- Modify: `packages/docs/src/crystal-ball-clients.ts`
- Modify: `packages/docs/src/playground-scope.ts`

**Step 1: Add crystal ball Resend client**

Append to `packages/docs/src/crystal-ball-clients.ts`:

```typescript
// ---- Resend crystal-ball client ----------------------------------

let resendIdCounter = 0;
function nextResendId(prefix: string): string {
  return `${prefix}_crystal_ball_${String(++resendIdCounter).padStart(3, "0")}`;
}

/** Creates a Resend mock client returning prefab crystal-ball responses. */
export function createCrystalBallResendClient(): import("@mvfm/plugin-resend").ResendClient {
  return {
    async request(method: string, path: string, params?: unknown) {
      // Emails
      if (method === "POST" && path === "/emails") {
        return { id: nextResendId("email"), object: "email" };
      }
      if (method === "GET" && /^\/emails\/[^/]+$/.test(path)) {
        return {
          id: path.split("/").pop(),
          object: "email",
          from: "sender@example.com",
          to: ["recipient@example.com"],
          subject: "Test",
          created_at: "2026-01-01T00:00:00Z",
        };
      }
      // Batch
      if (method === "POST" && path === "/emails/batch") {
        const emails = Array.isArray(params) ? params : [];
        return {
          data: emails.map(() => ({ id: nextResendId("email") })),
        };
      }
      // Contacts
      if (method === "POST" && path === "/contacts") {
        return { id: nextResendId("contact"), object: "contact" };
      }
      if (method === "GET" && /^\/contacts\/[^/]+$/.test(path)) {
        return { id: path.split("/").pop(), object: "contact", email: "user@example.com" };
      }
      if (method === "GET" && path === "/contacts") {
        return {
          object: "list",
          data: [{ id: "contact_crystal_ball_001", email: "crystal@example.com" }],
        };
      }
      if (method === "DELETE" && /^\/contacts\/[^/]+$/.test(path)) {
        return { object: "contact", id: path.split("/").pop(), deleted: true };
      }
      throw new Error(`Crystal ball Resend client: unhandled ${method} ${path}`);
    },
  };
}
```

**Step 2: Wire resend into playground scope**

In `packages/docs/src/playground-scope.ts`, add the import at the top:
```typescript
import {
  createCrystalBallAnthropicClient,
  createCrystalBallFalClient,
  createCrystalBallOpenAIClient,
  createCrystalBallResendClient,  // ADD THIS
  createCrystalBallStripeClient,
} from "./crystal-ball-clients";
```

After the Stripe block (around line 71-72), add:
```typescript
const pluginResend = await import("@mvfm/plugin-resend");
const crystalBallResendInterpreter = pluginResend.createResendInterpreter(
  createCrystalBallResendClient(),
);
```

In the `injected` object (around line 92-93), add:
```typescript
resend_: pluginResend.resend({ apiKey: "re_crystal_ball" }),
crystalBallResendInterpreter,
```

**Step 3: Verify docs build**

Run: `npm run build` from root
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/docs/src/crystal-ball-clients.ts packages/docs/src/playground-scope.ts
git commit -m "feat(docs): add crystal ball Resend client and playground wiring"
```

---

### Task 5: Add docs examples for resend

**Files:**
- Create: `packages/docs/src/examples/resend.ts`
- Modify: `packages/docs/src/examples/index.ts`

**Step 1: Create resend examples file**

Create `packages/docs/src/examples/resend.ts`:

```typescript
import type { NodeExample } from "./types";

const RESEND = ["@mvfm/plugin-resend"];

const examples: Record<string, NodeExample> = {
  "resend/send_email": {
    description: "Send an email via Resend",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const result = $.resend.emails.send({
    from: "onboarding@resend.dev",
    to: "user@example.com",
    subject: "Hello World",
    html: "<p>Welcome!</p>",
  });
  return $.console.log(result);
});
await foldAST(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/get_email": {
    description: "Retrieve an email by its ID",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const email = $.resend.emails.get("email_abc123");
  return $.console.log(email);
});
await foldAST(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/send_batch": {
    description: "Send a batch of emails in a single API call",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const batch = $.resend.batch.send([
    { from: "onboarding@resend.dev", to: "user1@example.com", subject: "Hi 1", html: "<p>Email 1</p>" },
    { from: "onboarding@resend.dev", to: "user2@example.com", subject: "Hi 2", html: "<p>Email 2</p>" },
  ]);
  return $.console.log(batch);
});
await foldAST(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/create_contact": {
    description: "Create a contact in Resend",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const contact = $.resend.contacts.create({
    email: "user@example.com",
    firstName: "John",
  });
  return $.console.log(contact);
});
await foldAST(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/get_contact": {
    description: "Retrieve a contact by ID",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const contact = $.resend.contacts.get("contact_abc123");
  return $.console.log(contact);
});
await foldAST(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/list_contacts": {
    description: "List all contacts",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const contacts = $.resend.contacts.list();
  return $.console.log(contacts);
});
await foldAST(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/remove_contact": {
    description: "Remove a contact by ID",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const result = $.resend.contacts.remove("contact_abc123");
  return $.console.log(result);
});
await foldAST(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },
};

export default examples;
```

**Step 2: Wire into examples index**

In `packages/docs/src/examples/index.ts`, add the import:
```typescript
import resend from "./resend";
```

Add `resend` to the `modules` array (after `pino` or wherever alphabetically appropriate).

**Step 3: Add resend to coverage check script**

In `scripts/check-docs-coverage.ts`, add the import:
```typescript
import { resend as resendPlugin } from "../packages/plugin-resend/src/6.9.2/index.js";
```

Add to the `plugins` array:
```typescript
resendPlugin({ apiKey: "unused" }),
```

**Step 4: Run coverage check**

Run: `npx tsx scripts/check-docs-coverage.ts`
Expected: All node kinds have documentation examples (including 7 new resend kinds)

**Step 5: Commit**

```bash
git add packages/docs/src/examples/resend.ts packages/docs/src/examples/index.ts scripts/check-docs-coverage.ts
git commit -m "docs(resend): add examples for all 7 resend node kinds"
```

---

### Task 6: Final validation

**Step 1: Run full build**

Run: `npm run build`
Expected: PASS

**Step 2: Run full check**

Run: `npm run check`
Expected: PASS

**Step 3: Run all tests**

Run: `npm test`
Expected: PASS

**Step 4: Run docs coverage**

Run: `npx tsx scripts/check-docs-coverage.ts`
Expected: All node kinds documented

**Step 5: Commit any remaining fixes, then create PR**

```bash
gh pr create --title "feat(resend): fixture-backed tests + docs examples" --body "$(cat <<'EOF'
Closes #83
Closes #248

## What this does

Replaces the Resend plugin's local HTTP mock server with Twilio-style fixture-backed integration tests, and adds documentation examples for all 7 node kinds.

## Design alignment

Mirrors the Twilio plugin's fixture strategy exactly: route table, replay/recording client, Prism-based recording script, contract drift detection.

## Validation performed

- `npm run build` passes
- `npm run check` passes
- `npm test` passes (fixture-backed integration tests)
- `npx tsx scripts/check-docs-coverage.ts` passes (all 7 resend kinds covered)
EOF
)"
```
