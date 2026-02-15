import { describe, expect, it } from "vitest";
import { foldAST, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { redis } from "../../../../src/plugins/redis/5.4.1";
import { redisInterpreter } from "../../../../src/plugins/redis/5.4.1/interpreter";
import { str } from "../../../../src/plugins/str";

const app = ilo(num, str, redis({ host: "127.0.0.1", port: 6379 }));
const fragments = [redisInterpreter, coreInterpreter];

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

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "redis/command": async (effect) => {
      captured.push(effect);
      return "mock_result";
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ============================================================
// String commands
// ============================================================

describe("redis interpreter: get", () => {
  it("yields GET command", async () => {
    const prog = app(($) => $.redis.get("mykey"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("redis/command");
    expect(captured[0].command).toBe("GET");
    expect(captured[0].args).toEqual(["mykey"]);
  });
});

describe("redis interpreter: set", () => {
  it("yields SET command without flags", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].command).toBe("SET");
    expect(captured[0].args).toEqual(["mykey", "myvalue"]);
  });

  it("yields SET command with EX and NX positional tokens", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "EX", 60, "NX"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].command).toBe("SET");
    expect(captured[0].args).toEqual(["mykey", "myvalue", "EX", 60, "NX"]);
  });

  it("yields SET command with PX token", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "PX", 5000));
    const { captured } = await run(prog);
    expect(captured[0].args).toEqual(["mykey", "myvalue", "PX", 5000]);
  });

  it("yields SET command with EXAT token", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "EXAT", 1700000000));
    const { captured } = await run(prog);
    expect(captured[0].args).toEqual(["mykey", "myvalue", "EXAT", 1700000000]);
  });

  it("yields SET command with KEEPTTL token", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "KEEPTTL"));
    const { captured } = await run(prog);
    expect(captured[0].args).toEqual(["mykey", "myvalue", "KEEPTTL"]);
  });

  it("yields SET command with XX and GET tokens", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "XX", "GET"));
    const { captured } = await run(prog);
    expect(captured[0].args).toEqual(["mykey", "myvalue", "XX", "GET"]);
  });
});

describe("redis interpreter: incr/decr", () => {
  it("yields INCR command", async () => {
    const prog = app(($) => $.redis.incr("counter"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("INCR");
    expect(captured[0].args).toEqual(["counter"]);
  });

  it("yields INCRBY command", async () => {
    const prog = app(($) => $.redis.incrby("counter", 5));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("INCRBY");
    expect(captured[0].args).toEqual(["counter", 5]);
  });

  it("yields DECR command", async () => {
    const prog = app(($) => $.redis.decr("counter"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("DECR");
    expect(captured[0].args).toEqual(["counter"]);
  });

  it("yields DECRBY command", async () => {
    const prog = app(($) => $.redis.decrby("counter", 3));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("DECRBY");
    expect(captured[0].args).toEqual(["counter", 3]);
  });
});

describe("redis interpreter: mget/mset", () => {
  it("yields MGET command", async () => {
    const prog = app(($) => $.redis.mget("k1", "k2"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("MGET");
    expect(captured[0].args).toEqual(["k1", "k2"]);
  });

  it("yields MSET command", async () => {
    const prog = app(($) => $.redis.mset({ k1: "v1", k2: "v2" }));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("MSET");
    expect(captured[0].args).toEqual(["k1", "v1", "k2", "v2"]);
  });
});

describe("redis interpreter: append/getrange/setrange", () => {
  it("yields APPEND command", async () => {
    const prog = app(($) => $.redis.append("mykey", "extra"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("APPEND");
    expect(captured[0].args).toEqual(["mykey", "extra"]);
  });

  it("yields GETRANGE command", async () => {
    const prog = app(($) => $.redis.getrange("mykey", 0, 5));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("GETRANGE");
    expect(captured[0].args).toEqual(["mykey", 0, 5]);
  });

  it("yields SETRANGE command", async () => {
    const prog = app(($) => $.redis.setrange("mykey", 3, "abc"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("SETRANGE");
    expect(captured[0].args).toEqual(["mykey", 3, "abc"]);
  });
});

// ============================================================
// Key commands
// ============================================================

describe("redis interpreter: key commands", () => {
  it("yields DEL command", async () => {
    const prog = app(($) => $.redis.del("k1", "k2"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("DEL");
    expect(captured[0].args).toEqual(["k1", "k2"]);
  });

  it("yields EXISTS command", async () => {
    const prog = app(($) => $.redis.exists("mykey"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("EXISTS");
    expect(captured[0].args).toEqual(["mykey"]);
  });

  it("yields EXPIRE command", async () => {
    const prog = app(($) => $.redis.expire("mykey", 300));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("EXPIRE");
    expect(captured[0].args).toEqual(["mykey", 300]);
  });

  it("yields PEXPIRE command", async () => {
    const prog = app(($) => $.redis.pexpire("mykey", 5000));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("PEXPIRE");
    expect(captured[0].args).toEqual(["mykey", 5000]);
  });

  it("yields TTL command", async () => {
    const prog = app(($) => $.redis.ttl("mykey"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("TTL");
    expect(captured[0].args).toEqual(["mykey"]);
  });

  it("yields PTTL command", async () => {
    const prog = app(($) => $.redis.pttl("mykey"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("PTTL");
    expect(captured[0].args).toEqual(["mykey"]);
  });
});

// ============================================================
// Hash commands
// ============================================================

describe("redis interpreter: hash commands", () => {
  it("yields HGET command", async () => {
    const prog = app(($) => $.redis.hget("myhash", "field1"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HGET");
    expect(captured[0].args).toEqual(["myhash", "field1"]);
  });

  it("yields HSET command", async () => {
    const prog = app(($) => $.redis.hset("myhash", { f1: "v1", f2: "v2" }));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HSET");
    expect(captured[0].args).toEqual(["myhash", "f1", "v1", "f2", "v2"]);
  });

  it("yields HMGET command", async () => {
    const prog = app(($) => $.redis.hmget("myhash", "f1", "f2"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HMGET");
    expect(captured[0].args).toEqual(["myhash", "f1", "f2"]);
  });

  it("yields HGETALL command", async () => {
    const prog = app(($) => $.redis.hgetall("myhash"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HGETALL");
    expect(captured[0].args).toEqual(["myhash"]);
  });

  it("yields HDEL command", async () => {
    const prog = app(($) => $.redis.hdel("myhash", "f1", "f2"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HDEL");
    expect(captured[0].args).toEqual(["myhash", "f1", "f2"]);
  });

  it("yields HEXISTS command", async () => {
    const prog = app(($) => $.redis.hexists("myhash", "field1"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HEXISTS");
    expect(captured[0].args).toEqual(["myhash", "field1"]);
  });

  it("yields HLEN command", async () => {
    const prog = app(($) => $.redis.hlen("myhash"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HLEN");
    expect(captured[0].args).toEqual(["myhash"]);
  });

  it("yields HKEYS command", async () => {
    const prog = app(($) => $.redis.hkeys("myhash"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HKEYS");
    expect(captured[0].args).toEqual(["myhash"]);
  });

  it("yields HVALS command", async () => {
    const prog = app(($) => $.redis.hvals("myhash"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HVALS");
    expect(captured[0].args).toEqual(["myhash"]);
  });

  it("yields HINCRBY command", async () => {
    const prog = app(($) => $.redis.hincrby("myhash", "counter", 10));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HINCRBY");
    expect(captured[0].args).toEqual(["myhash", "counter", 10]);
  });
});

// ============================================================
// List commands
// ============================================================

describe("redis interpreter: list commands", () => {
  it("yields LPUSH command", async () => {
    const prog = app(($) => $.redis.lpush("mylist", "a", "b"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LPUSH");
    expect(captured[0].args).toEqual(["mylist", "a", "b"]);
  });

  it("yields RPUSH command", async () => {
    const prog = app(($) => $.redis.rpush("mylist", "c"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("RPUSH");
    expect(captured[0].args).toEqual(["mylist", "c"]);
  });

  it("yields LPOP command without count", async () => {
    const prog = app(($) => $.redis.lpop("mylist"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LPOP");
    expect(captured[0].args).toEqual(["mylist"]);
  });

  it("yields LPOP command with count", async () => {
    const prog = app(($) => $.redis.lpop("mylist", 3));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LPOP");
    expect(captured[0].args).toEqual(["mylist", 3]);
  });

  it("yields RPOP command", async () => {
    const prog = app(($) => $.redis.rpop("mylist"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("RPOP");
    expect(captured[0].args).toEqual(["mylist"]);
  });

  it("yields LLEN command", async () => {
    const prog = app(($) => $.redis.llen("mylist"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LLEN");
    expect(captured[0].args).toEqual(["mylist"]);
  });

  it("yields LRANGE command", async () => {
    const prog = app(($) => $.redis.lrange("mylist", 0, -1));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LRANGE");
    expect(captured[0].args).toEqual(["mylist", 0, -1]);
  });

  it("yields LINDEX command", async () => {
    const prog = app(($) => $.redis.lindex("mylist", 2));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LINDEX");
    expect(captured[0].args).toEqual(["mylist", 2]);
  });

  it("yields LSET command", async () => {
    const prog = app(($) => $.redis.lset("mylist", 0, "newval"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LSET");
    expect(captured[0].args).toEqual(["mylist", 0, "newval"]);
  });

  it("yields LREM command", async () => {
    const prog = app(($) => $.redis.lrem("mylist", 2, "val"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LREM");
    expect(captured[0].args).toEqual(["mylist", 2, "val"]);
  });

  it("yields LINSERT command", async () => {
    const prog = app(($) => $.redis.linsert("mylist", "BEFORE", "pivot", "elem"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LINSERT");
    expect(captured[0].args).toEqual(["mylist", "BEFORE", "pivot", "elem"]);
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("redis interpreter: input resolution", () => {
  it("resolves input key for get", async () => {
    const prog = app({ key: "string" }, ($) => $.redis.get($.input.key));
    const { captured } = await run(prog, { key: "dynamic_key" });
    expect(captured[0].command).toBe("GET");
    expect(captured[0].args).toEqual(["dynamic_key"]);
  });

  it("resolves input params for set", async () => {
    const prog = app({ key: "string", value: "string" }, ($) =>
      $.redis.set($.input.key, $.input.value),
    );
    const { captured } = await run(prog, { key: "dk", value: "dv" });
    expect(captured[0].command).toBe("SET");
    expect(captured[0].args).toEqual(["dk", "dv"]);
  });
});

// ============================================================
// Return value
// ============================================================

describe("redis interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.redis.get("mykey"));
    const { result } = await run(prog);
    expect(result).toBe("mock_result");
  });
});
