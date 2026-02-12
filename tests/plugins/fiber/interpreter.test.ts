import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { error } from "../../../src/plugins/error";
import { errorInterpreter } from "../../../src/plugins/error/interpreter";
import { fiber } from "../../../src/plugins/fiber";
import { fiberInterpreter } from "../../../src/plugins/fiber/interpreter";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { semiring } from "../../../src/plugins/semiring";
import { array } from "../../../src/schema";

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

const interp = composeInterpreters([
  errorInterpreter,
  fiberInterpreter,
  coreInterpreter,
  numInterpreter,
]);

const app = ilo(num, semiring, fiber, error);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  return await Promise.resolve(interp(ast.result));
}

describe("fiber interpreter: par (tuple form)", () => {
  it("runs branches in parallel and returns all results", async () => {
    const prog = app(($) => $.par(1, 2, 3));
    expect(await run(prog)).toEqual([1, 2, 3]);
  });

  it("works with computed expressions", async () => {
    const prog = app(($) => $.par($.add(1, 2), $.add(3, 4)));
    expect(await run(prog)).toEqual([3, 7]);
  });
});

describe("fiber interpreter: par_map", () => {
  it("maps identity over a collection", async () => {
    const prog = app({ items: array("number") }, ($) =>
      $.par($.input.items, { concurrency: 2 }, (item) => item),
    );
    expect(await run(prog, { items: [10, 20, 30] })).toEqual([10, 20, 30]);
  });

  it("transforms each item with a computed expression", async () => {
    const prog = app({ items: array("number") }, ($) =>
      $.par($.input.items, { concurrency: 2 }, (item) => $.add(item, 100)),
    );
    expect(await run(prog, { items: [1, 2, 3, 4] })).toEqual([101, 102, 103, 104]);
  });

  it("respects concurrency limit by processing in batches", async () => {
    // 5 items with concurrency 2 → 3 batches (2, 2, 1)
    const prog = app({ items: array("number") }, ($) =>
      $.par($.input.items, { concurrency: 2 }, (item) => $.mul(item, 2)),
    );
    expect(await run(prog, { items: [1, 2, 3, 4, 5] })).toEqual([2, 4, 6, 8, 10]);
  });

  it("handles empty collection", async () => {
    const prog = app({ items: array("number") }, ($) =>
      $.par($.input.items, { concurrency: 3 }, (item) => item),
    );
    expect(await run(prog, { items: [] })).toEqual([]);
  });

  it("handles concurrency larger than collection size", async () => {
    const prog = app({ items: array("number") }, ($) =>
      $.par($.input.items, { concurrency: 100 }, (item) => $.add(item, 1)),
    );
    expect(await run(prog, { items: [10, 20] })).toEqual([11, 21]);
  });
});

describe("fiber interpreter: seq", () => {
  it("runs steps sequentially and returns last result", async () => {
    const prog = app(($) => $.seq(1, 2, 42));
    expect(await run(prog)).toBe(42);
  });

  it("returns result of last expression", async () => {
    const prog = app(($) => $.seq($.add(1, 2), $.add(3, 4), $.add(10, 20)));
    expect(await run(prog)).toBe(30);
  });
});

describe("fiber interpreter: race", () => {
  it("returns one of the branch values", async () => {
    const prog = app(($) => $.race($.add(5, 5), $.add(10, 10)));
    const result = await run(prog);
    expect([10, 20]).toContain(result);
  });

  it("returns a sync value", async () => {
    // With all sync values, Promise.race returns the first resolved
    const prog = app(($) => $.race($.add(40, 2)));
    expect(await run(prog)).toBe(42);
  });
});

describe("fiber interpreter: timeout", () => {
  it("returns value when expression resolves before timeout", async () => {
    const prog = app(($) => $.timeout($.add(40, 2), 1000, "fallback"));
    expect(await run(prog)).toBe(42);
  });

  it("returns computed expression before timeout", async () => {
    const prog = app(($) => $.timeout($.add(10, 20), 1000, "default"));
    expect(await run(prog)).toBe(30);
  });
});

describe("fiber interpreter: retry", () => {
  it("returns value on success", async () => {
    const prog = app(($) => $.retry($.add(40, 2), { attempts: 3, delay: 0 }));
    expect(await run(prog)).toBe(42);
  });

  it("returns computed value on success", async () => {
    const prog = app(($) => $.retry($.add(10, 20), { attempts: 3, delay: 0 }));
    expect(await run(prog)).toBe(30);
  });

  it("rejects after exhausting all attempts", async () => {
    const prog = app(($) => $.retry($.fail("boom"), { attempts: 2, delay: 0 }));
    await expect(run(prog)).rejects.toBe("boom");
  });
});

describe("fiber interpreter: composition with error plugin", () => {
  it("par rejects when any branch fails (Promise.all semantics)", async () => {
    const prog = app(($) => $.par(42, $.fail("boom")));
    await expect(run(prog)).rejects.toBe("boom");
  });

  it("par failure can be caught with try/catch", async () => {
    const prog = app(($) => $.try($.par(42, $.fail("boom"))).catch((err) => err));
    expect(await run(prog)).toBe("boom");
  });

  it("seq with fail stops at the failing step", async () => {
    const prog = app(($) => $.seq($.fail("boom"), 42));
    await expect(run(prog)).rejects.toBe("boom");
  });
});
