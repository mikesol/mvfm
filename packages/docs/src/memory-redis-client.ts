import type { RedisClient } from "@mvfm/plugin-redis";

/**
 * In-memory implementation of {@link RedisClient} for the docs playground.
 *
 * Stores data in plain Maps, emulating Redis string, hash, list, and TTL
 * semantics. Not suitable for production use — designed for deterministic
 * doc examples that run entirely in the browser.
 */
export class MemoryRedisClient implements RedisClient {
  private strings = new Map<string, string>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();
  private ttls = new Map<string, number>();

  async command(command: string, ...args: unknown[]): Promise<unknown> {
    const cmd = command.toUpperCase();
    switch (cmd) {
      case "GET":
        return this.strings.get(s(args[0])) ?? null;
      case "SET": {
        this.strings.set(s(args[0]), s(args[1]));
        return "OK";
      }
      case "INCR":
        return this.incrBy(s(args[0]), 1);
      case "INCRBY":
        return this.incrBy(s(args[0]), int(args[1]));
      case "DECR":
        return this.incrBy(s(args[0]), -1);
      case "DECRBY":
        return this.incrBy(s(args[0]), -int(args[1]));
      case "MGET":
        return args.map((k) => this.strings.get(s(k)) ?? null);
      case "MSET": {
        for (let i = 0; i < args.length; i += 2) {
          this.strings.set(s(args[i]), s(args[i + 1]));
        }
        return "OK";
      }
      case "APPEND": {
        const key = s(args[0]);
        const cur = this.strings.get(key) ?? "";
        const next = cur + s(args[1]);
        this.strings.set(key, next);
        return next.length;
      }
      case "GETRANGE": {
        const val = this.strings.get(s(args[0])) ?? "";
        const start = clampIndex(int(args[1]), val.length);
        const end = clampIndex(int(args[2]), val.length);
        return start > end ? "" : val.slice(start, end + 1);
      }
      case "SETRANGE": {
        const key = s(args[0]);
        const offset = int(args[1]);
        const value = s(args[2]);
        let cur = this.strings.get(key) ?? "";
        if (cur.length < offset) cur = cur.padEnd(offset, "\0");
        const next = cur.slice(0, offset) + value + cur.slice(offset + value.length);
        this.strings.set(key, next);
        return next.length;
      }
      case "DEL": {
        let count = 0;
        for (const a of args) {
          const k = s(a);
          const d1 = this.strings.delete(k);
          const d2 = this.hashes.delete(k);
          const d3 = this.lists.delete(k);
          if (d1 || d2 || d3) count++;
          this.ttls.delete(k);
        }
        return count;
      }
      case "EXISTS": {
        let count = 0;
        for (const a of args) {
          const k = s(a);
          if (this.strings.has(k) || this.hashes.has(k) || this.lists.has(k)) count++;
        }
        return count;
      }
      case "EXPIRE": {
        const key = s(args[0]);
        if (!this.keyExists(key)) return 0;
        this.ttls.set(key, Date.now() + int(args[1]) * 1000);
        return 1;
      }
      case "PEXPIRE": {
        const key = s(args[0]);
        if (!this.keyExists(key)) return 0;
        this.ttls.set(key, Date.now() + int(args[1]));
        return 1;
      }
      case "TTL": {
        const key = s(args[0]);
        if (!this.keyExists(key)) return -2;
        const deadline = this.ttls.get(key);
        if (deadline == null) return -1;
        return Math.max(Math.ceil((deadline - Date.now()) / 1000), -2);
      }
      case "PTTL": {
        const key = s(args[0]);
        if (!this.keyExists(key)) return -2;
        const deadline = this.ttls.get(key);
        if (deadline == null) return -1;
        return Math.max(deadline - Date.now(), -2);
      }
      case "HGET": {
        const h = this.hashes.get(s(args[0]));
        return h?.get(s(args[1])) ?? null;
      }
      case "HSET": {
        const key = s(args[0]);
        let h = this.hashes.get(key);
        if (!h) {
          h = new Map();
          this.hashes.set(key, h);
        }
        let added = 0;
        for (let i = 1; i < args.length; i += 2) {
          if (!h.has(s(args[i]))) added++;
          h.set(s(args[i]), s(args[i + 1]));
        }
        return added;
      }
      case "HMGET": {
        const h = this.hashes.get(s(args[0]));
        return args.slice(1).map((f) => h?.get(s(f)) ?? null);
      }
      case "HGETALL": {
        const h = this.hashes.get(s(args[0]));
        if (!h) return [];
        const out: string[] = [];
        for (const [k, v] of h) out.push(k, v);
        return out;
      }
      case "HDEL": {
        const h = this.hashes.get(s(args[0]));
        if (!h) return 0;
        let count = 0;
        for (let i = 1; i < args.length; i++) {
          if (h.delete(s(args[i]))) count++;
        }
        return count;
      }
      case "HEXISTS": {
        const h = this.hashes.get(s(args[0]));
        return h?.has(s(args[1])) ? 1 : 0;
      }
      case "HLEN":
        return this.hashes.get(s(args[0]))?.size ?? 0;
      case "HKEYS": {
        const h = this.hashes.get(s(args[0]));
        return h ? [...h.keys()] : [];
      }
      case "HVALS": {
        const h = this.hashes.get(s(args[0]));
        return h ? [...h.values()] : [];
      }
      case "HINCRBY": {
        const key = s(args[0]);
        const field = s(args[1]);
        const inc = int(args[2]);
        let h = this.hashes.get(key);
        if (!h) {
          h = new Map();
          this.hashes.set(key, h);
        }
        const cur = parseInt(h.get(field) ?? "0", 10);
        const next = cur + inc;
        h.set(field, String(next));
        return next;
      }
      case "LPUSH": {
        const key = s(args[0]);
        let list = this.lists.get(key);
        if (!list) {
          list = [];
          this.lists.set(key, list);
        }
        for (let i = 1; i < args.length; i++) {
          list.unshift(s(args[i]));
        }
        return list.length;
      }
      case "RPUSH": {
        const key = s(args[0]);
        let list = this.lists.get(key);
        if (!list) {
          list = [];
          this.lists.set(key, list);
        }
        for (let i = 1; i < args.length; i++) {
          list.push(s(args[i]));
        }
        return list.length;
      }
      case "LPOP": {
        const list = this.lists.get(s(args[0]));
        if (!list || list.length === 0) return null;
        if (args.length > 1) {
          const count = int(args[1]);
          return list.splice(0, count);
        }
        return list.shift() ?? null;
      }
      case "RPOP": {
        const list = this.lists.get(s(args[0]));
        if (!list || list.length === 0) return null;
        if (args.length > 1) {
          const count = int(args[1]);
          return list.splice(-count, count);
        }
        return list.pop() ?? null;
      }
      case "LLEN":
        return this.lists.get(s(args[0]))?.length ?? 0;
      case "LRANGE": {
        const list = this.lists.get(s(args[0])) ?? [];
        const start = resolveIndex(int(args[1]), list.length);
        const stop = resolveIndex(int(args[2]), list.length);
        if (start > stop || start >= list.length) return [];
        return list.slice(start, stop + 1);
      }
      case "LINDEX": {
        const list = this.lists.get(s(args[0]));
        if (!list) return null;
        const idx = resolveIndex(int(args[1]), list.length);
        return list[idx] ?? null;
      }
      case "LSET": {
        const list = this.lists.get(s(args[0]));
        if (!list) throw new Error("ERR no such key");
        const idx = resolveIndex(int(args[1]), list.length);
        if (idx < 0 || idx >= list.length) throw new Error("ERR index out of range");
        list[idx] = s(args[2]);
        return "OK";
      }
      case "LREM": {
        const list = this.lists.get(s(args[0]));
        if (!list) return 0;
        const count = int(args[1]);
        const element = s(args[2]);
        let removed = 0;
        if (count > 0) {
          for (let i = 0; i < list.length && removed < count; i++) {
            if (list[i] === element) {
              list.splice(i, 1);
              removed++;
              i--;
            }
          }
        } else if (count < 0) {
          for (let i = list.length - 1; i >= 0 && removed < -count; i--) {
            if (list[i] === element) {
              list.splice(i, 1);
              removed++;
            }
          }
        } else {
          for (let i = list.length - 1; i >= 0; i--) {
            if (list[i] === element) {
              list.splice(i, 1);
              removed++;
            }
          }
        }
        return removed;
      }
      case "LINSERT": {
        const list = this.lists.get(s(args[0]));
        if (!list) return 0;
        const position = s(args[1]).toUpperCase();
        const pivot = s(args[2]);
        const element = s(args[3]);
        const idx = list.indexOf(pivot);
        if (idx === -1) return -1;
        list.splice(position === "BEFORE" ? idx : idx + 1, 0, element);
        return list.length;
      }
      default:
        throw new Error(`MemoryRedisClient: unsupported command "${cmd}"`);
    }
  }

  private keyExists(key: string): boolean {
    return this.strings.has(key) || this.hashes.has(key) || this.lists.has(key);
  }

  private incrBy(key: string, delta: number): number {
    const cur = parseInt(this.strings.get(key) ?? "0", 10);
    const next = cur + delta;
    this.strings.set(key, String(next));
    return next;
  }
}

function s(v: unknown): string {
  return String(v);
}

function int(v: unknown): number {
  return typeof v === "number" ? Math.trunc(v) : parseInt(String(v), 10);
}

function clampIndex(idx: number, len: number): number {
  if (idx < 0) return Math.max(0, len + idx);
  return Math.min(idx, len - 1);
}

function resolveIndex(idx: number, len: number): number {
  return idx < 0 ? len + idx : idx;
}
