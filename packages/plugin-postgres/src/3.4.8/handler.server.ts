import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { createPostgresInterpreter, type PostgresClient } from "./interpreter";

/** Marker for SQL fragment results from identifier/insert/set helpers. */
interface PgFragment {
  __pgFragment: true;
  sql: string;
  params: unknown[];
}

function isPgFragment(v: unknown): v is PgFragment {
  return typeof v === "object" && v !== null && (v as PgFragment).__pgFragment === true;
}

/**
 * Build parameterized SQL from evaluated children of a postgres/query node.
 */
function buildQuerySQL(
  strings: string[],
  paramValues: unknown[],
): { sql: string; params: unknown[] } {
  let sql = "";
  const params: unknown[] = [];
  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < paramValues.length) {
      const val = paramValues[i];
      if (isPgFragment(val)) {
        sql += val.sql;
        params.push(...val.params);
      } else {
        params.push(val);
        sql += `$${params.length}`;
      }
    }
  }
  return { sql, params };
}

/**
 * Evaluate a postgres/query node's children and build SQL.
 * Used by both the query override and the cursor handler.
 */
async function* evalQueryChildren(
  entry: RuntimeEntry,
): AsyncGenerator<number, { sql: string; params: unknown[] }, unknown> {
  const numStrings = (yield 0) as number;
  const strings: string[] = [];
  for (let i = 0; i < numStrings; i++) {
    strings.push((yield 1 + i) as string);
  }
  const paramValues: unknown[] = [];
  for (let i = 1 + numStrings; i < entry.children.length; i++) {
    paramValues.push(yield i);
  }
  return buildQuerySQL(strings, paramValues);
}

/**
 * Creates a full server-side interpreter for `postgres/*` node kinds,
 * including transaction, savepoint, and cursor support.
 *
 * Uses a closure-scoped client stack so that queries inside transactions
 * automatically use the transaction client. No adjacency map or base
 * interpreter required — all child evaluation uses generator yields.
 *
 * @param client - The {@link PostgresClient} to execute against.
 * @returns An Interpreter for all postgres node kinds.
 */
export function createPostgresServerInterpreter(client: PostgresClient): Interpreter {
  const base = createPostgresInterpreter(client);
  const clientStack: PostgresClient[] = [client];
  const currentClient = () => clientStack[clientStack.length - 1];
  const batchCell: { current: unknown[] } = { current: [] };

  return {
    ...base,

    // Override query to use clientStack instead of the fixed client
    "postgres/query": async function* (entry: RuntimeEntry) {
      const gen = evalQueryChildren(entry);
      let result = await gen.next();
      while (!result.done) {
        const childValue: unknown = yield result.value;
        result = await gen.next(childValue);
      }
      const { sql, params } = result.value;
      return await currentClient().query(sql, params);
    },

    "postgres/begin": async function* (entry: RuntimeEntry) {
      const mode = (yield 0) as string;

      let resolveTx!: (tx: PostgresClient) => void;
      let resolveResult!: (result: unknown) => void;
      const txReady = new Promise<PostgresClient>((r) => {
        resolveTx = r;
      });
      const resultReady = new Promise<unknown>((r) => {
        resolveResult = r;
      });

      const txDone = currentClient().begin(async (tx) => {
        resolveTx(tx);
        return await resultReady;
      });

      const tx = await txReady;
      clientStack.push(tx);
      try {
        if (mode === "pipeline") {
          const results: unknown[] = [];
          for (let i = 1; i < entry.children.length; i++) {
            results.push(yield i);
          }
          resolveResult(results);
        } else {
          resolveResult(yield 1);
        }
        return await txDone;
      } finally {
        clientStack.pop();
      }
    },

    "postgres/savepoint": async function* (entry: RuntimeEntry) {
      const mode = (yield 0) as string;

      let resolveTx!: (tx: PostgresClient) => void;
      let resolveResult!: (result: unknown) => void;
      const txReady = new Promise<PostgresClient>((r) => {
        resolveTx = r;
      });
      const resultReady = new Promise<unknown>((r) => {
        resolveResult = r;
      });

      const txDone = currentClient().savepoint(async (tx) => {
        resolveTx(tx);
        return await resultReady;
      });

      const tx = await txReady;
      clientStack.push(tx);
      try {
        if (mode === "pipeline") {
          const results: unknown[] = [];
          for (let i = 1; i < entry.children.length; i++) {
            results.push(yield i);
          }
          resolveResult(results);
        } else {
          resolveResult(yield 1);
        }
        return await txDone;
      } finally {
        clientStack.pop();
      }
    },

    "postgres/cursor": async function* (_entry: RuntimeEntry) {
      // Step 1: Capture SQL from query without executing it.
      // Push a mock client that records SQL instead of running it.
      let capturedSQL = "";
      let capturedParams: unknown[] = [];
      const captureClient: PostgresClient = {
        async query(sql, params) {
          capturedSQL = sql;
          capturedParams = params;
          return [];
        },
        async begin(fn) {
          return fn(captureClient);
        },
        async savepoint(fn) {
          return fn(captureClient);
        },
        async cursor() {},
      };
      clientStack.push(captureClient);
      yield 0; // evaluate query — captures SQL via mock client
      clientStack.pop();

      // Step 2: Get batch size
      const batchSize = (yield 1) as number;

      // Step 3: Producer-consumer bridge for cursor iteration.
      // The cursor API is callback-based (push); the generator is pull-based.
      type BatchMsg = { rows: unknown[]; done: () => void } | null;
      const queue: BatchMsg[] = [];
      let waiter: ((msg: BatchMsg) => void) | null = null;

      function pushMsg(msg: BatchMsg) {
        if (waiter) {
          const w = waiter;
          waiter = null;
          w(msg);
        } else {
          queue.push(msg);
        }
      }

      function pullMsg(): Promise<BatchMsg> {
        if (queue.length > 0) return Promise.resolve(queue.shift()!);
        return new Promise((r) => {
          waiter = r;
        });
      }

      // Start cursor iteration in background
      const cursorDone = currentClient()
        .cursor(capturedSQL, capturedParams, batchSize, async (rows) => {
          return new Promise<undefined>((resolve) => {
            pushMsg({ rows, done: () => resolve(undefined) });
          });
        })
        .then(() => pushMsg(null));

      // Pull batches and evaluate body
      while (true) {
        const msg = await pullMsg();
        if (msg === null) break;
        batchCell.current = msg.rows;
        yield 2; // evaluate body with current batch
        msg.done(); // signal cursor callback to continue
      }

      await cursorDone;
      return undefined;
    },

    "postgres/cursor_batch": async function* () {
      return batchCell.current;
    },
  };
}
