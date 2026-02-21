import { describe, expect, it } from "vitest";

import { defaults, fold } from "../../../src/index";
import { buildMathApp } from "../shared/case-builders";
import { runWithDefaults } from "../shared/case-runner";

describe("golden runtime: full flow", () => {
  it("evaluates composed arithmetic end-to-end", async () => {
    const app = buildMathApp();
    const prog = app(($) => $.mul($.add(3, 4), 5));

    const result = await runWithDefaults(app, prog);
    expect(result).toBe(35);
  });

  it("keeps shared subgraphs deterministic", async () => {
    const app = buildMathApp();
    const prog = app(($) => {
      const shared = $.add(1, 2);
      return $.mul(shared, shared);
    });

    const result = await runWithDefaults(app, prog);
    expect(result).toBe(9);
  });

  it("supports fold(program, interpreter) overload", async () => {
    const app = buildMathApp();
    const prog = app(($) => $.mul($.add(10, 2), 2));

    const result = await fold(prog, defaults(app));
    expect(result).toBe(24);
  });
});
