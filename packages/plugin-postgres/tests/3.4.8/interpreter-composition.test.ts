import { describe, expect, it } from "vitest";
import { app, run, setupPostgresTestEnv, sql } from "./interpreter.shared";

setupPostgresTestEnv();

describe("composition: error + postgres", () => {
  it("$.try catches a real constraint violation", async () => {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_name_unique ON users (name)`;

    const prog = app(($) =>
      $.try($.sql`INSERT INTO users (name, age) VALUES ('Alice', 99) RETURNING *`).catch(
        (_err) => ({ caught: true }),
      ),
    );
    const result = (await run(prog)) as any;
    expect(result.caught).toBe(true);
  });

  it("$.attempt wraps query success", async () => {
    const prog = app(($) => $.attempt($.sql`SELECT * FROM users LIMIT 1`));
    const result = (await run(prog)) as any;
    expect(result.ok).not.toBeNull();
    expect(result.err).toBeNull();
  });

  it("$.attempt wraps query failure", async () => {
    const prog = app(($) => $.attempt($.sql`SELECT * FROM nonexistent_table`));
    const result = (await run(prog)) as any;
    expect(result.ok).toBeNull();
    expect(result.err).not.toBeNull();
  });

  it("$.orElse provides fallback on query error", async () => {
    const prog = app(($) => $.orElse($.sql`SELECT * FROM nonexistent_table`, []));
    const result = (await run(prog)) as any[];
    expect(result).toEqual([]);
  });
});

describe("composition: fiber + postgres", () => {
  it("$.par runs queries in parallel", async () => {
    const prog = app(($) =>
      $.par(
        $.sql`SELECT count(*)::int as c FROM users`,
        $.sql`SELECT count(*)::int as c FROM audit_log`,
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0][0].c).toBeGreaterThan(0);
  });

  it("$.retry retries a succeeding query", async () => {
    const prog = app(($) => $.retry($.sql`SELECT 1 as ok`, { attempts: 3, delay: 0 }));
    const result = (await run(prog)) as any[];
    expect(result[0].ok).toBe(1);
  });

  it("$.seq sequences queries", async () => {
    const prog = app(($) =>
      $.seq(
        $.sql`INSERT INTO audit_log (action) VALUES ('seq_1')`,
        $.sql`INSERT INTO audit_log (action) VALUES ('seq_2')`,
        $.sql`SELECT * FROM audit_log WHERE action LIKE 'seq_%' ORDER BY id`,
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

describe("composition: error + fiber + postgres (nested)", () => {
  it("$.try wrapping $.par with one failing branch", async () => {
    const prog = app(($) =>
      $.try($.par($.sql`SELECT 1 as ok`, $.sql`SELECT * FROM nonexistent_table`)).catch(
        (_err) => "caught",
      ),
    );
    const result = await run(prog);
    expect(result).toBe("caught");
  });

  it("$.settle with multiple queries", async () => {
    const prog = app(($) =>
      $.settle(
        $.sql`SELECT 1 as ok`,
        $.sql`SELECT * FROM nonexistent_table`,
        $.sql`SELECT 2 as ok`,
      ),
    );
    const result = (await run(prog)) as any;
    expect(result.fulfilled).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
  });
});
