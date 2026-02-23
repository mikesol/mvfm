import { describe, expect, it } from "vitest";
import type { CExpr, Interpreter, KindSpec, Plugin } from "../src";
import {
  boolPlugin,
  composeDollar,
  createApp,
  defaults,
  fold,
  numPlugin,
  resolveStructured,
  strPlugin,
} from "../src";
import { makeCExpr } from "../src/expr";

/**
 * Test plugin with a multi-arg structural kind:
 * mytest/multi takes (id: string, params: object)
 * where id is a normal arg and params is structural.
 */
const testPlugin = {
  name: "mytest",
  ctors: {
    mytest: {
      multi(id: string, params: Record<string, unknown>): CExpr<unknown> {
        return makeCExpr("mytest/multi", [id, params]);
      },
    },
  },
  kinds: {
    "mytest/multi": {
      inputs: ["", undefined] as [string, unknown],
      output: undefined as unknown,
    } as KindSpec<[string, unknown], unknown>,
  },
  traits: {},
  lifts: {},
  shapes: { "mytest/multi": [null, "*"] },
  defaultInterpreter: (): Interpreter => ({
    "mytest/multi": async function* (entry) {
      const id = yield 0;
      const body = yield* resolveStructured(entry.children[1]);
      return { id, body };
    },
  }),
} satisfies Plugin;

const plugins = [numPlugin, strPlugin, boolPlugin, testPlugin] as const;
const $ = composeDollar(...plugins);
const app = createApp(...plugins);

describe("per-arg shapes: [null, '*']", () => {
  it("elaborates and folds correctly with mixed normal+structural args", async () => {
    const expr = $.mytest.multi("test-id", {
      name: "hello",
      count: 42,
    });
    const nexpr = app(expr as Parameters<typeof app>[0]);
    const interp = defaults(plugins);
    const result = (await fold(nexpr, interp)) as { id: string; body: Record<string, unknown> };
    expect(result.id).toBe("test-id");
    expect(result.body).toEqual({ name: "hello", count: 42 });
  });
});
