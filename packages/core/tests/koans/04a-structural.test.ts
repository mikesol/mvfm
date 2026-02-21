import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 04a-structural: records/tuples containing CExpr are elaborated", () => {
  const prog = koan.appS(koan.point({ x: koan.add(1, 2), y: 3 }));

  const root = prog.__adj[prog.__id];
  expect(root.kind).toBe("geom/point");

  const childRef = root.children[0] as string;
  const recordNode = prog.__adj[childRef];
  expect(recordNode.kind).toBe("core/record");

  const fields = recordNode.out as Record<string, string>;
  expect(prog.__adj[fields.x]?.kind).toBe("num/add");
  expect(prog.__adj[fields.y]?.kind).toBe("num/literal");
});
