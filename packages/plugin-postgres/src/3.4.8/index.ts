// ============================================================
// MVFM PLUGIN: postgres (porsager/postgres compatible API)
// ============================================================
//
// Implementation status: COMPLETE (modulo known limitations)
// Plugin size: SMALL — fully implemented modulo known limitations
//
// Known limitations (deliberate omissions):
//   - No COPY (streaming bulk import/export)
//   - No LISTEN/NOTIFY (async pub/sub channels)
//   - No SUBSCRIBE (realtime logical replication)
//
// Goal: An LLM that knows postgres.js should be able to write
// Mvfm programs with near-zero learning curve. The API should
// look like the real postgres.js as closely as possible.
//
// Real postgres.js API:
//   const sql = postgres('postgres://...')
//   const users = await sql`select * from users where id = ${id}`
//   const [user] = await sql`select * from users where id = ${id}`
//   await sql`insert into users ${sql(user, 'name', 'age')}`
//   sql(identifier)           — dynamic identifier
//   sql(object, ...columns)   — dynamic insert/update
//   sql.begin(fn)             — transactions
//   sql.savepoint(fn)         — savepoints
//
// ============================================================

import type { Expr, PluginContext, TypedNode } from "@mvfm/core";
import { definePlugin } from "@mvfm/core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Database operations added to the DSL context by the postgres plugin.
 *
 * Mirrors the postgres.js (porsager/postgres) v3.4.x API as closely
 * as possible: tagged template queries, dynamic identifiers, insert/set
 * helpers, transactions, savepoints, and cursors.
 */
export interface PostgresMethods {
  /**
   * Tagged template query — the core of postgres.js.
   *
   * Real postgres.js:
   *   const users = await sql`select * from users where age > ${age}`
   *
   * Mvfm:
   *   const users = $.sql`select * from users where age > ${age}`
   *
   * Returns `Expr<Row[]>` — an array of result rows.
   */
  sql: PostgresSql;
}

interface PostgresSql {
  // Tagged template query
  <T = Record<string, any>>(
    strings: TemplateStringsArray,
    ...values: (Expr<any> | string | number | boolean | null)[]
  ): Expr<T[]>;

  /**
   * Dynamic identifier — column or table name escaping.
   *
   * Real: sql`select ${sql('name')} from ${sql('users')}`
   * Mvfm: $.sql`select ${$.sql.id('name')} from ${$.sql.id('users')}`
   *
   * NOTE: We can't do sql(string) because sql is already the
   * tagged template. In real postgres.js, sql is both callable
   * and a template tag. JS Proxy could intercept both, but it
   * creates ambiguity in our AST. So we use .id() instead.
   *
   * This is Deviation #1 from the real API.
   */
  id(name: Expr<string> | string): Expr<any>;

  /**
   * Dynamic insert/update helper.
   *
   * Real: sql`insert into users ${sql(user, 'name', 'age')}`
   * Mvfm: $.sql`insert into users ${$.sql.insert(user, ['name', 'age'])}`
   *
   * Deviation #2: We use .insert() instead of the overloaded
   * sql() call, since we need to distinguish "identifier" from
   * "insert helper" in the AST.
   */
  insert(
    data: Expr<Record<string, any>> | Expr<Record<string, any>[]>,
    columns?: string[],
  ): Expr<any>;

  /**
   * Dynamic update helper.
   *
   * Real: sql`update users set ${sql(user, 'name', 'age')} where id = ${id}`
   * Mvfm: $.sql`update users set ${$.sql.set(user, ['name', 'age'])} where id = ${id}`
   *
   * Deviation #3: Explicit .set() for updates vs .insert() for inserts.
   * In real postgres.js these are the same call — the database figures
   * it out from context. We can't do that because we're building an AST,
   * not sending to postgres. The interpreter needs to know the intent.
   */
  set(data: Expr<Record<string, any>>, columns?: string[]): Expr<any>;

  /**
   * Transaction block.
   *
   * Real:
   *   const [user, account] = await sql.begin(async sql => {
   *     const [user] = await sql`insert into users (name) values ('Murray') returning *`
   *     const [account] = await sql`insert into accounts (user_id) values (${user.user_id}) returning *`
   *     return [user, account]
   *   })
   *
   * Mvfm:
   *   const result = $.sql.begin(sql => {
   *     const user = sql`insert into users (name) values ('Murray') returning *`
   *     const account = sql`insert into accounts (user_id) values (${user[0].user_id}) returning *`
   *     return $.begin(user, account)   // <-- must use $.begin for sequencing!
   *   })
   *
   * ============================================================
   * HERE'S WHERE IT GETS HONEST.
   * ============================================================
   *
   * Problem 1: ASYNC
   * Real postgres.js: sql.begin takes an `async` callback.
   * Each query is `await`ed. The sequential ordering comes from
   * JS async/await semantics. The SECOND query depends on the
   * RESULT of the first (user.user_id).
   *
   * In Mvfm, there's no await. The callback runs synchronously
   * to build the AST. So when you write:
   *
   *   const user = sql`insert ... returning *`
   *
   * `user` isn't a real row — it's a proxy representing
   * "the result of this query." When you then write:
   *
   *   sql`insert into accounts (user_id) values (${user[0].user_id})`
   *
   * The proxy intercepts [0] and .user_id and builds
   * PropAccess nodes. The AST captures the dependency.
   * So this actually works! The proxy chain handles it.
   *
   * Problem 2: SEQUENTIAL SIDE EFFECTS
   * In the transaction, both inserts are side effects.
   * Neither is "just" a return value. In real postgres.js,
   * await enforces ordering. In Mvfm, the callback just
   * builds a tree, so you need $.begin() or return an array
   * to capture all the effects.
   *
   * This is where the pipelining syntax is nice:
   *   sql.begin(sql => [
   *     sql`update ...`,
   *     sql`update ...`,
   *   ])
   *
   * In Mvfm this could be:
   *   $.sql.begin(sql => [
   *     sql`update ...`,
   *     sql`update ...`,
   *   ])
   *
   * And we interpret the array as "execute these in order,
   * within a transaction." No $.begin() needed — the array IS
   * the sequencing primitive.
   *
   * Problem 3: ERROR HANDLING / ROLLBACK
   * Real postgres.js: if the callback throws, ROLLBACK is
   * called. In Mvfm, there's no throwing — we're building
   * a tree. Rollback semantics are the interpreter's job.
   * The AST just says "these queries are in a transaction."
   * The interpreter wraps them in BEGIN/COMMIT/ROLLBACK.
   *
   * Problem 4: DESTRUCTURING
   * Real: const [user] = await sql`...`
   * Mvfm: can't destructure a proxy meaningfully.
   * You'd write: const user = sql`...` and access user[0]
   * or use a helper like sql`...`.first()
   *
   * Deviation #4: No destructuring of query results.
   * user[0] works (proxy intercepts numeric index).
   * But `const [user] = ...` doesn't because JS destructuring
   * calls Symbol.iterator which we can't meaningfully proxy.
   */
  /**
   * Cursor — iterate over large result sets in batches.
   *
   * Real postgres.js:
   *   await sql`select * from large_table`.cursor(100, async rows => { ... })
   *
   * Mvfm:
   *   $.sql.cursor($.sql`select * from large_table`, 100, (batch) => {
   *     return $.sql`insert into archive ${$.sql.insert(batch)}`
   *   })
   *
   * Deviation #5: Can't chain .cursor() on a query result because the
   * proxy engine doesn't support calling Expr results as functions (no
   * `apply` trap). So we use a helper method on $.sql instead.
   */
  cursor<T = Record<string, any>>(
    query: Expr<T[]>,
    batchSize: number | Expr<number>,
    fn: (batch: Expr<T[]>) => Expr<any> | any,
  ): Expr<void>;

  begin<T>(fn: (sql: PostgresTxSql) => Expr<T> | Expr<any>[]): Expr<T>;
}

/**
 * The scoped sql instance inside a transaction.
 * Same as the outer sql but without .begin() (no nested transactions).
 * Has .savepoint() instead.
 */
interface PostgresTxSql {
  <T = Record<string, any>>(
    strings: TemplateStringsArray,
    ...values: (Expr<any> | string | number | boolean | null)[]
  ): Expr<T[]>;

  id(name: Expr<string> | string): Expr<any>;
  insert(data: Expr<any>, columns?: string[]): Expr<any>;
  set(data: Expr<any>, columns?: string[]): Expr<any>;

  cursor<T = Record<string, any>>(
    query: Expr<T[]>,
    batchSize: number | Expr<number>,
    fn: (batch: Expr<T[]>) => Expr<any> | any,
  ): Expr<void>;

  savepoint<T>(fn: (sql: PostgresTxSql) => Expr<T> | Expr<any>[]): Expr<T>;
}

// ---- Configuration ----------------------------------------

/**
 * Connection configuration for the postgres plugin.
 *
 * Accepts the same options as postgres.js: connection string or
 * individual host/port/database/username/password fields, plus
 * SSL, connection pool size, and column name transforms.
 */
export interface PostgresConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean | object;
  max?: number;
  transform?: {
    column?: { to?: string; from?: string };
  };
}

// ---- Plugin implementation --------------------------------

/**
 * Postgres plugin factory. Namespace: `postgres/`.
 *
 * Creates a plugin that exposes a `sql` tagged template for building
 * parameterized queries, plus helpers for identifiers, inserts, updates,
 * transactions, savepoints, and cursors.
 *
 * @param config - A connection string or {@link PostgresConfig} object.
 * @returns A PluginDefinition for the postgres plugin.
 */
export function postgres(config?: PostgresConfig | string) {
  const resolvedConfig: PostgresConfig =
    typeof config === "string" ? { connectionString: config } : (config ?? {});

  return definePlugin({
    name: "postgres",
    nodeKinds: [
      "postgres/query",
      "postgres/identifier",
      "postgres/insert_helper",
      "postgres/set_helper",
      "postgres/begin",
      "postgres/savepoint",
      "postgres/cursor",
      "postgres/cursor_batch",
    ],

    build(ctx: PluginContext): PostgresMethods {
      // Build a sql tagged template function + helpers
      function makeSql(scope: "top" | "transaction" | "savepoint"): any {
        // The tagged template function itself
        const sqlFn = (strings: TemplateStringsArray, ...values: any[]) => {
          return ctx.expr({
            kind: "postgres/query",
            strings: Array.from(strings),
            params: values.map((v) =>
              ctx.isExpr(v) ? v.__node : { kind: "core/literal", value: v },
            ),
            config: resolvedConfig,
          });
        };

        // .id() — dynamic identifier
        sqlFn.id = (name: any) =>
          ctx.expr({
            kind: "postgres/identifier",
            name: ctx.isExpr(name) ? name.__node : { kind: "core/literal", value: name },
          });

        // .insert() — dynamic insert helper
        sqlFn.insert = (data: any, columns?: string[]) =>
          ctx.expr({
            kind: "postgres/insert_helper",
            data: ctx.isExpr(data) ? data.__node : ctx.lift(data).__node,
            columns: columns ?? null,
          });

        // .set() — dynamic update helper
        sqlFn.set = (data: any, columns?: string[]) =>
          ctx.expr({
            kind: "postgres/set_helper",
            data: ctx.isExpr(data) ? data.__node : ctx.lift(data).__node,
            columns: columns ?? null,
          });

        // .cursor() — callback-style cursor for large result sets
        // Available at all scope levels (top, transaction, savepoint)
        sqlFn.cursor = (query: any, batchSize: any, fn: Function) => {
          const batchNode: TypedNode = { kind: "postgres/cursor_batch" };
          const batchProxy = ctx.expr(batchNode);
          const bodyResult = fn(batchProxy);
          const bodyNode = ctx.isExpr(bodyResult) ? bodyResult.__node : ctx.lift(bodyResult).__node;

          return ctx.expr({
            kind: "postgres/cursor",
            query: ctx.isExpr(query) ? query.__node : ctx.lift(query).__node,
            batchSize: ctx.isExpr(batchSize)
              ? batchSize.__node
              : { kind: "core/literal", value: batchSize },
            body: bodyNode,
          });
        };

        // .begin() — transactions (only at top level)
        if (scope === "top") {
          sqlFn.begin = (fn: Function) => {
            const txSql = makeSql("transaction");
            const result = fn(txSql);

            // If the callback returns an array, treat it as
            // pipelined queries (postgres.js supports this)
            const body = Array.isArray(result)
              ? {
                  kind: "postgres/begin" as const,
                  mode: "pipeline" as const,
                  queries: result.map((r: any) => (ctx.isExpr(r) ? r.__node : ctx.lift(r).__node)),
                  config: resolvedConfig,
                }
              : {
                  kind: "postgres/begin" as const,
                  mode: "callback" as const,
                  body: ctx.isExpr(result) ? result.__node : ctx.lift(result).__node,
                  config: resolvedConfig,
                };

            return ctx.expr(body);
          };
        }

        // .savepoint() — only inside transactions
        if (scope === "transaction" || scope === "savepoint") {
          sqlFn.savepoint = (fn: Function) => {
            const spSql = makeSql("savepoint");
            const result = fn(spSql);

            const body = Array.isArray(result)
              ? {
                  kind: "postgres/savepoint" as const,
                  mode: "pipeline" as const,
                  queries: result.map((r: any) => (ctx.isExpr(r) ? r.__node : ctx.lift(r).__node)),
                }
              : {
                  kind: "postgres/savepoint" as const,
                  mode: "callback" as const,
                  body: ctx.isExpr(result) ? result.__node : ctx.lift(result).__node,
                };

            return ctx.expr(body);
          };
        }

        return sqlFn;
      }

      return {
        sql: makeSql("top") as PostgresSql,
      };
    },
  });
}

// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// ✅ WORKS GREAT:
//
// 1. Basic queries:
//    Real:  const users = await sql`select * from users where age > ${age}`
//    Mvfm: const users = $.sql`select * from users where age > ${age}`
//    Nearly identical. The only diff is $ prefix and no await.
//
// 2. Parameterized queries with proxy values:
//    const user = $.sql`select * from users where id = ${$.input.id}`
//    const posts = $.sql`select * from posts where user_id = ${user[0].id}`
//    Proxy chains capture the dependency graph perfectly.
//
// 3. Dynamic identifiers:
//    Real:  sql`select ${sql('name')} from ${sql('users')}`
//    Mvfm: $.sql`select ${$.sql.id('name')} from ${$.sql.id('users')}`
//    Slightly more verbose but unambiguous.
//
// 4. Transactions (pipeline mode):
//    Real:  sql.begin(sql => [sql`update ...`, sql`insert ...`])
//    Mvfm: $.sql.begin(sql => [sql`update ...`, sql`insert ...`])
//    Identical! Array = sequence of effects.
//
// 5. Insert helpers:
//    Real:  sql`insert into users ${sql(user, 'name', 'age')}`
//    Mvfm: $.sql`insert into users ${$.sql.insert(user, ['name', 'age'])}`
//    Slightly different call style but same semantics.
//
// ⚠️  WORKS BUT DIFFERENT:
//
// 6. Destructuring results:
//    Real:  const [user] = await sql`select ... limit 1`
//    Mvfm: const user = $.sql`select ... limit 1`[0]
//    Or:    const user = $.sql`select ... limit 1`.first  // could add sugar
//    Can't destructure proxies. [0] index access works though.
//
// 7. Transactions (callback mode with dependencies):
//    Real:
//      const [user, account] = await sql.begin(async sql => {
//        const [user] = await sql`insert ... returning *`
//        const [account] = await sql`insert ... values (${user.user_id})`
//        return [user, account]
//      })
//    Mvfm:
//      const result = $.sql.begin(sql => {
//        const user = sql`insert ... returning *`
//        const account = sql`insert ... values (${user[0].user_id})`
//        return $.begin(user, account, { user: user[0], account: account[0] })
//      })
//    The dependency graph is captured via proxy, but you need
//    $.begin() to sequence the side effects. And no destructuring.
//
// ❌ DOESN'T WORK / HARD:
//
// 8. Conditional queries inside transactions:
//    Real:
//      await sql.begin(async sql => {
//        const [user] = await sql`select * from users where id = ${id}`
//        if (user.role === 'admin') {
//          await sql`insert into audit_log ...`
//        }
//      })
//    Mvfm:
//      $.sql.begin(sql => {
//        const user = sql`select * from users where id = ${$.input.id}`
//        // Can't do native if() on a proxy!
//        // Must use $.cond():
//        return $.cond($.eq(user[0].role, 'admin'))
//          .t($.begin(
//            sql`insert into audit_log ...`,
//            user
//          ))
//          .f(user)
//      })
//    This works but is significantly less natural than the real thing.
//
// 9. Error handling:
//    Real:  sql`...`.catch(err => ...)
//    Mvfm: $.try($.sql`...`).catch(err => fallback)
//    The error plugin provides $.try(), $.attempt(), $.orElse(),
//    $.guard(), $.settle(). These compose with postgres queries
//    to catch real constraint violations, missing tables, etc.
//    Tested with real Postgres via testcontainers.
//
// 10. Cursors:
//    Real:  sql`...`.cursor(10, rows => ...)
//    Mvfm:   $.sql.cursor($.sql`...`, 10, (batch) => ...)
//    Modeled as postgres/cursor + postgres/cursor_batch AST nodes.
//    Can't chain .cursor() on query result (no apply trap on Proxy),
//    so we use a helper method on $.sql instead. (Deviation #5)
//    Streaming and COPY are still not modelable.
//
// 11. .describe(), .raw(), .values():
//    These are execution modifiers. In Mvfm they'd be AST
//    annotations that the interpreter reads. Doable but need
//    to be modeled as method calls on the query proxy.
//
// 12. Async/await ordering:
//    The big one. In real postgres.js, `await` is what gives you
//    sequential execution. In Mvfm, everything runs synchronously
//    during AST construction. For pure data dependencies (query B
//    uses result of query A), the proxy chain captures this. But
//    for "do A then do B" without data dependency, you need $.begin()
//    or the array pipeline syntax. This is the fundamental
//    mismatch between an imperative async API and a declarative
//    AST builder.
//
// ============================================================
// SUMMARY:
// Based on source-level analysis of postgres.js v3.4.8
// (github.com/porsager/postgres, tag v3.4.8).
//
// For the 80% case of "query, transform, return" — this is
// nearly identical to real postgres.js. For transactions with
// data dependencies, it works via proxy chains. For complex
// conditional logic inside transactions, it diverges.
//
// Error handling now works via the error plugin ($.try/catch),
// cursor callback form works via $.sql.cursor(), and
// concurrency (parallel queries, retry, timeout) works via
// the fiber plugin. All validated against real Postgres.
//
// Not supported: COPY (streaming in postgres.js — .writable()
// and .readable() return Node.js streams), LISTEN/NOTIFY
// (push-based, server-initiated), cursor async-iterable form
// (requires runtime iteration, can't be expressed as finite AST).
//
// The key insight: postgres.js's tagged template API is
// *already* essentially a DSL. We're just making the DSL
// explicit and serializable.
// ============================================================
