import { describe, expect, it } from "vitest";

import { defaults, foldAST } from "../../../src/index";
import { buildMathApp } from "../shared/case-builders";

describe("golden runtime: stack safety", () => {
  it("evaluates deep additive chains without overflow", async () => {
    const app = buildMathApp();
    const prog = app(($) => {
      let node = 0;
      for (let i = 0; i < 2000; i += 1) {
        node = $.add(node, 1);
      }
      return node;
    });

    const result = await foldAST(defaults(app), prog);
    expect(result).toBe(2000);
  });
});
