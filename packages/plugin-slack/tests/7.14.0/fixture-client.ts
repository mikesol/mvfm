import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SlackClient } from "../../src/7.14.0/generated/interpreter";

/** Shape of a recorded fixture file. */
export interface Fixture {
  request: { method: string; params?: Record<string, unknown> };
  response: unknown;
}

/**
 * Deterministic JSON stringify with sorted object keys.
 * Ensures structurally-equal objects produce identical strings.
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
 * Create a replay {@link SlackClient} that serves responses from JSON
 * fixture files and detects contract drift when request params change.
 *
 * @param fixturesDir - Absolute path to the directory containing fixture JSON files.
 * @returns A {@link SlackClient} backed by fixtures.
 */
export function createFixtureClient(fixturesDir: string): SlackClient {
  const cache = new Map<string, Fixture>();

  function loadFixture(method: string): Fixture {
    const cached = cache.get(method);
    if (cached) return cached;
    // "chat.postMessage" -> "chat_postMessage.json"
    const filename = `${method.replace(/\./g, "_")}.json`;
    const filePath = join(fixturesDir, filename);
    const raw = readFileSync(filePath, "utf-8");
    const fixture = JSON.parse(raw) as Fixture;
    cache.set(method, fixture);
    return fixture;
  }

  return {
    async apiCall(method: string, params?: Record<string, unknown>) {
      const fixture = loadFixture(method);
      if (fixture.request.params !== undefined) {
        const expected = sortedStringify(fixture.request.params);
        const actual = sortedStringify(params);
        if (expected !== actual) {
          throw new Error(
            `Contract drift for "${method}".\n` + `Expected: ${expected}\n` + `Actual:   ${actual}`,
          );
        }
      }
      return fixture.response;
    },
  };
}
