import * as http from "node:http";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { InterpreterFragment, StepContext } from "../../../../src/core";
import { mvfm, runAST } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { eq } from "../../../../src/plugins/eq";
import { eqInterpreter } from "../../../../src/plugins/eq/interpreter";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { ord } from "../../../../src/plugins/ord";
import { ordInterpreter } from "../../../../src/plugins/ord/interpreter";
import { postgres as pgPlugin } from "../../../../src/plugins/postgres/3.4.8";
import { wrapPostgresJs } from "../../../../src/plugins/postgres/3.4.8/client-postgres-js";
import { clientHandler } from "../../../../src/plugins/postgres/3.4.8/handler.client";
import {
  serverEvaluate,
  serverHandler,
} from "../../../../src/plugins/postgres/3.4.8/handler.server";
import { postgresInterpreter } from "../../../../src/plugins/postgres/3.4.8/interpreter";
import { semiring } from "../../../../src/plugins/semiring";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";

let container: StartedPostgreSqlContainer;
let sql: ReturnType<typeof postgres>;
let httpServer: http.Server;
let serverPort: number;

// All non-postgres fragments are now generator-based
const nonPgFragments = [
  coreInterpreter,
  numInterpreter,
  strInterpreter,
  eqInterpreter,
  ordInterpreter,
];

const allFragments = [postgresInterpreter, ...nonPgFragments];

// The connection string here is only used during AST construction (not at runtime).
const app = mvfm(num, str, semiring, eq, ord, pgPlugin("postgres://test"));

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

beforeAll(async () => {
  // Start Postgres
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  sql = postgres(container.getConnectionUri());
  await sql`CREATE TABLE items (id SERIAL PRIMARY KEY, name TEXT NOT NULL, price INT)`;
  await sql`INSERT INTO items (name, price) VALUES ('Widget', 10), ('Gadget', 25), ('Doohickey', 5)`;

  // Start HTTP server that wraps serverHandler
  httpServer = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/mvfm/execute") {
      res.writeHead(404);
      res.end();
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString());

    const client = wrapPostgresJs(sql);
    const handler = serverHandler(client, allFragments as InterpreterFragment[]);

    try {
      const ctx: StepContext = { depth: 0, path: body.path ?? [] };
      const result = await handler(body.effect, ctx, undefined);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ result: result.value }));
    } catch (e: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      serverPort = (httpServer.address() as any).port;
      resolve();
    });
  });
}, 60000);

afterAll(async () => {
  httpServer?.close();
  await sql?.end();
  await container?.stop();
});

describe("round-trip: direct vs proxied", () => {
  it("SELECT produces identical results", async () => {
    const prog = app(($) => $.sql`SELECT * FROM items ORDER BY id`);

    // Direct: serverEvaluate against real DB
    const client = wrapPostgresJs(sql);
    const evaluate = serverEvaluate(client, allFragments as InterpreterFragment[]);
    const direct = await evaluate(prog.ast.result);

    // Proxied: clientHandler -> HTTP -> serverHandler -> real DB
    const proxyHandler = clientHandler({
      baseUrl: `http://localhost:${serverPort}`,
      contractHash: prog.hash,
      fetch: globalThis.fetch,
    });
    const proxied = await runAST(
      prog.ast.result,
      allFragments as InterpreterFragment[],
      proxyHandler,
      { stepIndex: 0 },
    );

    expect(proxied.value).toEqual(direct);
  });

  it("parameterized query with input injection produces identical results", async () => {
    const prog = app(
      { minPrice: "number" },
      ($) => $.sql`SELECT * FROM items WHERE price > ${$.input.minPrice} ORDER BY price`,
    );

    // Direct path
    const directAst = injectInput(prog.ast, { minPrice: 8 });
    const client = wrapPostgresJs(sql);
    const evaluate = serverEvaluate(client, allFragments as InterpreterFragment[]);
    const direct = await evaluate(directAst.result);

    // Proxied path (fresh AST copy to avoid shared mutation)
    const proxiedAst = injectInput(prog.ast, { minPrice: 8 });
    const proxyHandler = clientHandler({
      baseUrl: `http://localhost:${serverPort}`,
      contractHash: prog.hash,
      fetch: globalThis.fetch,
    });
    const proxied = await runAST(
      proxiedAst.result,
      allFragments as InterpreterFragment[],
      proxyHandler,
      { stepIndex: 0 },
    );

    expect(proxied.value).toEqual(direct);
  });
});
