import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OpenAIClient } from "../../src/6.21.0/interpreter";

/** Shape of a recorded fixture file. */
export interface Fixture {
  request: { method: string; path: string; body?: Record<string, unknown> };
  response: unknown;
}

/** Route table entry mapping HTTP method + path regex to an operation name. */
interface Route {
  method: string;
  pattern: RegExp;
  operation: string;
}

const routes: Route[] = [
  { method: "POST", pattern: /^\/chat\/completions(\?|$)/, operation: "create_chat_completion" },
  {
    method: "GET",
    pattern: /^\/chat\/completions\/[^/]+$/,
    operation: "retrieve_chat_completion",
  },
  { method: "GET", pattern: /^\/chat\/completions(\?|$)/, operation: "list_chat_completions" },
  {
    method: "POST",
    pattern: /^\/chat\/completions\/[^/]+$/,
    operation: "update_chat_completion",
  },
  {
    method: "DELETE",
    pattern: /^\/chat\/completions\/[^/]+$/,
    operation: "delete_chat_completion",
  },
  { method: "POST", pattern: /^\/embeddings(\?|$)/, operation: "create_embedding" },
  { method: "POST", pattern: /^\/moderations(\?|$)/, operation: "create_moderation" },
  { method: "POST", pattern: /^\/completions(\?|$)/, operation: "create_completion" },
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
 * Create a replay {@link OpenAIClient} that serves responses from JSON
 * fixture files and detects contract drift when request body changes.
 *
 * @param fixturesDir - Absolute path to the directory containing fixture JSON files.
 * @returns An {@link OpenAIClient} backed by fixtures.
 */
export function createFixtureClient(fixturesDir: string): OpenAIClient {
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
    async request(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
      const operation = resolveOperation(method, path);
      const fixture = loadFixture(operation);

      if (fixture.request.body !== undefined) {
        const expected = sortedStringify(fixture.request.body);
        const actual = sortedStringify(body);
        if (expected !== actual) {
          throw new Error(
            `Contract drift detected for "${operation}".\n` +
              `Expected body: ${expected}\n` +
              `Actual body:   ${actual}`,
          );
        }
      }

      return fixture.response;
    },
  };
}
