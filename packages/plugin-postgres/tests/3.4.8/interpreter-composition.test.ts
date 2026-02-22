import { describe, expect, it } from "vitest";
import { $, app, run, setupPostgresTestEnv } from "./interpreter.shared";

setupPostgresTestEnv();

describe("composition: basic query chaining", () => {
  it("result of one query used as parameter to another", async () => {
    const expr = (() => {
      const user = $.sql`SELECT * FROM users WHERE name = ${"Murray"}`;
      return $.sql`SELECT * FROM users WHERE age > ${user[0].age} ORDER BY age`;
    })();
    const result = (await run(app(expr))) as Record<string, unknown>[];
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Walter");
  });

  it("chained prop access on query result", async () => {
    const expr = (() => {
      const user = $.sql`SELECT * FROM users WHERE name = ${"Murray"}`;
      return user[0].name;
    })();
    const result = await run(app(expr));
    expect(result).toBe("Murray");
  });
});
