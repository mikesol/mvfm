import type { Program } from "@mvfm/core";
import {
  coreInterpreter,
  eq,
  eqInterpreter,
  error,
  errorInterpreter,
  fiber,
  fiberInterpreter,
  injectInput,
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
import { afterAll, beforeAll } from "vitest";
import { postgres as pgPlugin } from "../../src/3.4.8";
import { wrapPostgresJs } from "../../src/3.4.8/client-postgres-js";
import { serverEvaluate } from "../../src/3.4.8/handler.server";
import { createPostgresInterpreter } from "../../src/3.4.8/interpreter";

let container: StartedPostgreSqlContainer;
let sql: ReturnType<typeof postgres>;

const app = mvfm(num, str, semiring, eq, ord, pgPlugin("postgres://test"), fiber, error);

export function setupPostgresTestEnv(): void {
  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    sql = postgres(container.getConnectionUri());

    await sql`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, age INT)`;
    await sql`INSERT INTO users (name, age) VALUES ('Murray', 68), ('Walter', 80), ('Alice', 25)`;
    await sql`CREATE TABLE audit_log (id SERIAL PRIMARY KEY, action TEXT, user_id INT)`;
  }, 60000);

  afterAll(async () => {
    await sql.end();
    await container.stop();
  });
}

export async function run(prog: Program, input: Record<string, unknown> = {}): Promise<unknown> {
  const injected = injectInput(prog, input);
  const client = wrapPostgresJs(sql);
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
  return await evaluate(injected.ast.result);
}

export { app, sql };
