import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { redis } from "../../../../src/plugins/redis/5.4.1";
import { str } from "../../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, redis({ host: "127.0.0.1", port: 6379 }));

// ============================================================
// String commands
// ============================================================

describe("redis: get", () => {
  it("produces redis/get node with literal key", () => {
    const prog = app(($) => $.redis.get("mykey"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/get");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("mykey");
  });

  it("accepts Expr<string> key", () => {
    const prog = app(($) => $.redis.get($.input.key));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/get");
    expect(ast.result.key.kind).toBe("core/prop_access");
  });
});

describe("redis: set", () => {
  it("produces redis/set node with key and value", () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/set");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("mykey");
    expect(ast.result.value.kind).toBe("core/literal");
    expect(ast.result.value.value).toBe("myvalue");
    expect(ast.result.args).toHaveLength(0);
  });

  it("produces redis/set node with EX and NX positional tokens", () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "EX", 60, "NX"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/set");
    expect(ast.result.args).toHaveLength(3);
    expect(ast.result.args[0].value).toBe("EX");
    expect(ast.result.args[1].value).toBe(60);
    expect(ast.result.args[2].value).toBe("NX");
  });

  it("produces redis/set node with PX token", () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "PX", 5000));
    const ast = strip(prog.ast) as any;
    expect(ast.result.args).toHaveLength(2);
    expect(ast.result.args[0].value).toBe("PX");
    expect(ast.result.args[1].value).toBe(5000);
  });

  it("accepts Expr params", () => {
    const prog = app(($) => $.redis.set($.input.key, $.input.value));
    const ast = strip(prog.ast) as any;
    expect(ast.result.key.kind).toBe("core/prop_access");
    expect(ast.result.value.kind).toBe("core/prop_access");
  });
});

describe("redis: del", () => {
  it("produces redis/del node with single key", () => {
    const prog = app(($) => $.redis.del("mykey"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/del");
    expect(ast.result.keys).toHaveLength(1);
    expect(ast.result.keys[0].kind).toBe("core/literal");
    expect(ast.result.keys[0].value).toBe("mykey");
  });

  it("produces redis/del node with multiple keys", () => {
    const prog = app(($) => $.redis.del("key1", "key2", "key3"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/del");
    expect(ast.result.keys).toHaveLength(3);
  });
});

describe("redis: exists", () => {
  it("produces redis/exists node", () => {
    const prog = app(($) => $.redis.exists("mykey"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/exists");
    expect(ast.result.keys).toHaveLength(1);
    expect(ast.result.keys[0].value).toBe("mykey");
  });
});

describe("redis: incr", () => {
  it("produces redis/incr node", () => {
    const prog = app(($) => $.redis.incr("counter"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/incr");
    expect(ast.result.key.value).toBe("counter");
  });
});

describe("redis: incrby", () => {
  it("produces redis/incrby node", () => {
    const prog = app(($) => $.redis.incrby("counter", 5));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/incrby");
    expect(ast.result.key.value).toBe("counter");
    expect(ast.result.increment.value).toBe(5);
  });
});

describe("redis: decr", () => {
  it("produces redis/decr node", () => {
    const prog = app(($) => $.redis.decr("counter"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/decr");
    expect(ast.result.key.value).toBe("counter");
  });
});

describe("redis: decrby", () => {
  it("produces redis/decrby node", () => {
    const prog = app(($) => $.redis.decrby("counter", 3));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/decrby");
    expect(ast.result.key.value).toBe("counter");
    expect(ast.result.decrement.value).toBe(3);
  });
});

describe("redis: mget", () => {
  it("produces redis/mget node", () => {
    const prog = app(($) => $.redis.mget("key1", "key2"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/mget");
    expect(ast.result.keys).toHaveLength(2);
  });
});

describe("redis: mset", () => {
  it("produces redis/mset node", () => {
    const prog = app(($) => $.redis.mset({ key1: "val1", key2: "val2" }));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/mset");
    expect(ast.result.mapping.kind).toBe("core/record");
  });
});

describe("redis: append", () => {
  it("produces redis/append node", () => {
    const prog = app(($) => $.redis.append("mykey", "extra"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/append");
    expect(ast.result.key.value).toBe("mykey");
    expect(ast.result.value.value).toBe("extra");
  });
});

describe("redis: getrange", () => {
  it("produces redis/getrange node", () => {
    const prog = app(($) => $.redis.getrange("mykey", 0, 5));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/getrange");
    expect(ast.result.start.value).toBe(0);
    expect(ast.result.end.value).toBe(5);
  });
});

describe("redis: setrange", () => {
  it("produces redis/setrange node", () => {
    const prog = app(($) => $.redis.setrange("mykey", 3, "abc"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/setrange");
    expect(ast.result.offset.value).toBe(3);
    expect(ast.result.value.value).toBe("abc");
  });
});

// ============================================================
// Key commands
// ============================================================

describe("redis: expire", () => {
  it("produces redis/expire node", () => {
    const prog = app(($) => $.redis.expire("mykey", 300));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/expire");
    expect(ast.result.key.value).toBe("mykey");
    expect(ast.result.seconds.value).toBe(300);
  });
});

describe("redis: pexpire", () => {
  it("produces redis/pexpire node", () => {
    const prog = app(($) => $.redis.pexpire("mykey", 5000));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/pexpire");
    expect(ast.result.milliseconds.value).toBe(5000);
  });
});

describe("redis: ttl", () => {
  it("produces redis/ttl node", () => {
    const prog = app(($) => $.redis.ttl("mykey"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/ttl");
    expect(ast.result.key.value).toBe("mykey");
  });
});

describe("redis: pttl", () => {
  it("produces redis/pttl node", () => {
    const prog = app(($) => $.redis.pttl("mykey"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/pttl");
    expect(ast.result.key.value).toBe("mykey");
  });
});

// ============================================================
// Hash commands
// ============================================================

describe("redis: hget", () => {
  it("produces redis/hget node", () => {
    const prog = app(($) => $.redis.hget("myhash", "field1"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hget");
    expect(ast.result.key.value).toBe("myhash");
    expect(ast.result.field.value).toBe("field1");
  });
});

describe("redis: hset", () => {
  it("produces redis/hset node", () => {
    const prog = app(($) => $.redis.hset("myhash", { field1: "val1", field2: "val2" }));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hset");
    expect(ast.result.key.value).toBe("myhash");
    expect(ast.result.mapping.kind).toBe("core/record");
  });
});

describe("redis: hmget", () => {
  it("produces redis/hmget node", () => {
    const prog = app(($) => $.redis.hmget("myhash", "f1", "f2"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hmget");
    expect(ast.result.key.value).toBe("myhash");
    expect(ast.result.fields).toHaveLength(2);
  });
});

describe("redis: hgetall", () => {
  it("produces redis/hgetall node", () => {
    const prog = app(($) => $.redis.hgetall("myhash"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hgetall");
    expect(ast.result.key.value).toBe("myhash");
  });
});

describe("redis: hdel", () => {
  it("produces redis/hdel node", () => {
    const prog = app(($) => $.redis.hdel("myhash", "f1", "f2"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hdel");
    expect(ast.result.fields).toHaveLength(2);
  });
});

describe("redis: hexists", () => {
  it("produces redis/hexists node", () => {
    const prog = app(($) => $.redis.hexists("myhash", "field1"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hexists");
    expect(ast.result.field.value).toBe("field1");
  });
});

describe("redis: hlen", () => {
  it("produces redis/hlen node", () => {
    const prog = app(($) => $.redis.hlen("myhash"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hlen");
  });
});

describe("redis: hkeys", () => {
  it("produces redis/hkeys node", () => {
    const prog = app(($) => $.redis.hkeys("myhash"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hkeys");
  });
});

describe("redis: hvals", () => {
  it("produces redis/hvals node", () => {
    const prog = app(($) => $.redis.hvals("myhash"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hvals");
  });
});

describe("redis: hincrby", () => {
  it("produces redis/hincrby node", () => {
    const prog = app(($) => $.redis.hincrby("myhash", "counter", 10));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hincrby");
    expect(ast.result.increment.value).toBe(10);
  });
});

// ============================================================
// List commands
// ============================================================

describe("redis: lpush", () => {
  it("produces redis/lpush node with multiple elements", () => {
    const prog = app(($) => $.redis.lpush("mylist", "a", "b"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lpush");
    expect(ast.result.key.value).toBe("mylist");
    expect(ast.result.elements).toHaveLength(2);
  });
});

describe("redis: rpush", () => {
  it("produces redis/rpush node", () => {
    const prog = app(($) => $.redis.rpush("mylist", "c"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/rpush");
    expect(ast.result.elements).toHaveLength(1);
  });
});

describe("redis: lpop", () => {
  it("produces redis/lpop node without count", () => {
    const prog = app(($) => $.redis.lpop("mylist"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lpop");
    expect(ast.result.count).toBeNull();
  });

  it("produces redis/lpop node with count", () => {
    const prog = app(($) => $.redis.lpop("mylist", 3));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lpop");
    expect(ast.result.count.value).toBe(3);
  });
});

describe("redis: rpop", () => {
  it("produces redis/rpop node", () => {
    const prog = app(($) => $.redis.rpop("mylist"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/rpop");
    expect(ast.result.count).toBeNull();
  });
});

describe("redis: llen", () => {
  it("produces redis/llen node", () => {
    const prog = app(($) => $.redis.llen("mylist"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/llen");
  });
});

describe("redis: lrange", () => {
  it("produces redis/lrange node", () => {
    const prog = app(($) => $.redis.lrange("mylist", 0, -1));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lrange");
    expect(ast.result.start.value).toBe(0);
    expect(ast.result.stop.value).toBe(-1);
  });
});

describe("redis: lindex", () => {
  it("produces redis/lindex node", () => {
    const prog = app(($) => $.redis.lindex("mylist", 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lindex");
    expect(ast.result.index.value).toBe(2);
  });
});

describe("redis: lset", () => {
  it("produces redis/lset node", () => {
    const prog = app(($) => $.redis.lset("mylist", 0, "newval"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lset");
    expect(ast.result.index.value).toBe(0);
    expect(ast.result.element.value).toBe("newval");
  });
});

describe("redis: lrem", () => {
  it("produces redis/lrem node", () => {
    const prog = app(($) => $.redis.lrem("mylist", 2, "val"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lrem");
    expect(ast.result.count.value).toBe(2);
    expect(ast.result.element.value).toBe("val");
  });
});

describe("redis: linsert", () => {
  it("produces redis/linsert node with BEFORE", () => {
    const prog = app(($) => $.redis.linsert("mylist", "BEFORE", "pivot", "elem"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/linsert");
    expect(ast.result.position).toBe("BEFORE");
    expect(ast.result.pivot.value).toBe("pivot");
    expect(ast.result.element.value).toBe("elem");
  });
});

// ============================================================
// Integration
// ============================================================

describe("redis: cross-operation dependencies", () => {
  it("can use result of get as input to set", () => {
    const prog = app(($) => {
      const val = $.redis.get("source");
      const result = $.redis.set("dest", val);
      return $.do(val, result);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
  });
});

describe("redis: string URL config", () => {
  it("accepts string config", () => {
    const urlApp = mvfm(num, str, redis("redis://localhost:6379/0"));
    const prog = urlApp(($) => $.redis.get("test"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/get");
  });
});
