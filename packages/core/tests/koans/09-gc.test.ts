import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 09-gc: liveAdj keeps structurally reachable refs stored in out", () => {
  const prog = koan.appS(koan.point({ x: koan.add(1, 2), y: 9 }));
  const withOrphan = {
    ...prog.__adj,
    orphan: { kind: "num/literal", children: [], out: 99 },
  };

  const live = koan.liveAdj(withOrphan, prog.__id);

  expect("orphan" in live).toBe(false);
  expect(Object.values(live).some((entry) => entry.kind === "geom/point")).toBe(true);
  expect(Object.values(live).some((entry) => entry.kind === "num/add")).toBe(true);
});
