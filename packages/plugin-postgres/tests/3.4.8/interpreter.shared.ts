import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "postgres";
import { afterAll, beforeAll } from "vitest";
import { postgres } from "../../src/3.4.8";
import { wrapPostgresJs } from "../../src/3.4.8/client-postgres-js";
import { createPostgresServerInterpreter } from "../../src/3.4.8/handler.server";

let container: StartedPostgreSqlContainer;
let sqlClient: ReturnType<typeof pg>;

const plugin = postgres("postgres://test");
const plugins = [numPluginU, strPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

/** Handler for core/access: property access on evaluated parent. */
const coreAccessInterpreter: Interpreter = {
  "core/access": async function* (e: RuntimeEntry) {
    const parent = yield 0;
    const key = e.out as string | number;
    return (parent as Record<string | number, unknown>)[key];
  },
};

function setupPostgresTestEnv(): void {
  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    sqlClient = pg(container.getConnectionUri());

    await sqlClient`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, age INT)`;
    await sqlClient`INSERT INTO users (name, age) VALUES ('Murray', 68), ('Walter', 80), ('Alice', 25)`;
    await sqlClient`CREATE TABLE audit_log (id SERIAL PRIMARY KEY, action TEXT, user_id INT)`;
  }, 60000);

  afterAll(async () => {
    await sqlClient.end();
    await container.stop();
  });
}

async function run(nexpr: ReturnType<typeof app>): Promise<unknown> {
  const client = wrapPostgresJs(sqlClient);
  const adj = nexpr.__adj;

  // Build base interpreter from standard plugins + core/access
  const baseInterp = { ...defaults([numPluginU, strPluginU]), ...coreAccessInterpreter };

  // Build postgres server interpreter with base (for transaction sub-folding)
  const pgInterp = createPostgresServerInterpreter(client, adj, baseInterp);

  // Merge into full interpreter
  const fullInterp = { ...baseInterp, ...pgInterp };
  return await fold(nexpr, fullInterp);
}

export { $, app, run, setupPostgresTestEnv, sqlClient as sql };
