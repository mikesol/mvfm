import { describe, expect, it } from "vitest";

import { createFoldState, defaults, foldAST } from "../../../src/index";
import { buildMathApp } from "../shared/case-builders";

describe("golden runtime: determinism and memo behavior", () => {
  it("reuses memoized values with persistent fold state", async () => {
    const app = buildMathApp();
    const state = createFoldState();
    const prog = app(($) => $.mul($.add(2, 3), 4));

    const first = await foldAST(defaults(app), prog, state);
    const second = await foldAST(defaults(app), prog, state);

    expect(first).toBe(20);
    expect(second).toBe(20);
  });
});
