import type { Expr } from "@mvfm/core";
import { mvfm, num, str } from "@mvfm/core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { redis } from "../../src/5.4.1";
import { app, strip } from "./ast.shared";

describe("redis: typing", () => {
  it("preserves command return types", () => {
    app(($) => {
      const get = $.redis.get("key");
      expectTypeOf(get).toEqualTypeOf<Expr<string | null>>();
      return get;
    });

    app(($) => {
      const set = $.redis.set("key", "value", "EX", 60);
      expectTypeOf(set).toEqualTypeOf<Expr<string | null>>();
      return set;
    });

    app(($) => {
      const hget = $.redis.hget("hash", "field");
      expectTypeOf(hget).toEqualTypeOf<Expr<string | null>>();
      return hget;
    });

    app(($) => {
      const lrange = $.redis.lrange("list", 0, 10);
      expectTypeOf(lrange).toEqualTypeOf<Expr<string[]>>();
      return lrange;
    });
  });

  it("rejects invalid command argument shapes", () => {
    app(($) => {
      // @ts-expect-error increment must be number | Expr<number>
      return $.redis.incrby("counter", "five");
    });
    app(($) => {
      // @ts-expect-error position must be BEFORE | AFTER
      return $.redis.linsert("list", "MIDDLE", "pivot", "value");
    });
    app(($) => {
      // @ts-expect-error mapping must be Record<string, string | number>
      return $.redis.mset("not-a-mapping");
    });
  });
});

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

describe("redis: string command nodes", () => {
  it("produces nodes for del/exists/incr/incrby/decr/decrby/mget/mset", () => {
    const astDel = strip(app(($) => $.redis.del("mykey")).ast) as any;
    expect(astDel.result.kind).toBe("redis/del");

    const astExists = strip(app(($) => $.redis.exists("mykey")).ast) as any;
    expect(astExists.result.kind).toBe("redis/exists");

    const astIncr = strip(app(($) => $.redis.incr("counter")).ast) as any;
    expect(astIncr.result.kind).toBe("redis/incr");

    const astIncrby = strip(app(($) => $.redis.incrby("counter", 5)).ast) as any;
    expect(astIncrby.result.kind).toBe("redis/incrby");

    const astDecr = strip(app(($) => $.redis.decr("counter")).ast) as any;
    expect(astDecr.result.kind).toBe("redis/decr");

    const astDecrby = strip(app(($) => $.redis.decrby("counter", 3)).ast) as any;
    expect(astDecrby.result.kind).toBe("redis/decrby");

    const astMget = strip(app(($) => $.redis.mget("key1", "key2")).ast) as any;
    expect(astMget.result.kind).toBe("redis/mget");

    const astMset = strip(app(($) => $.redis.mset({ key1: "val1", key2: "val2" })).ast) as any;
    expect(astMset.result.kind).toBe("redis/mset");
  });

  it("produces nodes for append/getrange/setrange", () => {
    const astAppend = strip(app(($) => $.redis.append("mykey", "extra")).ast) as any;
    expect(astAppend.result.kind).toBe("redis/append");

    const astGetRange = strip(app(($) => $.redis.getrange("mykey", 0, 5)).ast) as any;
    expect(astGetRange.result.kind).toBe("redis/getrange");

    const astSetRange = strip(app(($) => $.redis.setrange("mykey", 3, "abc")).ast) as any;
    expect(astSetRange.result.kind).toBe("redis/setrange");
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
