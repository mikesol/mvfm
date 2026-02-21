import { describe, expect, it } from "vitest";
import { redis } from "../../src/5.4.1";

const plugin = redis({ host: "127.0.0.1", port: 6379 });
const api = plugin.ctors.redis;

describe("redis: CExpr construction (key commands)", () => {
  it("produces key command CExprs", () => {
    expect(api.del("mykey").__kind).toBe("redis/del");
    expect(api.exists("mykey").__kind).toBe("redis/exists");
    expect(api.expire("mykey", 300).__kind).toBe("redis/expire");
    expect(api.pexpire("mykey", 5000).__kind).toBe("redis/pexpire");
    expect(api.ttl("mykey").__kind).toBe("redis/ttl");
    expect(api.pttl("mykey").__kind).toBe("redis/pttl");
  });
});

describe("redis: CExpr construction (hash commands)", () => {
  it("produces hash command CExprs", () => {
    expect(api.hget("myhash", "field1").__kind).toBe("redis/hget");
    const hsetExpr = api.hset("myhash", { field1: "val1" });
    expect(hsetExpr.__kind).toBe("redis/hset");
    expect(hsetExpr.__args).toHaveLength(2);
    const recordArg = hsetExpr.__args[1] as { __kind: string };
    expect(recordArg.__kind).toBe("redis/record");
    expect(api.hmget("myhash", "f1", "f2").__kind).toBe("redis/hmget");
    expect(api.hgetall("myhash").__kind).toBe("redis/hgetall");
    expect(api.hdel("myhash", "f1", "f2").__kind).toBe("redis/hdel");
    expect(api.hexists("myhash", "field1").__kind).toBe("redis/hexists");
    expect(api.hlen("myhash").__kind).toBe("redis/hlen");
    expect(api.hkeys("myhash").__kind).toBe("redis/hkeys");
    expect(api.hvals("myhash").__kind).toBe("redis/hvals");
    expect(api.hincrby("myhash", "counter", 10).__kind).toBe("redis/hincrby");
  });
});

describe("redis: CExpr construction (list commands)", () => {
  it("produces list command CExprs", () => {
    expect(api.lpush("mylist", "a", "b").__kind).toBe("redis/lpush");
    expect(api.rpush("mylist", "c").__kind).toBe("redis/rpush");
    expect(api.lpop("mylist", 3).__kind).toBe("redis/lpop");
    expect(api.rpop("mylist").__kind).toBe("redis/rpop");
    expect(api.llen("mylist").__kind).toBe("redis/llen");
    expect(api.lrange("mylist", 0, -1).__kind).toBe("redis/lrange");
    expect(api.lindex("mylist", 2).__kind).toBe("redis/lindex");
    expect(api.lset("mylist", 0, "newval").__kind).toBe("redis/lset");
    expect(api.lrem("mylist", 2, "val").__kind).toBe("redis/lrem");
    expect(api.linsert("mylist", "BEFORE", "pivot", "elem").__kind).toBe("redis/linsert");
  });
});

describe("redis: defaults() without override", () => {
  it("throws when no override provided for redis plugin", async () => {
    const { defaults, numPluginU, strPluginU } = await import("@mvfm/core");
    const plugins = [numPluginU, strPluginU, plugin] as const;
    expect(() => defaults(plugins)).toThrow(/no defaultInterpreter/i);
  });
});
