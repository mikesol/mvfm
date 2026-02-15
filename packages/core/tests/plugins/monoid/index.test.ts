import { describe, expect, it } from "vitest";
import { str } from "../../../src/plugins/str";

describe("monoid: trait declarations", () => {
  it("str declares monoid trait", () => {
    expect(str.traits?.monoid).toEqual({
      type: "string",
      nodeKinds: { mempty: "str/mempty" },
    });
  });
});
