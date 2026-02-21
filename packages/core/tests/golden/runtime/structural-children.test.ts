import { describe, expect, it } from "vitest";

import { defaults, foldAST, mvfm, num, semiring } from "../../../src/index";

describe("golden runtime: structural node flow", () => {
  it("evaluates record and tuple children through core interpreter", async () => {
    const app = mvfm(num, semiring);
    const prog = app(($) => ({
      left: $.add(1, 2),
      right: $.mul(3, 4),
      tuple: [5, $.add(6, 7)],
    }));

    const result = await foldAST(defaults(app), prog);
    expect(result).toEqual({ left: 3, right: 12, tuple: [5, 13] });
  });
});
