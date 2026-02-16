import { describe, expect, it } from "vitest";
import type { Interpreter, TypedNode } from "../../src/fold";
import { foldAST } from "../../src/fold";
import { coreInterpreter } from "../../src/interpreters/core";
import { errorInterpreter } from "../../src/plugins/error/interpreter";
import { fiberInterpreter } from "../../src/plugins/fiber/interpreter";

describe("DAG memoization: retry with fresh cache", () => {
  it("retry re-executes on each attempt (not cached)", async () => {
    let callCount = 0;
    const sideEffectInterpreter: Interpreter = {
      // biome-ignore lint/correctness/useYield: test handler throws/returns without yielding
      "fx/call": async function* () {
        callCount++;
        if (callCount < 3) throw new Error("not yet");
        return "success";
      },
    };

    const combined = {
      ...sideEffectInterpreter,
      ...fiberInterpreter,
      ...errorInterpreter,
      ...coreInterpreter,
    };

    const result = await foldAST(combined, {
      kind: "fiber/retry",
      expr: { kind: "fx/call" },
      attempts: 5,
      delay: 0,
    } as TypedNode);

    expect(result).toBe("success");
    expect(callCount).toBe(3);
  });

  it("retry exhausts attempts when all fail", async () => {
    let callCount = 0;
    const alwaysFailsInterpreter: Interpreter = {
      // biome-ignore lint/correctness/useYield: test handler throws without yielding
      "fx/call": async function* () {
        callCount++;
        throw new Error("always fails");
      },
    };

    const combined = {
      ...alwaysFailsInterpreter,
      ...fiberInterpreter,
      ...errorInterpreter,
      ...coreInterpreter,
    };

    await expect(
      foldAST(combined, {
        kind: "fiber/retry",
        expr: { kind: "fx/call" },
        attempts: 3,
        delay: 0,
      } as TypedNode),
    ).rejects.toThrow("always fails");
    expect(callCount).toBe(3);
  });
});
