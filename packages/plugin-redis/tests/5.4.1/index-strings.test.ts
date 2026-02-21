import { describe, expect, it } from "vitest";
import { redis, redisPlugin } from "../../src/5.4.1";

const plugin = redis({ host: "127.0.0.1", port: 6379 });
const api = plugin.ctors.redis;

describe("redis: CExpr construction (strings)", () => {
  it("produces redis/get CExpr", () => {
    const expr = api.get("mykey");
    expect(expr.__kind).toBe("redis/get");
    expect(expr.__args).toHaveLength(1);
  });

  it("produces redis/set CExpr with key and value", () => {
    const expr = api.set("mykey", "myvalue");
    expect(expr.__kind).toBe("redis/set");
    expect(expr.__args).toHaveLength(2);
  });

  it("produces redis/set CExpr with EX and NX positional tokens", () => {
    const expr = api.set("mykey", "myvalue", "EX", 60, "NX");
    expect(expr.__kind).toBe("redis/set");
    expect(expr.__args).toHaveLength(5);
  });

  it("produces CExpr nodes for incr/incrby/decr/decrby", () => {
    expect(api.incr("counter").__kind).toBe("redis/incr");
    expect(api.incrby("counter", 5).__kind).toBe("redis/incrby");
    expect(api.decr("counter").__kind).toBe("redis/decr");
    expect(api.decrby("counter", 3).__kind).toBe("redis/decrby");
  });

  it("produces CExpr nodes for mget/mset/append/getrange/setrange", () => {
    expect(api.mget("k1", "k2").__kind).toBe("redis/mget");
    const msetExpr = api.mset({ k1: "v1", k2: "v2" });
    expect(msetExpr.__kind).toBe("redis/mset");
    expect(msetExpr.__args).toHaveLength(1);
    const recordArg = msetExpr.__args[0] as { __kind: string };
    expect(recordArg.__kind).toBe("redis/record");
    expect(api.append("mykey", "extra").__kind).toBe("redis/append");
    expect(api.getrange("mykey", 0, 5).__kind).toBe("redis/getrange");
    expect(api.setrange("mykey", 3, "abc").__kind).toBe("redis/setrange");
  });
});

describe("redis: string URL config", () => {
  it("accepts string config", () => {
    const urlPlugin = redis("redis://localhost:6379/0");
    expect(urlPlugin.name).toBe("redis");
    const urlApi = urlPlugin.ctors.redis;
    expect(urlApi.get("test").__kind).toBe("redis/get");
  });
});

describe("redis plugin: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("redis");
  });

  it("has 39 node kinds (37 commands + record + array)", () => {
    expect(plugin.nodeKinds).toHaveLength(39);
  });

  it("nodeKinds are all namespaced", () => {
    for (const kind of plugin.nodeKinds) {
      expect(kind).toMatch(/^redis\//);
    }
  });

  it("kinds map has entries for all node kinds", () => {
    for (const kind of plugin.nodeKinds) {
      expect(plugin.kinds[kind]).toBeDefined();
    }
  });

  it("has empty traits and lifts", () => {
    expect(plugin.traits).toEqual({});
    expect(plugin.lifts).toEqual({});
  });

  it("has NO defaultInterpreter", () => {
    expect((plugin as any).defaultInterpreter).toBeUndefined();
  });
});

describe("redis plugin: factory aliases", () => {
  it("redis and redisPlugin are the same function", () => {
    expect(redis).toBe(redisPlugin);
  });
});
