import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { defaults } from "../../../src/defaults";
import type { TypedNode } from "../../../src/fold";
import { foldAST } from "../../../src/fold";
import { coreInterpreter } from "../../../src/interpreters/core";
import { control } from "../../../src/plugins/control";
import { controlInterpreter } from "../../../src/plugins/control/interpreter";
import { errorInterpreter } from "../../../src/plugins/error/interpreter";

const combined = {
  ...coreInterpreter,
  ...controlInterpreter,
  ...errorInterpreter,
};

describe("control interpreter", () => {
  it("provides defaultInterpreter so defaults(app) works without override", () => {
    const app = mvfm(control);
    expect(() => defaults(app)).not.toThrow();
  });

  it("evaluates each body for every collection item", async () => {
    const node: TypedNode = {
      kind: "control/each",
      collection: { kind: "core/literal", value: [1] },
      param: { kind: "core/lambda_param", name: "item", __id: 1 },
      body: [{ kind: "error/fail", error: { kind: "core/literal", value: "boom" } }],
    };

    await expect(foldAST(combined, node)).rejects.toBe("boom");
  });

  it("returns undefined for while when condition is false", async () => {
    const node: TypedNode = {
      kind: "control/while",
      condition: { kind: "core/literal", value: false },
      body: [{ kind: "error/fail", error: { kind: "core/literal", value: "boom" } }],
    };

    await expect(foldAST(combined, node)).resolves.toBeUndefined();
  });
});
