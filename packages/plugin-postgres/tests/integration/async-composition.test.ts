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
import { postgresInterpreter } from "../../src/3.4.8/interpreter";

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

// All fragments are now generator-based.
const nonPgFragments = [
  errorInterpreter,
  fiberInterpreter,
  coreInterpreter,
  numInterpreter,
  ordInterpreter,
  eqInterpreter,
  strInterpreter,
];

const allFragments = [postgresInterpreter, ...nonPgFragments];

const app = mvfm(num, str, semiring, eq, ord, pgPlugin("postgres://test"), fiber, error);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const client = wrapPostgresJs(sql);
  const evaluate = serverEvaluate(client, allFragments);
  return await evaluate(ast.result);
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  sql = postgres(container.getConnectionUri());
  await sql`CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, price INT)`;
  await sql`INSERT INTO products (name, price) VALUES ('Widget', 100), ('Gadget', 200), ('Doohickey', 50)`;
  await sql`CREATE TABLE orders (id SERIAL PRIMARY KEY, product_id INT, quantity INT)`;
}, 60000);

afterAll(async () => {
  await sql.end();
  await container.stop();
});

describe("async composition: query chaining", () => {
  it("result of one query used as parameter to another", async () => {
    const prog = app(($) => {
      const product = $.sql`SELECT * FROM products WHERE name = ${"Widget"}`;
      return $.sql`SELECT * FROM products WHERE price > ${product[0].price} ORDER BY price`;
    });
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Gadget");
  });

  it("chained prop access on query result", async () => {
    const prog = app(($) => {
      const product = $.sql`SELECT * FROM products WHERE name = ${"Widget"}`;
      return product[0].name;
    });
    const result = await run(prog);
    expect(result).toBe("Widget");
  });
});

describe("async composition: core/do with mixed async steps", () => {
  it("$.do sequences async operations", async () => {
    const prog = app(($) => {
      return $.do(
        $.sql`INSERT INTO orders (product_id, quantity) VALUES (1, 5)`,
        $.sql`INSERT INTO orders (product_id, quantity) VALUES (2, 3)`,
        $.sql`SELECT count(*)::int as c FROM orders`,
      );
    });
    const result = (await run(prog)) as any[];
    expect(result[0].c).toBeGreaterThanOrEqual(2);
  });
});

describe("async composition: core/record with async fields", () => {
  it("record with async field values runs in parallel", async () => {
    const prog = app(($) => ({
      products: $.sql`SELECT count(*)::int as c FROM products`,
      orders: $.sql`SELECT count(*)::int as c FROM orders`,
    }));
    const result = (await run(prog)) as any;
    expect(result.products[0].c).toBe(3);
    expect(result.orders[0].c).toBeGreaterThanOrEqual(0);
  });
});

describe("async composition: core/tuple with async elements", () => {
  it("tuple with async elements runs in parallel via Promise.all", async () => {
    const prog = app(($) =>
      $.par(
        $.sql`SELECT count(*)::int as c FROM products`,
        $.sql`SELECT count(*)::int as c FROM orders`,
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0][0].c).toBe(3);
  });
});

describe("async composition: core/cond with async predicate", () => {
  it("conditional with async predicate evaluates correct branch", async () => {
    const prog = app(($) => {
      const count = $.sql`SELECT count(*)::int as c FROM products`;
      return $.cond($.gt(count[0].c, 0)).t("has products").f("empty");
    });
    const result = await run(prog);
    expect(result).toBe("has products");
  });
});
