import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postgres } from "../../src/3.4.8";
import { wrapPostgresJs } from "../../src/3.4.8/client-postgres-js";
import { createPostgresServerInterpreter } from "../../src/3.4.8/handler.server";

let container: StartedPostgreSqlContainer;
let sqlClient: ReturnType<typeof pg>;

const plugin = postgres("postgres://test");
const plugins = [numPluginU, strPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

const coreAccessInterpreter: Interpreter = {
  "core/access": async function* (e: RuntimeEntry) {
    const parent = yield 0;
    const key = e.out as string | number;
    return (parent as Record<string | number, unknown>)[key];
  },
};

async function run(nexpr: ReturnType<typeof app>): Promise<unknown> {
  const client = wrapPostgresJs(sqlClient);
  const adj = nexpr.__adj;
  const baseInterp = { ...defaults([numPluginU, strPluginU]), ...coreAccessInterpreter };
  const pgInterp = createPostgresServerInterpreter(client, adj, baseInterp);
  const fullInterp = { ...baseInterp, ...pgInterp };
  return await fold(nexpr, fullInterp);
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  sqlClient = pg(container.getConnectionUri());
  await sqlClient`CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, price INT)`;
  await sqlClient`INSERT INTO products (name, price) VALUES ('Widget', 100), ('Gadget', 200), ('Doohickey', 50)`;
  await sqlClient`CREATE TABLE orders (id SERIAL PRIMARY KEY, product_id INT, quantity INT)`;
}, 60000);

afterAll(async () => {
  await sqlClient.end();
  await container.stop();
});

describe("async composition: query chaining", () => {
  it("result of one query used as parameter to another", async () => {
    const expr = (() => {
      const product = $.sql`SELECT * FROM products WHERE name = ${"Widget"}`;
      return $.sql`SELECT * FROM products WHERE price > ${product[0].price} ORDER BY price`;
    })();
    const result = (await run(app(expr))) as Record<string, unknown>[];
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Gadget");
  });

  it("chained prop access on query result", async () => {
    const expr = (() => {
      const product = $.sql`SELECT * FROM products WHERE name = ${"Widget"}`;
      return product[0].name;
    })();
    const result = await run(app(expr));
    expect(result).toBe("Widget");
  });
});
