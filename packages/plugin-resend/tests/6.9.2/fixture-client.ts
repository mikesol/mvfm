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

/**
 * Route table for Resend API paths.
 * Order matters: `/emails/batch` must precede `/emails/{id}`.
 */
const routes: Route[] = [
  { method: "POST", pattern: /^\/emails$/, operation: "send_email" },
  { method: "POST", pattern: /^\/emails\/batch$/, operation: "send_batch" },
  { method: "GET", pattern: /^\/emails\/[^/]+$/, operation: "get_email" },
  { method: "POST", pattern: /^\/contacts$/, operation: "create_contact" },
  { method: "GET", pattern: /^\/contacts\/[^/]+$/, operation: "get_contact" },
  { method: "GET", pattern: /^\/contacts$/, operation: "list_contacts" },
  {
    method: "DELETE",
    pattern: /^\/contacts\/[^/]+$/,
    operation: "remove_contact",
  },
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
 * Each operation is stored in its own file: `{fixturesDir}/{operation}.json`.
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
    async request(method: string, path: string, params?: unknown): Promise<unknown> {
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
 * Create a recording client that proxies HTTP requests to a real backend,
 * captures request/response pairs, and saves per-operation JSON files on
 * {@link RecordingResendClient.save}.
 *
 * @param baseUrl - Base URL of the backend (e.g. `http://localhost:4010`).
 * @param fixturesDir - Directory to write fixture JSON files into.
 * @returns A {@link RecordingResendClient} that records and saves fixtures.
 */
export function createRecordingClient(baseUrl: string, fixturesDir: string): RecordingResendClient {
  const recorded = new Map<string, Fixture>();

  return {
    async request(method: string, path: string, params?: unknown): Promise<unknown> {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY ?? ""}`,
      };

      let url = `${baseUrl}${path}`;
      let body: string | undefined;

      if (params != null && (method === "POST" || method === "PUT")) {
        body = JSON.stringify(params);
      } else if (params != null) {
        const qs = new URLSearchParams(
          Object.entries(params as Record<string, unknown>).map(([key, value]) => [
            key,
            String(value),
          ]),
        ).toString();
        url = `${url}?${qs}`;
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
