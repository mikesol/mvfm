import { readFileSync, writeFileSync } from "node:fs";
import type { QueueStatus, Result } from "@fal-ai/client";
import type { FalClient } from "../../src/1.9.1/interpreter";

/** A single recorded request/response pair. */
export interface FixtureEntry {
  method: string;
  endpointId: string;
  input: unknown;
  response: unknown;
}

/** A {@link FalClient} that can persist its recordings. */
export interface FixtureClient extends FalClient {
  /** Write captured fixtures to disk. */
  save(): Promise<void>;
}

/**
 * Deterministic JSON key for matching: `method + endpointId + sortedInput`.
 * Object keys are recursively sorted so structurally-equal inputs produce
 * identical keys regardless of property insertion order.
 */
function matchKey(method: string, endpointId: string, input: unknown): string {
  return `${method}\0${endpointId}\0${sortedStringify(input)}`;
}

function sortedStringify(value: unknown): string {
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
 * Create a replay client backed by a JSON fixture file.
 * Throws on cache miss with a diff showing expected vs actual input.
 */
export function createReplayClient(fixturePath: string): FixtureClient {
  const raw = readFileSync(fixturePath, "utf-8");
  const entries = JSON.parse(raw) as FixtureEntry[];

  const index = new Map<string, FixtureEntry>();
  for (const entry of entries) {
    index.set(matchKey(entry.method, entry.endpointId, entry.input), entry);
  }

  function lookup(method: string, endpointId: string, input: unknown): unknown {
    const key = matchKey(method, endpointId, input);
    const hit = index.get(key);
    if (hit) return hit.response;

    const candidates = entries
      .filter((e) => e.method === method && e.endpointId === endpointId)
      .map((e) => sortedStringify(e.input));

    throw new Error(
      `Fixture miss for ${method} ${endpointId}.\n` +
        `Actual input:   ${sortedStringify(input)}\n` +
        `Recorded inputs: ${candidates.length ? candidates.join("\n                 ") : "(none)"}`,
    );
  }

  return {
    async run(endpointId, options) {
      return lookup("run", endpointId, options) as Result<unknown>;
    },
    async subscribe(endpointId, options) {
      return lookup("subscribe", endpointId, options) as Result<unknown>;
    },
    async queueSubmit(endpointId, options) {
      return lookup("queueSubmit", endpointId, options);
    },
    async queueStatus(endpointId, options) {
      return lookup("queueStatus", endpointId, options) as QueueStatus;
    },
    async queueResult(endpointId, options) {
      return lookup("queueResult", endpointId, options);
    },
    async queueCancel(endpointId, options) {
      lookup("queueCancel", endpointId, options);
    },
    async save() {
      /* Replay client has nothing to save. */
    },
  };
}

/**
 * Create a recording client that delegates to a real {@link FalClient},
 * captures every request/response pair, and writes them to disk on
 * {@link FixtureClient.save}.
 */
export function createRecordingClient(
  real: FalClient,
  fixturePath: string,
): FixtureClient {
  const entries: FixtureEntry[] = [];

  function record(method: string, endpointId: string, input: unknown, response: unknown): void {
    entries.push({ method, endpointId, input, response });
  }

  return {
    async run(endpointId, options) {
      const response = await real.run(endpointId, options);
      record("run", endpointId, options, response);
      return response;
    },
    async subscribe(endpointId, options) {
      const response = await real.subscribe(endpointId, options);
      record("subscribe", endpointId, options, response);
      return response;
    },
    async queueSubmit(endpointId, options) {
      const response = await real.queueSubmit(endpointId, options);
      record("queueSubmit", endpointId, options, response);
      return response;
    },
    async queueStatus(endpointId, options) {
      const response = await real.queueStatus(endpointId, options);
      record("queueStatus", endpointId, options, response);
      return response;
    },
    async queueResult(endpointId, options) {
      const response = await real.queueResult(endpointId, options);
      record("queueResult", endpointId, options, response);
      return response;
    },
    async queueCancel(endpointId, options) {
      await real.queueCancel(endpointId, options);
      record("queueCancel", endpointId, options, undefined);
    },
    async save() {
      writeFileSync(fixturePath, JSON.stringify(entries, null, 2) + "\n");
    },
  };
}
