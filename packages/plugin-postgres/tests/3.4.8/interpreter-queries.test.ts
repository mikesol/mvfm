import { describe, expect, it } from "vitest";
import { $, app, run, setupPostgresTestEnv, sql } from "./interpreter.shared";

setupPostgresTestEnv();

describe("postgres interpreter: basic queries", () => {
  it("select all rows", async () => {
    const result = (await run(app($.sql`SELECT * FROM users ORDER BY id`))) as unknown[];
    expect(result).toHaveLength(3);
    expect((result[0] as Record<string, unknown>).name).toBe("Murray");
    expect((result[1] as Record<string, unknown>).name).toBe("Walter");
    expect((result[2] as Record<string, unknown>).name).toBe("Alice");
  });

  it("parameterized query", async () => {
    const result = (await run(
      app($.sql`SELECT * FROM users WHERE age > ${50} ORDER BY age`),
    )) as unknown[];
    expect(result).toHaveLength(2);
    expect((result[0] as Record<string, unknown>).name).toBe("Murray");
    expect((result[1] as Record<string, unknown>).name).toBe("Walter");
  });

  it("query returning empty result set", async () => {
    const result = (await run(app($.sql`SELECT * FROM users WHERE age > ${200}`))) as unknown[];
    expect(result).toHaveLength(0);
  });
});

describe("postgres interpreter: identifiers", () => {
  it("dynamic column selection", async () => {
    const result = (await run(
      app($.sql`SELECT ${$.sql.id("name")} FROM users WHERE id = ${1}`),
    )) as Record<string, unknown>[];
    expect(result[0]).toHaveProperty("name");
    expect(Object.keys(result[0])).toHaveLength(1);
  });
});

describe("postgres interpreter: insert helper", () => {
  it("inserts with column list", async () => {
    const data = { name: "Test", age: 99 };
    // We need to lift the plain object. Use a literal approach:
    // Create a query that uses the insert helper with literal data
    const expr = $.sql`INSERT INTO users ${$.sql.insert(data, ["name", "age"])} RETURNING *`;
    const result = (await run(app(expr))) as Record<string, unknown>[];
    expect(result[0].name).toBe("Test");
    expect(result[0].age).toBe(99);

    await sql`DELETE FROM users WHERE name = 'Test'`;
  });
});

describe("postgres interpreter: set helper", () => {
  it("updates with set clause", async () => {
    const rows = await sql`SELECT id FROM users WHERE name = 'Murray'`;
    const id = rows[0].id as number;

    // For set helper, we need to pass the data as a literal
    const data = { name: "Murray Updated" };
    const expr = $.sql`UPDATE users SET ${$.sql.set(data, ["name"])} WHERE id = ${id} RETURNING *`;
    const result = (await run(app(expr))) as Record<string, unknown>[];
    expect(result[0].name).toBe("Murray Updated");

    await sql`UPDATE users SET name = 'Murray' WHERE id = ${id}`;
  });
});

describe("postgres interpreter: transactions", () => {
  it("pipeline mode commits multiple queries", async () => {
    await run(
      app(
        $.sql.begin((sql) => [
          sql`INSERT INTO audit_log (action) VALUES ('tx_test_1')`,
          sql`INSERT INTO audit_log (action) VALUES ('tx_test_2')`,
        ]),
      ),
    );
    const rows = await sql`SELECT * FROM audit_log WHERE action LIKE 'tx_test%' ORDER BY id`;
    expect(rows).toHaveLength(2);
    expect(rows[0].action).toBe("tx_test_1");
    expect(rows[1].action).toBe("tx_test_2");
  });

  it("callback mode with single body expression", async () => {
    const result = (await run(
      app(
        $.sql.begin((sql) => {
          return sql`INSERT INTO audit_log (action) VALUES ('callback_test') RETURNING *`;
        }),
      ),
    )) as Record<string, unknown>[];
    expect(result[0].action).toBe("callback_test");
  });
});

describe("postgres interpreter: savepoints", () => {
  it("savepoint within transaction commits", async () => {
    await run(
      app(
        $.sql.begin((sql) => {
          return (sql as unknown as { savepoint: Function }).savepoint((sql2: typeof sql) => [
            sql2`INSERT INTO audit_log (action) VALUES ('savepoint_test')`,
          ]);
        }),
      ),
    );
    const rows = await sql`SELECT * FROM audit_log WHERE action = 'savepoint_test'`;
    expect(rows).toHaveLength(1);
  });
});
