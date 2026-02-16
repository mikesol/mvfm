import { describe, expect, it } from "vitest";
import type { Interpreter, TypedNode } from "../../src/fold";
import { eval_, foldAST } from "../../src/fold";

describe("async engine: foldAST", () => {
  it("returns a Promise", async () => {
    const interpreter: Interpreter = {
      // biome-ignore lint/correctness/useYield: leaf handler
      "test/literal": async function* (node: any) {
        return node.value;
      },
    };
    const result = foldAST(interpreter, { kind: "test/literal", value: 42 } as TypedNode);
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(42);
  });

  it("recurse passes values between handlers", async () => {
    const interpreter: Interpreter = {
      // biome-ignore lint/correctness/useYield: leaf handler
      "inner/value": async function* (node: any) {
        return node.value;
      },
      "outer/double": async function* (node: any) {
        const val = (yield* eval_(node.inner)) as number;
        return val * 2;
      },
    };
    const result = await foldAST(interpreter, {
      kind: "outer/double",
      inner: { kind: "inner/value", value: 21 },
    } as TypedNode);
    expect(result).toBe(42);
  });
});
