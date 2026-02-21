import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 04b-accessor: deep proxy property access produces core/access CExpr", () => {
  const deep = koan.deepThing();
  const access = deep.helloRecord.boy[3].am.i[0].mean;

  expect(koan.isCExpr(access)).toBe(true);
  expect(access.__kind).toBe("core/access");

  const prog = koan.appS(koan.add(access, 1));
  expect(prog.__adj[prog.__id]?.kind).toBe("num/add");
});
