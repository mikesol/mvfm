import { describe, expect, it } from "vitest";
import { app, strip } from "./ast.shared";

describe("redis: key commands", () => {
  it("produces expire/pexpire/ttl/pttl nodes", () => {
    expect((strip(app(($) => $.redis.expire("mykey", 300)).ast) as any).result.kind).toBe(
      "redis/expire",
    );
    expect((strip(app(($) => $.redis.pexpire("mykey", 5000)).ast) as any).result.kind).toBe(
      "redis/pexpire",
    );
    expect((strip(app(($) => $.redis.ttl("mykey")).ast) as any).result.kind).toBe("redis/ttl");
    expect((strip(app(($) => $.redis.pttl("mykey")).ast) as any).result.kind).toBe("redis/pttl");
  });
});

describe("redis: hash commands", () => {
  it("produces h* nodes", () => {
    expect((strip(app(($) => $.redis.hget("myhash", "field1")).ast) as any).result.kind).toBe(
      "redis/hget",
    );
    expect(
      (strip(app(($) => $.redis.hset("myhash", { field1: "val1" })).ast) as any).result.kind,
    ).toBe("redis/hset");
    expect((strip(app(($) => $.redis.hmget("myhash", "f1", "f2")).ast) as any).result.kind).toBe(
      "redis/hmget",
    );
    expect((strip(app(($) => $.redis.hgetall("myhash")).ast) as any).result.kind).toBe(
      "redis/hgetall",
    );
    expect((strip(app(($) => $.redis.hdel("myhash", "f1", "f2")).ast) as any).result.kind).toBe(
      "redis/hdel",
    );
    expect((strip(app(($) => $.redis.hexists("myhash", "field1")).ast) as any).result.kind).toBe(
      "redis/hexists",
    );
    expect((strip(app(($) => $.redis.hlen("myhash")).ast) as any).result.kind).toBe("redis/hlen");
    expect((strip(app(($) => $.redis.hkeys("myhash")).ast) as any).result.kind).toBe("redis/hkeys");
    expect((strip(app(($) => $.redis.hvals("myhash")).ast) as any).result.kind).toBe("redis/hvals");
    expect(
      (strip(app(($) => $.redis.hincrby("myhash", "counter", 10)).ast) as any).result.kind,
    ).toBe("redis/hincrby");
  });
});

describe("redis: list commands", () => {
  it("produces list command nodes", () => {
    expect((strip(app(($) => $.redis.lpush("mylist", "a", "b")).ast) as any).result.kind).toBe(
      "redis/lpush",
    );
    expect((strip(app(($) => $.redis.rpush("mylist", "c")).ast) as any).result.kind).toBe(
      "redis/rpush",
    );
    expect((strip(app(($) => $.redis.lpop("mylist", 3)).ast) as any).result.kind).toBe(
      "redis/lpop",
    );
    expect((strip(app(($) => $.redis.rpop("mylist")).ast) as any).result.kind).toBe("redis/rpop");
    expect((strip(app(($) => $.redis.llen("mylist")).ast) as any).result.kind).toBe("redis/llen");
    expect((strip(app(($) => $.redis.lrange("mylist", 0, -1)).ast) as any).result.kind).toBe(
      "redis/lrange",
    );
    expect((strip(app(($) => $.redis.lindex("mylist", 2)).ast) as any).result.kind).toBe(
      "redis/lindex",
    );
    expect((strip(app(($) => $.redis.lset("mylist", 0, "newval")).ast) as any).result.kind).toBe(
      "redis/lset",
    );
    expect((strip(app(($) => $.redis.lrem("mylist", 2, "val")).ast) as any).result.kind).toBe(
      "redis/lrem",
    );
    expect(
      (strip(app(($) => $.redis.linsert("mylist", "BEFORE", "pivot", "elem")).ast) as any).result
        .kind,
    ).toBe("redis/linsert");
  });
});

describe("redis: cross-operation dependencies", () => {
  it("can use result of get as input to set", () => {
    const prog = app(($) => {
      const val = $.redis.get("source");
      const result = $.redis.set("dest", val);
      return $.begin(val, result);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/begin");
  });
});
