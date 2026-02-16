import { describe, expect, it } from "vitest";
import { app, run, setupPostgresTestEnv, sql } from "./interpreter.shared";

setupPostgresTestEnv();

describe("postgres interpreter: basic queries", () => {
  it("select all rows", async () => {
    const prog = app(($) => $.sql`SELECT * FROM users ORDER BY id`);
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Murray");
    expect(result[1].name).toBe("Walter");
    expect(result[2].name).toBe("Alice");
  });

  it("parameterized query", async () => {
    const prog = app(($) => $.sql`SELECT * FROM users WHERE age > ${50} ORDER BY age`);
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Murray");
    expect(result[1].name).toBe("Walter");
  });

  it("query with input parameters", async () => {
    const prog = app(
      { minAge: "number" },
      ($) => $.sql`SELECT * FROM users WHERE age > ${$.input.minAge} ORDER BY age`,
    );
    const result = (await run(prog, { minAge: 30 })) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Murray");
    expect(result[1].name).toBe("Walter");
  });

  it("query returning empty result set", async () => {
    const prog = app(($) => $.sql`SELECT * FROM users WHERE age > ${200}`);
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(0);
  });
});

describe("postgres interpreter: identifiers", () => {
  it("dynamic column selection", async () => {
    const prog = app(($) => $.sql`SELECT ${$.sql.id("name")} FROM users WHERE id = ${1}`);
    const result = (await run(prog)) as any[];
    expect(result[0]).toHaveProperty("name");
    expect(Object.keys(result[0])).toHaveLength(1);
  });
});

describe("postgres interpreter: insert helper", () => {
  it("inserts with column list", async () => {
    const prog = app(
      { name: "string", age: "number" },
      ($) => $.sql`INSERT INTO users ${$.sql.insert($.input, ["name", "age"])} RETURNING *`,
    );
    const result = (await run(prog, {
      name: "Test",
      age: 99,
    })) as any[];
    expect(result[0].name).toBe("Test");
    expect(result[0].age).toBe(99);

    await sql`DELETE FROM users WHERE name = 'Test'`;
  });
});

describe("postgres interpreter: set helper", () => {
  it("updates with set clause", async () => {
    const rows = await sql`SELECT id FROM users WHERE name = 'Murray'`;
    const id = rows[0].id;

    const prog = app(
      { id: "number", data: "object" },
      ($) =>
        $.sql`UPDATE users SET ${$.sql.set($.input.data, ["name"])} WHERE id = ${$.input.id} RETURNING *`,
    );
    const result = (await run(prog, {
      id,
      data: { name: "Murray Updated" },
    })) as any[];
    expect(result[0].name).toBe("Murray Updated");

    await sql`UPDATE users SET name = 'Murray' WHERE id = ${id}`;
  });
});

describe("postgres interpreter: transactions", () => {
  it("pipeline mode commits multiple queries", async () => {
    const prog = app(($) =>
      $.sql.begin((sql) => [
        sql`INSERT INTO audit_log (action) VALUES ('tx_test_1')`,
        sql`INSERT INTO audit_log (action) VALUES ('tx_test_2')`,
      ]),
    );
    await run(prog);
    const rows = await sql`SELECT * FROM audit_log WHERE action LIKE 'tx_test%' ORDER BY id`;
    expect(rows).toHaveLength(2);
    expect(rows[0].action).toBe("tx_test_1");
    expect(rows[1].action).toBe("tx_test_2");
  });

  it("callback mode with single body expression", async () => {
    const prog = app(($) =>
      $.sql.begin((sql) => {
        return sql`INSERT INTO audit_log (action) VALUES ('callback_test') RETURNING *`;
      }),
    );
    const result = (await run(prog)) as any[];
    expect(result[0].action).toBe("callback_test");
  });
});

describe("postgres interpreter: savepoints", () => {
  it("savepoint within transaction commits", async () => {
    const prog = app(($) =>
      $.sql.begin((sql) => {
        return (sql as any).savepoint((sql2: any) => [
          sql2`INSERT INTO audit_log (action) VALUES ('savepoint_test')`,
        ]);
      }),
    );
    await run(prog);
    const rows = await sql`SELECT * FROM audit_log WHERE action = 'savepoint_test'`;
    expect(rows).toHaveLength(1);
  });
});
