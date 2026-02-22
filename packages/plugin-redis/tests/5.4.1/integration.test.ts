import { createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import Redis from "ioredis";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { redis as redisPlugin } from "../../src/5.4.1";
import { wrapIoredis } from "../../src/5.4.1/client-ioredis";
import { createRedisInterpreter } from "../../src/5.4.1/interpreter";

let container: StartedTestContainer | undefined;
let redisClient: Redis | undefined;

const plugin = redisPlugin({ host: "127.0.0.1", port: 6379 });
const plugins = [numPluginU, strPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  if (!redisClient) {
    throw new Error("Redis test client is not initialized");
  }
  const client = wrapIoredis(redisClient);
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, { redis: createRedisInterpreter(client) });
  return await fold(nexpr, interp);
}

beforeAll(async () => {
  container = await new GenericContainer("redis:7-alpine").withExposedPorts(6379).start();
  redisClient = new Redis({
    host: container.getHost(),
    port: container.getMappedPort(6379),
  });
}, 60000);

beforeEach(async () => {
  await redisClient?.flushall();
});

afterAll(async () => {
  await redisClient?.quit();
  if (container) {
    await container.stop();
  }
});

describe("redis integration: string commands", () => {
  it("executes all exposed string methods", async () => {
    expect(await run($.redis.set("name", "murray"))).toBe("OK");
    expect(await run($.redis.get("name"))).toBe("murray");

    expect(await run($.redis.incr("counter"))).toBe(1);
    expect(await run($.redis.incrby("counter", 5))).toBe(6);
    expect(await run($.redis.decr("counter"))).toBe(5);
    expect(await run($.redis.decrby("counter", 2))).toBe(3);

    expect(await run($.redis.mset({ k1: "v1", k2: "v2" }))).toBe("OK");
    expect(await run($.redis.mget("k1", "k2"))).toEqual(["v1", "v2"]);

    expect(await run($.redis.append("name", "-v2"))).toBe(9);
    expect(await run($.redis.get("name"))).toBe("murray-v2");
    expect(await run($.redis.getrange("name", 0, 5))).toBe("murray");
    expect(await run($.redis.setrange("name", 0, "M"))).toBe(9);
    expect(await run($.redis.get("name"))).toBe("Murray-v2");
  });
});

describe("redis integration: key commands", () => {
  it("executes all exposed key methods", async () => {
    expect(await run($.redis.set("exp-key", "value"))).toBe("OK");
    expect(await run($.redis.exists("exp-key", "missing"))).toBe(1);
    expect(await run($.redis.expire("exp-key", 120))).toBe(1);
    const ttl = await run($.redis.ttl("exp-key"));
    expect(typeof ttl).toBe("number");
    expect(ttl as number).toBeGreaterThan(0);

    expect(await run($.redis.set("pexp-key", "value"))).toBe("OK");
    expect(await run($.redis.pexpire("pexp-key", 5000))).toBe(1);
    const pttl = await run($.redis.pttl("pexp-key"));
    expect(typeof pttl).toBe("number");
    expect(pttl as number).toBeGreaterThan(0);

    expect(await run($.redis.del("exp-key", "pexp-key"))).toBe(2);
    expect(await run($.redis.exists("exp-key", "pexp-key"))).toBe(0);
  });
});

describe("redis integration: hash commands", () => {
  it("executes all exposed hash methods", async () => {
    expect(await run($.redis.hset("h", { f1: "v1", count: 2 }))).toBe(2);
    expect(await run($.redis.hget("h", "f1"))).toBe("v1");
    expect(await run($.redis.hmget("h", "f1", "missing"))).toEqual(["v1", null]);
    expect(await run($.redis.hgetall("h"))).toEqual(["f1", "v1", "count", "2"]);
    expect(await run($.redis.hexists("h", "f1"))).toBe(1);
    expect(await run($.redis.hlen("h"))).toBe(2);
    expect(await run($.redis.hkeys("h"))).toEqual(["f1", "count"]);
    expect(await run($.redis.hvals("h"))).toEqual(["v1", "2"]);
    expect(await run($.redis.hincrby("h", "count", 3))).toBe(5);
    expect(await run($.redis.hdel("h", "f1"))).toBe(1);
    expect(await run($.redis.hexists("h", "f1"))).toBe(0);
  });
});

describe("redis integration: list commands", () => {
  it("executes all exposed list methods", async () => {
    expect(await run($.redis.lpush("l", "b", "a"))).toBe(2);
    expect(await run($.redis.rpush("l", "c", "d"))).toBe(4);
    expect(await run($.redis.llen("l"))).toBe(4);
    expect(await run($.redis.lrange("l", 0, -1))).toEqual(["a", "b", "c", "d"]);
    expect(await run($.redis.lindex("l", 1))).toBe("b");
    expect(await run($.redis.lset("l", 1, "B"))).toBe("OK");
    expect(await run($.redis.linsert("l", "BEFORE", "c", "X"))).toBe(5);
    expect(await run($.redis.lrange("l", 0, -1))).toEqual(["a", "B", "X", "c", "d"]);
    expect(await run($.redis.lrem("l", 1, "X"))).toBe(1);
    expect(await run($.redis.lpop("l"))).toBe("a");
    expect(await run($.redis.rpop("l"))).toBe("d");

    await run($.redis.rpush("l", "tail-1", "tail-2"));
    expect(await run($.redis.lpop("l", 2))).toEqual(["B", "c"]);
    expect(await run($.redis.rpop("l", 2))).toEqual(["tail-2", "tail-1"]);
  });
});
