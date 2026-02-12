import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { eq } from "../../../src/plugins/eq";
import { eqInterpreter } from "../../../src/plugins/eq/interpreter";
import { error } from "../../../src/plugins/error";
import { errorInterpreter } from "../../../src/plugins/error/interpreter";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { ord } from "../../../src/plugins/ord";
import { ordInterpreter } from "../../../src/plugins/ord/interpreter";
import { semiring } from "../../../src/plugins/semiring";

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
  coreInterpreter,
  numInterpreter,
  ordInterpreter,
  eqInterpreter,
]);

const app = ilo(num, semiring, eq, ord, error);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  return await Promise.resolve(interp(ast.result));
}

describe("error interpreter: try/catch", () => {
  it("returns value when no error", async () => {
    const prog = app(($) => $.try($.add(40, 2)).catch((_err) => "fallback"));
    expect(await run(prog)).toBe(42);
  });

  it("catches error from $.fail()", async () => {
    const prog = app(($) => $.try($.fail("boom")).catch((err) => err));
    expect(await run(prog)).toBe("boom");
  });

  it("catch callback receives the thrown value", async () => {
    const prog = app(($) =>
      $.try($.fail("specific_error")).catch((err) => ({
        caught: err,
        recovered: true,
      })),
    );
    const result = (await run(prog)) as any;
    expect(result.caught).toBe("specific_error");
    expect(result.recovered).toBe(true);
  });
});

describe("error interpreter: fail", () => {
  it("throws when not caught", async () => {
    const prog = app(($) => $.fail("boom"));
    await expect(run(prog)).rejects.toBe("boom");
  });

  it("throws object errors", async () => {
    const prog = app(($) => $.fail({ code: 404, message: "not found" }));
    await expect(run(prog)).rejects.toEqual({ code: 404, message: "not found" });
  });
});

describe("error interpreter: orElse", () => {
  it("returns original on success", async () => {
    const prog = app(($) => $.orElse($.add(40, 2), "fallback"));
    expect(await run(prog)).toBe(42);
  });

  it("returns fallback on failure", async () => {
    const prog = app(($) => $.orElse($.fail("boom"), "fallback"));
    expect(await run(prog)).toBe("fallback");
  });
});

describe("error interpreter: attempt", () => {
  it("wraps success in {ok, err: null}", async () => {
    const prog = app(($) => $.attempt($.add(40, 2)));
    expect(await run(prog)).toEqual({ ok: 42, err: null });
  });

  it("wraps failure in {ok: null, err}", async () => {
    const prog = app(($) => $.attempt($.fail("boom")));
    expect(await run(prog)).toEqual({ ok: null, err: "boom" });
  });
});

describe("error interpreter: guard", () => {
  it("passes when condition is true", async () => {
    const prog = app(($) => $.do($.guard($.gt(10, 5), "should not throw"), "passed"));
    expect(await run(prog)).toBe("passed");
  });

  it("throws when condition is false", async () => {
    const prog = app(($) => $.do($.guard($.gt(5, 10), "guard failed"), "should not reach"));
    await expect(run(prog)).rejects.toBe("guard failed");
  });

  it("guard with object error", async () => {
    const prog = app(($) => $.do($.guard($.gt(5, 10), { code: 403, message: "forbidden" }), "ok"));
    await expect(run(prog)).rejects.toEqual({ code: 403, message: "forbidden" });
  });
});

describe("error interpreter: settle", () => {
  it("collects all successes", async () => {
    const prog = app(($) => $.settle($.add(40, 2), $.add(1, 2), $.add(3, 4)));
    const result = (await run(prog)) as any;
    expect(result.fulfilled).toEqual([42, 3, 7]);
    expect(result.rejected).toEqual([]);
  });

  it("collects successes and failures", async () => {
    const prog = app(($) => $.settle($.add(40, 2), $.fail("err1"), $.add(1, 2), $.fail("err2")));
    const result = (await run(prog)) as any;
    expect(result.fulfilled).toEqual([42, 3]);
    expect(result.rejected).toEqual(["err1", "err2"]);
  });

  it("collects all failures", async () => {
    const prog = app(($) => $.settle($.fail("a"), $.fail("b"), $.fail("c")));
    const result = (await run(prog)) as any;
    expect(result.fulfilled).toEqual([]);
    expect(result.rejected).toEqual(["a", "b", "c"]);
  });
});

describe("error interpreter: try/match", () => {
  it("matches by string error key", async () => {
    const prog = app(($) =>
      $.try($.fail("not_found")).match({
        not_found: (_err) => "default_user",
        timeout: (_err) => "cached_user",
        _: (_err) => "unknown",
      }),
    );
    expect(await run(prog)).toBe("default_user");
  });

  it("falls through to _ wildcard", async () => {
    const prog = app(($) =>
      $.try($.fail("unknown_error")).match({
        not_found: (_err) => "default_user",
        _: (_err) => "wildcard_hit",
      }),
    );
    expect(await run(prog)).toBe("wildcard_hit");
  });

  it("matches by error object code", async () => {
    const prog = app(($) =>
      $.try($.fail({ code: "timeout", message: "timed out" })).match({
        timeout: (_err) => "retrying",
        _: (_err) => "other",
      }),
    );
    expect(await run(prog)).toBe("retrying");
  });
});

describe("error interpreter: try/finally", () => {
  it("runs finally on success", async () => {
    // We verify the value passes through correctly even with a finally clause.
    const prog = app(($) =>
      $.try($.add(40, 2))
        .finally($.add(1, 1)) // cleanup expression (value discarded)
        .catch((_err) => "fallback"),
    );
    expect(await run(prog)).toBe(42);
  });

  it("runs finally on failure (with catch)", async () => {
    const prog = app(($) =>
      $.try($.fail("boom"))
        .finally($.add(1, 1))
        .catch((err) => err),
    );
    expect(await run(prog)).toBe("boom");
  });
});

describe("error interpreter: composition", () => {
  it("try/catch with guard inside", async () => {
    const prog = app(($) =>
      $.try($.do($.guard($.gt(5, 10), "guard_fail"), "ok")).catch((err) => err),
    );
    expect(await run(prog)).toBe("guard_fail");
  });

  it("nested try/catch", async () => {
    const prog = app(($) =>
      $.try($.try($.fail("inner")).catch((_err) => $.fail("outer"))).catch((err) => err),
    );
    expect(await run(prog)).toBe("outer");
  });
});
