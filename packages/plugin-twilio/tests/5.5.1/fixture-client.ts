import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
 * Create a replay {@link TwilioClient} that serves responses from JSON
 * fixture files and detects contract drift when request params change.
 *
 * Each operation is stored in its own file: `{fixturesDir}/{operation}.json`.
 *
 * @param fixturesDir - Absolute path to the directory containing fixture JSON files.
 * @returns A {@link TwilioClient} backed by fixtures.
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
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
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

/** A {@link TwilioClient} that can persist its recordings. */
export interface RecordingTwilioClient extends TwilioClient {
  /** Write captured fixtures to disk as per-operation JSON files. */
  save(): void;
}

/**
 * Create a recording client that proxies HTTP requests to a real backend
 * (e.g. a Prism mock server), captures request/response pairs, and saves
 * per-operation JSON files on {@link RecordingTwilioClient.save}.
 *
 * @param baseUrl - Base URL of the backend (e.g. `http://localhost:4010`).
 * @param fixturesDir - Directory to write fixture JSON files into.
 * @param credentials - Twilio account credentials for Basic auth.
 * @returns A {@link RecordingTwilioClient} that records and saves fixtures.
 */
export function createRecordingClient(
  baseUrl: string,
  fixturesDir: string,
  credentials: { accountSid: string; authToken: string },
): RecordingTwilioClient {
  const recorded = new Map<string, Fixture>();

  return {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const encodedAuth = btoa(`${credentials.accountSid}:${credentials.authToken}`);
      const headers: Record<string, string> = {
        Authorization: `Basic ${encodedAuth}`,
      };

      let url = `${baseUrl}${path}`;
      let body: string | undefined;

      if (method === "POST" && params != null) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        body = new URLSearchParams(
          Object.entries(params).map(([key, value]) => [key, String(value)]),
        ).toString();
      } else if (params != null) {
        const qs = new URLSearchParams(
          Object.entries(params).map(([key, value]) => [key, String(value)]),
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
