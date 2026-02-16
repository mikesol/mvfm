import { describe, expect, it } from "vitest";
import { mvfm } from "../src/core";
import { injectInput } from "../src/inject";

const app = mvfm();

describe("injectInput", () => {
  it("returns a Program with __inputData injected into core/input nodes", () => {
    const prog = app({ x: "number" }, ($) => $.input.x);
    const injected = injectInput(prog, { x: 42 });

    // The injected program should have __inputData on core/input nodes
    function findInputNodes(node: any): any[] {
      if (node === null || node === undefined || typeof node !== "object") return [];
      if (Array.isArray(node)) return node.flatMap((n) => findInputNodes(n));
      const results: any[] = [];
      if (node.kind === "core/input") results.push(node);
      for (const v of Object.values(node)) {
        results.push(...findInputNodes(v));
      }
      return results;
    }

    const inputNodes = findInputNodes(injected.ast);
    expect(inputNodes.length).toBeGreaterThan(0);
    for (const node of inputNodes) {
      expect(node.__inputData).toEqual({ x: 42 });
    }
  });

  it("does not mutate the original program", () => {
    const prog = app({ x: "number" }, ($) => $.input.x);
    const originalAst = JSON.stringify(prog.ast);
    injectInput(prog, { x: 99 });
    expect(JSON.stringify(prog.ast)).toBe(originalAst);
  });

  it("preserves non-input nodes unchanged", () => {
    const prog = app(($) => 42);
    const injected = injectInput(prog, { x: 1 });

    // Strip __id for stable comparison
    function strip(ast: unknown): unknown {
      return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
    }

    expect(strip(injected.ast)).toEqual(strip(prog.ast));
  });

  it("preserves Program-level fields (hash, plugins, inputSchema)", () => {
    const prog = app({ x: "number" }, ($) => $.input.x);
    const injected = injectInput(prog, { x: 1 });
    expect(injected.hash).toBe(prog.hash);
    expect(injected.plugins).toEqual(prog.plugins);
    expect(injected.inputSchema).toEqual(prog.inputSchema);
  });
});
