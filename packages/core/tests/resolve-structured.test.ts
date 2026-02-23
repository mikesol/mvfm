import { describe, expect, it } from "vitest";
import { resolveStructured } from "../src/fold";

describe("resolveStructured", () => {
  // Helper: run a resolveStructured generator against a mock memo
  async function resolve(structure: unknown, memo: Record<string, unknown>) {
    const gen = resolveStructured(structure);
    let result = await gen.next();
    while (!result.done) {
      const nodeId = result.value as string;
      result = await gen.next(memo[nodeId]);
    }
    return result.value;
  }

  it("yields string node IDs and returns resolved values", async () => {
    const result = await resolve("a", { a: "hello" });
    expect(result).toBe("hello");
  });

  it("resolves flat objects", async () => {
    const result = await resolve({ model: "a", temperature: "b" }, { a: "gpt-4o", b: 0.7 });
    expect(result).toEqual({ model: "gpt-4o", temperature: 0.7 });
  });

  it("resolves arrays", async () => {
    const result = await resolve(["a", "b"], { a: 1, b: 2 });
    expect(result).toEqual([1, 2]);
  });

  it("resolves nested objects", async () => {
    const result = await resolve(
      { messages: [{ role: "a", content: "b" }] },
      { a: "user", b: "Hello" },
    );
    expect(result).toEqual({ messages: [{ role: "user", content: "Hello" }] });
  });

  it("passes through non-string/object/array values", async () => {
    const result = await resolve(42 as unknown, {});
    expect(result).toBe(42);
  });
});
