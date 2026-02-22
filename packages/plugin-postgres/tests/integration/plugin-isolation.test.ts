import { createApp, composeDollar, numPlugin, strPlugin } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { postgres } from "../../src/3.4.8";

describe("plugin isolation", () => {
  it("postgres plugin works with minimal plugins (num + str)", () => {
    const plugin = postgres("postgres://localhost/test");
    const plugins = [numPlugin, strPlugin, plugin] as const;
    const $ = composeDollar(...plugins);
    const app = createApp(...plugins);

    const result = $.sql`select 1`;
    expect(result.__kind).toBe("postgres/query");
    expect(() => app(result)).not.toThrow();
  });

  it("postgres plugin requires num + str for elaboration (string parts need str/literal)", () => {
    const plugin = postgres("postgres://localhost/test");
    const plugins = [numPlugin, plugin] as const;
    const $ = composeDollar(...plugins);
    const app = createApp(...plugins);

    const result = $.sql`select 1`;
    expect(result.__kind).toBe("postgres/query");
    // Without strPlugin, string parts can't be lifted
    expect(() => app(result)).toThrow(/Cannot lift/);
  });
});
