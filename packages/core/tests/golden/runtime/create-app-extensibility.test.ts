import { describe, expect, it } from "vitest";

import { defaults, foldAST, mvfm, num, ord, semiring } from "../../../src/index";

describe("golden runtime: app composition extensibility", () => {
  it("supports additional plugins without affecting arithmetic flow", async () => {
    const app = mvfm(num, ord, semiring);
    const prog = app(($) => $.add(8, 13));

    const result = await foldAST(defaults(app), prog);
    expect(result).toBe(21);
  });
});
