import { describe, expect, it } from "vitest";
import { $, app, run } from "./interpreter.shared";

describe("redis interpreter: key/hash/list commands", () => {
  it("yields key commands", async () => {
    expect((await run(app($.redis.del("k1", "k2")))).captured[0].command).toBe("DEL");
    expect((await run(app($.redis.exists("mykey")))).captured[0].command).toBe("EXISTS");
    expect((await run(app($.redis.expire("mykey", 300)))).captured[0].args).toEqual(["mykey", 300]);
    expect((await run(app($.redis.pexpire("mykey", 5000)))).captured[0].args).toEqual([
      "mykey",
      5000,
    ]);
    expect((await run(app($.redis.ttl("mykey")))).captured[0].command).toBe("TTL");
    expect((await run(app($.redis.pttl("mykey")))).captured[0].command).toBe("PTTL");
  });

  it("yields hash commands", async () => {
    expect((await run(app($.redis.hget("myhash", "field1")))).captured[0].command).toBe("HGET");
    expect(
      (await run(app($.redis.hset("myhash", { f1: "v1", f2: "v2" })))).captured[0].args,
    ).toEqual(["myhash", "f1", "v1", "f2", "v2"]);
    expect((await run(app($.redis.hmget("myhash", "f1", "f2")))).captured[0].command).toBe("HMGET");
    expect((await run(app($.redis.hgetall("myhash")))).captured[0].command).toBe("HGETALL");
    expect((await run(app($.redis.hdel("myhash", "f1", "f2")))).captured[0].command).toBe("HDEL");
    expect((await run(app($.redis.hexists("myhash", "field1")))).captured[0].command).toBe(
      "HEXISTS",
    );
    expect((await run(app($.redis.hlen("myhash")))).captured[0].command).toBe("HLEN");
    expect((await run(app($.redis.hkeys("myhash")))).captured[0].command).toBe("HKEYS");
    expect((await run(app($.redis.hvals("myhash")))).captured[0].command).toBe("HVALS");
    expect((await run(app($.redis.hincrby("myhash", "counter", 10)))).captured[0].command).toBe(
      "HINCRBY",
    );
  });

  it("yields list commands", async () => {
    expect((await run(app($.redis.lpush("mylist", "a", "b")))).captured[0].command).toBe("LPUSH");
    expect((await run(app($.redis.rpush("mylist", "c")))).captured[0].command).toBe("RPUSH");
    expect((await run(app($.redis.lpop("mylist", 3)))).captured[0].args).toEqual(["mylist", 3]);
    expect((await run(app($.redis.rpop("mylist")))).captured[0].command).toBe("RPOP");
    expect((await run(app($.redis.llen("mylist")))).captured[0].command).toBe("LLEN");
    expect((await run(app($.redis.lrange("mylist", 0, -1)))).captured[0].command).toBe("LRANGE");
    expect((await run(app($.redis.lindex("mylist", 2)))).captured[0].command).toBe("LINDEX");
    expect((await run(app($.redis.lset("mylist", 0, "newval")))).captured[0].command).toBe("LSET");
    expect((await run(app($.redis.lrem("mylist", 2, "val")))).captured[0].command).toBe("LREM");
    expect(
      (await run(app($.redis.linsert("mylist", "BEFORE", "pivot", "elem")))).captured[0].command,
    ).toBe("LINSERT");
  });
});

describe("redis interpreter: return value", () => {
  it("returns handler response", async () => {
    const { result } = await run(app($.redis.get("mykey")));
    expect(result).toBe("mock_result");
  });
});
