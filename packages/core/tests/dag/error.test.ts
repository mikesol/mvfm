/**
 * Tests for error DAG plugin.
 */

import { describe, it, expect } from "vitest";
import { node } from "../../src/dag/builder";
import { app } from "../../src/dag/03-normalize";
import { fold } from "../../src/dag/fold";
import { createCoreDagInterpreter } from "../../src/dag/core-interpreter";
import { createErrorDagInterpreter } from "../../src/plugins/error/dag-interpreter";

const interp = {
  ...createCoreDagInterpreter(),
  ...createErrorDagInterpreter(),
};

describe("error DAG interpreter", () => {
  it("error/fail throws the error value", async () => {
    const errVal = node<string>("core/literal", [], "boom");
    const fail = node<never>("error/fail", [errVal]);
    const expr = app(fail);
    await expect(fold(expr, interp)).rejects.toBe("boom");
  });

  it("error/try: success path returns value", async () => {
    const val = node<number>("core/literal", [], 42);
    const fallback = node<number>("core/literal", [], 0);
    const tryNode = node<number>("error/try", [val, fallback]);
    const expr = app(tryNode);
    expect(await fold(expr, interp)).toBe(42);
  });

  it("error/try: catches error and yields catch body", async () => {
    // child 0 = error/fail(error), child 1 = fallback value
    const errVal = node<string>("core/literal", [], "oops");
    const fail = node<never>("error/fail", [errVal]);
    const fallback = node<string>("core/literal", [], "recovered");
    const tryNode = node<string>("error/try", [fail, fallback]);
    const expr = app(tryNode);
    expect(await fold(expr, interp)).toBe("recovered");
  });

  it("error/try: rethrows when no catch child", async () => {
    const errVal = node<string>("core/literal", [], "rethrown");
    const fail = node<never>("error/fail", [errVal]);
    const tryNode = node<never>("error/try", [fail]);
    const expr = app(tryNode);
    await expect(fold(expr, interp)).rejects.toBe("rethrown");
  });

  it("error/attempt: success returns {ok, err: null}", async () => {
    const val = node<number>("core/literal", [], 42);
    const attempt = node<unknown>("error/attempt", [val]);
    const expr = app(attempt);
    expect(await fold(expr, interp)).toEqual({ ok: 42, err: null });
  });

  it("error/attempt: failure returns {ok: null, err}", async () => {
    const errVal = node<string>("core/literal", [], "fail");
    const fail = node<never>("error/fail", [errVal]);
    const attempt = node<unknown>("error/attempt", [fail]);
    const expr = app(attempt);
    expect(await fold(expr, interp)).toEqual({ ok: null, err: "fail" });
  });

  it("error/guard: passes when condition is true", async () => {
    const cond = node<boolean>("core/literal", [], true);
    const errVal = node<string>("core/literal", [], "should not throw");
    const guard = node<void>("error/guard", [cond, errVal]);
    const expr = app(guard);
    expect(await fold(expr, interp)).toBe(undefined);
  });

  it("error/guard: throws when condition is false", async () => {
    const cond = node<boolean>("core/literal", [], false);
    const errVal = node<string>("core/literal", [], "guard failed");
    const guard = node<void>("error/guard", [cond, errVal]);
    const expr = app(guard);
    await expect(fold(expr, interp)).rejects.toBe("guard failed");
  });

  it("error/settle: collects successes and failures", async () => {
    const ok1 = node<number>("core/literal", [], 1);
    const errVal = node<string>("core/literal", [], "err");
    const fail = node<never>("error/fail", [errVal]);
    const ok2 = node<number>("core/literal", [], 2);
    const settle = node<unknown>("error/settle", [ok1, fail, ok2]);
    const expr = app(settle);
    expect(await fold(expr, interp)).toEqual({
      fulfilled: [1, 2],
      rejected: ["err"],
    });
  });

  it("error/settle: all succeed", async () => {
    const a = node<number>("core/literal", [], 1);
    const b = node<number>("core/literal", [], 2);
    const settle = node<unknown>("error/settle", [a, b]);
    const expr = app(settle);
    expect(await fold(expr, interp)).toEqual({
      fulfilled: [1, 2],
      rejected: [],
    });
  });

  it("error/settle: all fail", async () => {
    const e1 = node<string>("core/literal", [], "a");
    const f1 = node<never>("error/fail", [e1]);
    const e2 = node<string>("core/literal", [], "b");
    const f2 = node<never>("error/fail", [e2]);
    const settle = node<unknown>("error/settle", [f1, f2]);
    const expr = app(settle);
    expect(await fold(expr, interp)).toEqual({
      fulfilled: [],
      rejected: ["a", "b"],
    });
  });
});
