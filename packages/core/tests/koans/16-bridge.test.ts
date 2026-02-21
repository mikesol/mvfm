import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 16-bridge: defaults+fold execute full pipeline and support string yields", async () => {
  const $ = koan.mvfmU(...koan.stdPlugins);
  const prog = koan.app($.mul($.add(3, 4), 5));
  const interp = koan.defaults(koan.stdPlugins);

  await expect(koan.fold(prog, interp)).resolves.toBe(35);

  const rewritten = koan.commit(
    koan.pipe(prog, (e) => koan.replaceWhere(e, koan.byKind("num/add"), "num/sub")),
  );
  await expect(koan.fold(rewritten, interp)).resolves.toBe(-5);

  const structAdj = {
    a: { kind: "num/literal", children: [], out: 1 },
    b: { kind: "num/literal", children: [], out: 2 },
    c: { kind: "num/add", children: ["a", "b"], out: undefined },
    d: { kind: "geom/point", children: [], out: { x: "c", y: "a" } },
  };
  const structInterp = {
    ...interp,
    "geom/point": async function* (entry: { out: unknown }) {
      const out = entry.out as Record<string, string>;
      const x = (yield out.x) as number;
      const y = (yield out.y) as number;
      return { x, y };
    },
  };
  await expect(koan.fold<{ x: number; y: number }>("d", structAdj, structInterp)).resolves.toEqual({
    x: 3,
    y: 1,
  });
});
