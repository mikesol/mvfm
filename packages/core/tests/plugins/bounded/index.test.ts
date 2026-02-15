import { describe, expect, it } from "vitest";
import { boolean } from "../../../src/plugins/boolean";
import { num } from "../../../src/plugins/num";

describe("bounded: trait declarations", () => {
  it("num declares bounded trait", () => {
    expect(num.traits?.bounded).toEqual({
      type: "number",
      nodeKinds: { top: "num/top", bottom: "num/bottom" },
    });
  });

  it("boolean declares bounded trait", () => {
    expect(boolean.traits?.bounded).toEqual({
      type: "boolean",
      nodeKinds: { top: "boolean/top", bottom: "boolean/bottom" },
    });
  });
});
