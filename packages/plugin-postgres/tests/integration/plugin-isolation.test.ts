import { createApp, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { postgres } from "../../src/3.4.8";

describe("plugin isolation", () => {
  it("postgres plugin works with minimal plugins (num + str)", () => {
    const plugin = postgres("postgres://localhost/test");
    const plugins = [numPluginU, strPluginU, plugin] as const;
    const $ = mvfmU(...plugins);
    const app = createApp(...plugins);

    const result = $.sql`select 1`;
    expect(result.__kind).toBe("postgres/query");
    expect(() => app(result)).not.toThrow();
  });

  it("postgres plugin requires num + str for elaboration (string parts need str/literal)", () => {
    const plugin = postgres("postgres://localhost/test");
    const plugins = [numPluginU, plugin] as const;
    const $ = mvfmU(...plugins);
    const app = createApp(...plugins);

    const result = $.sql`select 1`;
    expect(result.__kind).toBe("postgres/query");
    // Without strPluginU, string parts can't be lifted
    expect(() => app(result)).toThrow(/Cannot lift/);
  });
});
