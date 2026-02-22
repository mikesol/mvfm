/**
 * Type-level tests for ExtractKinds / Plugin ctor-kind enforcement.
 */
import { describe, it } from "vitest";
import type { CExpr } from "../src/expr";
import type { Plugin } from "../src/plugin";
import type { KindSpec } from "../src/registry";

describe("ExtractKinds enforcement", () => {
  it("plugin with matching ctors and kinds compiles", () => {
    const good = {
      name: "test" as const,
      ctors: {
        add: <A, B>(_a: A, _b: B): CExpr<number, "test/add", [A, B]> =>
          null! as CExpr<number, "test/add", [A, B]>,
      },
      kinds: {
        "test/add": {
          inputs: [0, 0] as [number, number],
          output: 0 as number,
        } as KindSpec<[number, number], number>,
      },
      traits: {},
      lifts: {},
    } satisfies Plugin;
    void good;
  });

  it("plugin with unregistered kind fails to compile", () => {
    const bad = {
      name: "test" as const,
      ctors: {
        add: <A, B>(_a: A, _b: B): CExpr<number, "test/add", [A, B]> =>
          null! as CExpr<number, "test/add", [A, B]>,
        sub: <A, B>(_a: A, _b: B): CExpr<number, "test/sub", [A, B]> =>
          null! as CExpr<number, "test/sub", [A, B]>,
      },
      kinds: {
        "test/add": {
          inputs: [0, 0] as [number, number],
          output: 0 as number,
        } as KindSpec<[number, number], number>,
      },
      traits: {},
      lifts: {},
    };
    // @ts-expect-error — ctors collapse to never because test/sub not in kinds
    const _check: Plugin = bad;
    void _check;
  });

  it("plugin producing core/* kinds compiles without declaring them", () => {
    const coreRef = {
      name: "myplug" as const,
      ctors: {
        each: (_items: unknown[], _fn: (i: unknown) => unknown) => {
          return null! as CExpr<unknown, "core/begin", unknown[]>;
        },
        loop: (_cond: unknown) => ({
          body: (_fn: () => unknown) => null! as CExpr<unknown, "myplug/while", [unknown, unknown]>,
        }),
      },
      kinds: {
        "myplug/while": {
          inputs: [] as unknown[],
          output: undefined as unknown,
        } as KindSpec<unknown[], unknown>,
      },
      traits: {},
      lifts: {},
    } satisfies Plugin;
    void coreRef;
  });

  it("nested ctor objects work with ExtractKinds", () => {
    const nested = {
      name: "ns" as const,
      ctors: {
        ns: {
          get: <A>(_key: A): CExpr<string | null, "ns/get", [A]> =>
            null! as CExpr<string | null, "ns/get", [A]>,
          set: <A, B>(_key: A, _val: B): CExpr<string, "ns/set", [A, B]> =>
            null! as CExpr<string, "ns/set", [A, B]>,
        },
      },
      kinds: {
        "ns/get": {
          inputs: [""] as [string],
          output: null as string | null,
        } as KindSpec<[string], string | null>,
        "ns/set": {
          inputs: ["", ""] as [string, string],
          output: "" as string,
        } as KindSpec<[string, string], string>,
      },
      traits: {},
      lifts: {},
    } satisfies Plugin;
    void nested;
  });
});
