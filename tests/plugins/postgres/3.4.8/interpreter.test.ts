import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { eq } from "../../../../src/plugins/eq";
import { eqInterpreter } from "../../../../src/plugins/eq/interpreter";
import { error } from "../../../../src/plugins/error";
import { errorInterpreter } from "../../../../src/plugins/error/interpreter";
import { fiber } from "../../../../src/plugins/fiber";
import { fiberInterpreter } from "../../../../src/plugins/fiber/interpreter";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { ord } from "../../../../src/plugins/ord";
import { ordInterpreter } from "../../../../src/plugins/ord/interpreter";
import { postgres as pgPlugin } from "../../../../src/plugins/postgres/3.4.8";
import { wrapPostgresJs } from "../../../../src/plugins/postgres/3.4.8/client-postgres-js";
import { postgresInterpreter } from "../../../../src/plugins/postgres/3.4.8/interpreter";
import { semiring } from "../../../../src/plugins/semiring";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

let container: StartedPostgreSqlContainer;
let sql: ReturnType<typeof postgres>;

const nonPgFragments = [
  errorInterpreter,
  fiberInterpreter,
  coreInterpreter,
  numInterpreter,
  ordInterpreter,
  eqInterpreter,
  strInterpreter,
];

function makeInterp() {
  const client = wrapPostgresJs(sql);
  return composeInterpreters([postgresInterpreter(client, nonPgFragments), ...nonPgFragments]);
}

// The connection string here is only used during AST construction (not at runtime).
// At runtime, the real connection comes from testcontainers via wrapPostgresJs.
const app = ilo(num, str, semiring, eq, ord, pgPlugin("postgres://test"), fiber, error);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = makeInterp();
  return await interp(ast.result);
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  sql = postgres(container.getConnectionUri());

  // Create test tables
  await sql`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, age INT)`;
  await sql`INSERT INTO users (name, age) VALUES ('Murray', 68), ('Walter', 80), ('Alice', 25)`;
  await sql`CREATE TABLE audit_log (id SERIAL PRIMARY KEY, action TEXT, user_id INT)`;
}, 60000);

afterAll(async () => {
  await sql.end();
  await container.stop();
});

// ============================================================
// Basic queries
// ============================================================

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

// ============================================================
// Dynamic identifiers
// ============================================================

describe("postgres interpreter: identifiers", () => {
  it("dynamic column selection", async () => {
    const prog = app(($) => $.sql`SELECT ${$.sql.id("name")} FROM users WHERE id = ${1}`);
    const result = (await run(prog)) as any[];
    expect(result[0]).toHaveProperty("name");
    expect(Object.keys(result[0])).toHaveLength(1);
  });
});

// ============================================================
// Insert helper
// ============================================================

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

    // Clean up
    await sql`DELETE FROM users WHERE name = 'Test'`;
  });
});

// ============================================================
// Set helper
// ============================================================

describe("postgres interpreter: set helper", () => {
  it("updates with set clause", async () => {
    // Get an ID we can safely update
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

    // Restore original
    await sql`UPDATE users SET name = 'Murray' WHERE id = ${id}`;
  });
});

// ============================================================
// Transactions (pipeline mode)
// ============================================================

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

// ============================================================
// Savepoints
// ============================================================

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

// ============================================================
// Composition: error + postgres
// ============================================================

describe("composition: error + postgres", () => {
  it("$.try catches a real constraint violation", async () => {
    // Create a unique index for testing
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

// ============================================================
// Composition: fiber + postgres
// ============================================================

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

// ============================================================
// Composition: error + fiber + postgres (nested)
// ============================================================

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
