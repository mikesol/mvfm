import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Redis client interface consumed by the redis handler.
 *
 * Abstracts over ioredis so handlers can be tested with mock clients.
 * Uses a single generic `command()` method that maps to `redis.call()`.
 */
export interface RedisClient {
  /** Execute a Redis command and return the result. */
  command(command: string, ...args: unknown[]): Promise<unknown>;
}

/**
 * Flatten an object to alternating key-value array.
 * { a: 1, b: 2 } => ["a", 1, "b", 2]
 */
function flattenRecord(obj: Record<string, unknown>): unknown[] {
  const result: unknown[] = [];
  for (const [k, v] of Object.entries(obj)) {
    result.push(k, v);
  }
  return result;
}

/**
 * Generator-based interpreter fragment for redis plugin nodes.
 *
 * Yields `redis/command` effects for all 35 operations. Each effect
 * contains the Redis command name and a flat args array matching
 * the Redis protocol.
 */
export const redisInterpreter: InterpreterFragment = {
  pluginName: "redis",
  canHandle: (node) => node.kind.startsWith("redis/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      // ---- String commands ----

      case "redis/get": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "GET", args: [key] };
      }

      case "redis/set": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const value = yield { type: "recurse", child: node.value as ASTNode };
        const extra: unknown[] = [];
        for (const a of (node.args as ASTNode[]) || []) {
          extra.push(yield { type: "recurse", child: a });
        }
        return yield { type: "redis/command", command: "SET", args: [key, value, ...extra] };
      }

      case "redis/incr": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "INCR", args: [key] };
      }

      case "redis/incrby": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const increment = yield { type: "recurse", child: node.increment as ASTNode };
        return yield { type: "redis/command", command: "INCRBY", args: [key, increment] };
      }

      case "redis/decr": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "DECR", args: [key] };
      }

      case "redis/decrby": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const decrement = yield { type: "recurse", child: node.decrement as ASTNode };
        return yield { type: "redis/command", command: "DECRBY", args: [key, decrement] };
      }

      case "redis/mget": {
        const keys: unknown[] = [];
        for (const k of node.keys as ASTNode[]) {
          keys.push(yield { type: "recurse", child: k });
        }
        return yield { type: "redis/command", command: "MGET", args: keys };
      }

      case "redis/mset": {
        const mapping = (yield { type: "recurse", child: node.mapping as ASTNode }) as Record<
          string,
          unknown
        >;
        return yield { type: "redis/command", command: "MSET", args: flattenRecord(mapping) };
      }

      case "redis/append": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const value = yield { type: "recurse", child: node.value as ASTNode };
        return yield { type: "redis/command", command: "APPEND", args: [key, value] };
      }

      case "redis/getrange": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const start = yield { type: "recurse", child: node.start as ASTNode };
        const end = yield { type: "recurse", child: node.end as ASTNode };
        return yield { type: "redis/command", command: "GETRANGE", args: [key, start, end] };
      }

      case "redis/setrange": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const offset = yield { type: "recurse", child: node.offset as ASTNode };
        const value = yield { type: "recurse", child: node.value as ASTNode };
        return yield { type: "redis/command", command: "SETRANGE", args: [key, offset, value] };
      }

      // ---- Key commands ----

      case "redis/del": {
        const keys: unknown[] = [];
        for (const k of node.keys as ASTNode[]) {
          keys.push(yield { type: "recurse", child: k });
        }
        return yield { type: "redis/command", command: "DEL", args: keys };
      }

      case "redis/exists": {
        const keys: unknown[] = [];
        for (const k of node.keys as ASTNode[]) {
          keys.push(yield { type: "recurse", child: k });
        }
        return yield { type: "redis/command", command: "EXISTS", args: keys };
      }

      case "redis/expire": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const seconds = yield { type: "recurse", child: node.seconds as ASTNode };
        return yield { type: "redis/command", command: "EXPIRE", args: [key, seconds] };
      }

      case "redis/pexpire": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const ms = yield { type: "recurse", child: node.milliseconds as ASTNode };
        return yield { type: "redis/command", command: "PEXPIRE", args: [key, ms] };
      }

      case "redis/ttl": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "TTL", args: [key] };
      }

      case "redis/pttl": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "PTTL", args: [key] };
      }

      // ---- Hash commands ----

      case "redis/hget": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const field = yield { type: "recurse", child: node.field as ASTNode };
        return yield { type: "redis/command", command: "HGET", args: [key, field] };
      }

      case "redis/hset": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const mapping = (yield { type: "recurse", child: node.mapping as ASTNode }) as Record<
          string,
          unknown
        >;
        return yield {
          type: "redis/command",
          command: "HSET",
          args: [key, ...flattenRecord(mapping)],
        };
      }

      case "redis/hmget": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const fields: unknown[] = [];
        for (const f of node.fields as ASTNode[]) {
          fields.push(yield { type: "recurse", child: f });
        }
        return yield { type: "redis/command", command: "HMGET", args: [key, ...fields] };
      }

      case "redis/hgetall": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "HGETALL", args: [key] };
      }

      case "redis/hdel": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const fields: unknown[] = [];
        for (const f of node.fields as ASTNode[]) {
          fields.push(yield { type: "recurse", child: f });
        }
        return yield { type: "redis/command", command: "HDEL", args: [key, ...fields] };
      }

      case "redis/hexists": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const field = yield { type: "recurse", child: node.field as ASTNode };
        return yield { type: "redis/command", command: "HEXISTS", args: [key, field] };
      }

      case "redis/hlen": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "HLEN", args: [key] };
      }

      case "redis/hkeys": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "HKEYS", args: [key] };
      }

      case "redis/hvals": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "HVALS", args: [key] };
      }

      case "redis/hincrby": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const field = yield { type: "recurse", child: node.field as ASTNode };
        const increment = yield { type: "recurse", child: node.increment as ASTNode };
        return yield { type: "redis/command", command: "HINCRBY", args: [key, field, increment] };
      }

      // ---- List commands ----

      case "redis/lpush": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const elements: unknown[] = [];
        for (const e of node.elements as ASTNode[]) {
          elements.push(yield { type: "recurse", child: e });
        }
        return yield { type: "redis/command", command: "LPUSH", args: [key, ...elements] };
      }

      case "redis/rpush": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const elements: unknown[] = [];
        for (const e of node.elements as ASTNode[]) {
          elements.push(yield { type: "recurse", child: e });
        }
        return yield { type: "redis/command", command: "RPUSH", args: [key, ...elements] };
      }

      case "redis/lpop": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const args: unknown[] = [key];
        if (node.count != null) {
          args.push(yield { type: "recurse", child: node.count as ASTNode });
        }
        return yield { type: "redis/command", command: "LPOP", args };
      }

      case "redis/rpop": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const args: unknown[] = [key];
        if (node.count != null) {
          args.push(yield { type: "recurse", child: node.count as ASTNode });
        }
        return yield { type: "redis/command", command: "RPOP", args };
      }

      case "redis/llen": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "LLEN", args: [key] };
      }

      case "redis/lrange": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const start = yield { type: "recurse", child: node.start as ASTNode };
        const stop = yield { type: "recurse", child: node.stop as ASTNode };
        return yield { type: "redis/command", command: "LRANGE", args: [key, start, stop] };
      }

      case "redis/lindex": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const index = yield { type: "recurse", child: node.index as ASTNode };
        return yield { type: "redis/command", command: "LINDEX", args: [key, index] };
      }

      case "redis/lset": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const index = yield { type: "recurse", child: node.index as ASTNode };
        const element = yield { type: "recurse", child: node.element as ASTNode };
        return yield { type: "redis/command", command: "LSET", args: [key, index, element] };
      }

      case "redis/lrem": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const count = yield { type: "recurse", child: node.count as ASTNode };
        const element = yield { type: "recurse", child: node.element as ASTNode };
        return yield { type: "redis/command", command: "LREM", args: [key, count, element] };
      }

      case "redis/linsert": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const pivot = yield { type: "recurse", child: node.pivot as ASTNode };
        const element = yield { type: "recurse", child: node.element as ASTNode };
        return yield {
          type: "redis/command",
          command: "LINSERT",
          args: [key, node.position as string, pivot, element],
        };
      }

      default:
        throw new Error(`Redis interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
