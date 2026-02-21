import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("fold reentrancy uses independent memo but shared volatile set", async () => {
  const counts = { volatile: 0 };
  const kind = "volatile/custom";
  koan.VOLATILE_KINDS.add(kind);

  try {
    const adj = {
      c: { kind, children: [], out: undefined },
      s: { kind: "sub/root", children: ["c", "c"], out: undefined },
      r: { kind: "main/root", children: ["s", "c"], out: undefined },
    };

    let interp: Record<
      string,
      (entry: { children: string[] }) => AsyncGenerator<unknown, unknown, unknown>
    >;
    interp = {
      [kind]: async function* () {
        counts.volatile += 1;
        yield* [];
        return counts.volatile;
      },
      "sub/root": async function* () {
        const a = (yield 0) as number;
        const b = (yield 1) as number;
        return a + b;
      },
      "main/root": async function* () {
        const sub = await koan.fold<number>("s", adj, interp as never);
        const direct = (yield 1) as number;
        return { sub, direct };
      },
    };

    await expect(
      koan.fold<{ sub: number; direct: number }>("r", adj, interp as never),
    ).resolves.toEqual({
      sub: 3,
      direct: 3,
    });
    expect(counts.volatile).toBe(3);
  } finally {
    koan.VOLATILE_KINDS.delete(kind);
  }
});

test("sub-fold starts with empty scope stack", async () => {
  const adj = {
    x: { kind: "core/lambda_param", children: [], out: undefined },
    r: { kind: "scope/root", children: ["x"], out: undefined },
  };

  let interp: Record<
    string,
    (entry: { children: string[] }) => AsyncGenerator<unknown, unknown, unknown>
  >;
  interp = {
    "scope/root": async function* () {
      const scoped = (yield {
        type: "recurse_scoped",
        child: 0,
        bindings: [{ paramId: "x", value: 42 }],
      }) as number;

      let isolated = false;
      try {
        await koan.fold("x", adj, interp as never);
      } catch {
        isolated = true;
      }

      return { scoped, isolated };
    },
  };

  await expect(
    koan.fold<{ scoped: number; isolated: boolean }>("r", adj, interp as never),
  ).resolves.toEqual({
    scoped: 42,
    isolated: true,
  });
});
