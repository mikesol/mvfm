import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 03a-composition: derived maps + ord extensibility via core API", () => {
  const lift = koan.buildLiftMap(koan.stdPlugins);
  const traits = koan.buildTraitMap(koan.stdPlugins);
  const kindInputs = koan.buildKindInputs(koan.stdPlugins);

  expect(lift.number).toBe("num/literal");
  expect(lift.string).toBe("str/literal");
  expect(lift.boolean).toBe("bool/literal");

  expect(traits.eq.number).toBe("num/eq");
  expect(traits.eq.string).toBe("str/eq");
  expect(traits.eq.boolean).toBe("bool/eq");

  expect(kindInputs["num/add"]).toEqual(["number", "number"]);
  expect(kindInputs["str/eq"]).toEqual(["string", "string"]);

  const $ = koan.mvfmU(...koan.stdPlugins, koan.ordPlugin);
  expect($.lt(3, 4).__kind).toBe("lt");
  expect($.eq(3, 4).__kind).toBe("eq");
});
