import {
  coreInterpreter,
  eq,
  eqInterpreter,
  error,
  errorInterpreter,
  fiber,
  fiberInterpreter,
  mvfm,
  num,
  numInterpreter,
  ord,
  ordInterpreter,
  semiring,
  str,
  strInterpreter,
} from "@mvfm/core";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postgres as pgPlugin } from "../../src/3.4.8";
import { wrapPostgresJs } from "../../src/3.4.8/client-postgres-js";
import { serverEvaluate } from "../../src/3.4.8/handler.server";
import type { PostgresClient } from "../../src/3.4.8/interpreter";
import { createPostgresInterpreter } from "../../src/3.4.8/interpreter";

function injectInput(node: any, input: Record<string, unknown>, seen = new Map<any, any>()): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (seen.has(node)) return seen.get(node);
  if (Array.isArray(node)) {
    const arr: any[] = [];
    seen.set(node, arr);
    for (const n of node) arr.push(injectInput(n, input, seen));
    return arr;
  }
  const result: any = {};
  seen.set(node, result);
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input, seen);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

let container: StartedPostgreSqlContainer;
let sql: ReturnType<typeof postgres>;

function makeCountingClient(): { client: PostgresClient; getQueryCount: () => number } {
  const inner = wrapPostgresJs(sql);
  let queryCount = 0;
  const client: PostgresClient = {
    async query(sqlStr: string, params: unknown[]) {
      queryCount++;
      return inner.query(sqlStr, params);
    },
    async begin(fn) {
      return inner.begin(fn);
    },
    async savepoint(fn) {
      return inner.savepoint(fn);
    },
    async cursor(sqlStr, params, batchSize, fn) {
      queryCount++; // count the cursor query itself
      return inner.cursor(sqlStr, params, batchSize, fn);
    },
  };
  return { client, getQueryCount: () => queryCount };
}

const app = mvfm(num, str, semiring, eq, ord, pgPlugin("postgres://test"), fiber, error);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const { client, getQueryCount } = makeCountingClient();
  const baseInterpreter = {
    ...createPostgresInterpreter(client),
    ...errorInterpreter,
    ...fiberInterpreter,
    ...coreInterpreter,
    ...numInterpreter,
    ...ordInterpreter,
    ...eqInterpreter,
    ...strInterpreter,
  };
  const evaluate = serverEvaluate(client, baseInterpreter);
  const result = await evaluate(ast.result);
  return { result, queryCount: getQueryCount() };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  sql = postgres(container.getConnectionUri());
  await sql`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)`;
  await sql`INSERT INTO settings (key, value) VALUES ('tax_rate', '0.08')`;
  await sql`CREATE TABLE big_table (id SERIAL PRIMARY KEY, data TEXT)`;
  for (let i = 0; i < 10; i++) {
    await sql`INSERT INTO big_table (data) VALUES (${`row-${i}`})`;
  }
  await sql`CREATE TABLE processed (id SERIAL PRIMARY KEY, data TEXT, tax_rate TEXT)`;
}, 60000);

afterAll(async () => {
  await sql.end();
  await container.stop();
});

describe("DAG memoization integration: shared query deduplication", () => {
  it("shared query used by two consumers executes once", async () => {
    const prog = app(($) => {
      const settings = $.sql`SELECT value FROM settings WHERE key = 'tax_rate'`;
      const a = $.sql`SELECT ${settings[0].value} as rate`;
      const b = $.sql`SELECT ${settings[0].value} as rate2`;
      return $.begin(a, b);
    });
    const { queryCount } = await run(prog);
    // 1 (settings) + 1 (a) + 1 (b) = 3 (not 4)
    expect(queryCount).toBe(3);
  });
});

describe("DAG memoization integration: cursor with shared external query", () => {
  it("external query is cached across cursor iterations", async () => {
    const prog = app(($) => {
      const settings = $.sql`SELECT value FROM settings WHERE key = 'tax_rate'`;
      return $.sql.cursor($.sql`SELECT * FROM big_table`, 5, (batch) => {
        return $.sql`INSERT INTO processed (data, tax_rate)
            SELECT unnest(ARRAY[${batch[0].data}]), ${settings[0].value}`;
      });
    });
    const { queryCount } = await run(prog);
    // 1 (cursor SELECT) + 1 (settings SELECT, cached) + 2 (INSERT per batch) = 4
    expect(queryCount).toBe(4);
  });
});

describe("DAG memoization: adversarial integration tests", () => {
  it("cursor inside retry: retry re-runs cursor with fresh cache", async () => {
    const prog = app(($) => {
      const settings = $.sql`SELECT value FROM settings WHERE key = 'tax_rate'`;
      return $.retry(
        $.sql.cursor(
          $.sql`SELECT * FROM big_table ORDER BY id LIMIT 4`,
          2,
          (batch) =>
            $.sql`INSERT INTO processed (data, tax_rate)
              SELECT unnest(ARRAY[${batch[0].data}]), ${settings[0].value}`,
        ),
        { attempts: 2, delay: 0 },
      );
    });
    const { queryCount } = await run(prog);
    // Attempt 1 succeeds: 1 cursor + 1 settings + 2 inserts = 4
    expect(queryCount).toBe(4);
  });

  it("same query used inside and outside cursor", async () => {
    const prog = app(($) => {
      const settings = $.sql`SELECT value FROM settings WHERE key = 'tax_rate'`;
      const rateCheck = $.sql`SELECT ${settings[0].value} as rate`;
      const cursorResult = $.sql.cursor(
        $.sql`SELECT * FROM big_table ORDER BY id LIMIT 4`,
        2,
        (batch) =>
          $.sql`INSERT INTO processed (data, tax_rate)
            SELECT unnest(ARRAY[${batch[0].data}]), ${settings[0].value}`,
      );
      return $.begin(rateCheck, cursorResult, settings);
    });
    const { queryCount } = await run(prog);
    // 1 (settings for rateCheck) + 1 (rateCheck) + 1 (cursor) + 1 (settings re-eval in cursor) + 2 (inserts) = 6
    expect(queryCount).toBe(6);
  });
});
