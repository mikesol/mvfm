import type { Program } from "@mvfm/core";
import {
  coreInterpreter,
  injectInput,
  mvfm,
  num,
  numInterpreter,
  str,
  strInterpreter,
} from "@mvfm/core";
import Redis from "ioredis";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { redis as redisPlugin } from "../../src/5.4.1";
import { wrapIoredis } from "../../src/5.4.1/client-ioredis";
import { serverEvaluate } from "../../src/5.4.1/handler.server";

let container: StartedTestContainer | undefined;
let redisClient: Redis | undefined;

const app = mvfm(num, str, redisPlugin({ host: "127.0.0.1", port: 6379 }));

async function run(prog: Program, input: Record<string, unknown> = {}) {
  if (!redisClient) {
    throw new Error("Redis test client is not initialized");
  }
  const injected = injectInput(prog, input);
  const client = wrapIoredis(redisClient);
  const baseInterpreter = {
    ...coreInterpreter,
    ...numInterpreter,
    ...strInterpreter,
  };
  const evaluate = serverEvaluate(client, baseInterpreter);
  return await evaluate(injected.ast.result);
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
    expect(await run(app(($) => $.redis.set("name", "murray")))).toBe("OK");
    expect(await run(app(($) => $.redis.get("name")))).toBe("murray");

    expect(await run(app(($) => $.redis.incr("counter")))).toBe(1);
    expect(await run(app(($) => $.redis.incrby("counter", 5)))).toBe(6);
    expect(await run(app(($) => $.redis.decr("counter")))).toBe(5);
    expect(await run(app(($) => $.redis.decrby("counter", 2)))).toBe(3);

    expect(await run(app(($) => $.redis.mset({ k1: "v1", k2: "v2" })))).toBe("OK");
    expect(await run(app(($) => $.redis.mget("k1", "k2")))).toEqual(["v1", "v2"]);

    expect(await run(app(($) => $.redis.append("name", "-v2")))).toBe(9);
    expect(await run(app(($) => $.redis.get("name")))).toBe("murray-v2");
    expect(await run(app(($) => $.redis.getrange("name", 0, 5)))).toBe("murray");
    expect(await run(app(($) => $.redis.setrange("name", 0, "M")))).toBe(9);
    expect(await run(app(($) => $.redis.get("name")))).toBe("Murray-v2");
  });
});

describe("redis integration: key commands", () => {
  it("executes all exposed key methods", async () => {
    expect(await run(app(($) => $.redis.set("exp-key", "value")))).toBe("OK");
    expect(await run(app(($) => $.redis.exists("exp-key", "missing")))).toBe(1);
    expect(await run(app(($) => $.redis.expire("exp-key", 120)))).toBe(1);
    const ttl = await run(app(($) => $.redis.ttl("exp-key")));
    expect(typeof ttl).toBe("number");
    expect(ttl as number).toBeGreaterThan(0);

    expect(await run(app(($) => $.redis.set("pexp-key", "value")))).toBe("OK");
    expect(await run(app(($) => $.redis.pexpire("pexp-key", 5000)))).toBe(1);
    const pttl = await run(app(($) => $.redis.pttl("pexp-key")));
    expect(typeof pttl).toBe("number");
    expect(pttl as number).toBeGreaterThan(0);

    expect(await run(app(($) => $.redis.del("exp-key", "pexp-key")))).toBe(2);
    expect(await run(app(($) => $.redis.exists("exp-key", "pexp-key")))).toBe(0);
  });
});

describe("redis integration: hash commands", () => {
  it("executes all exposed hash methods", async () => {
    expect(await run(app(($) => $.redis.hset("h", { f1: "v1", count: 2 })))).toBe(2);
    expect(await run(app(($) => $.redis.hget("h", "f1")))).toBe("v1");
    expect(await run(app(($) => $.redis.hmget("h", "f1", "missing")))).toEqual(["v1", null]);
    expect(await run(app(($) => $.redis.hgetall("h")))).toEqual(["f1", "v1", "count", "2"]);
    expect(await run(app(($) => $.redis.hexists("h", "f1")))).toBe(1);
    expect(await run(app(($) => $.redis.hlen("h")))).toBe(2);
    expect(await run(app(($) => $.redis.hkeys("h")))).toEqual(["f1", "count"]);
    expect(await run(app(($) => $.redis.hvals("h")))).toEqual(["v1", "2"]);
    expect(await run(app(($) => $.redis.hincrby("h", "count", 3)))).toBe(5);
    expect(await run(app(($) => $.redis.hdel("h", "f1")))).toBe(1);
    expect(await run(app(($) => $.redis.hexists("h", "f1")))).toBe(0);
  });
});

describe("redis integration: list commands", () => {
  it("executes all exposed list methods", async () => {
    expect(await run(app(($) => $.redis.lpush("l", "b", "a")))).toBe(2);
    expect(await run(app(($) => $.redis.rpush("l", "c", "d")))).toBe(4);
    expect(await run(app(($) => $.redis.llen("l")))).toBe(4);
    expect(await run(app(($) => $.redis.lrange("l", 0, -1)))).toEqual(["a", "b", "c", "d"]);
    expect(await run(app(($) => $.redis.lindex("l", 1)))).toBe("b");
    expect(await run(app(($) => $.redis.lset("l", 1, "B")))).toBe("OK");
    expect(await run(app(($) => $.redis.linsert("l", "BEFORE", "c", "X")))).toBe(5);
    expect(await run(app(($) => $.redis.lrange("l", 0, -1)))).toEqual(["a", "B", "X", "c", "d"]);
    expect(await run(app(($) => $.redis.lrem("l", 1, "X")))).toBe(1);
    expect(await run(app(($) => $.redis.lpop("l")))).toBe("a");
    expect(await run(app(($) => $.redis.rpop("l")))).toBe("d");

    await run(app(($) => $.redis.rpush("l", "tail-1", "tail-2")));
    expect(await run(app(($) => $.redis.lpop("l", 2)))).toEqual(["B", "c"]);
    expect(await run(app(($) => $.redis.rpop("l", 2)))).toEqual(["tail-2", "tail-1"]);
  });
});

describe("redis integration: input resolution", () => {
  it("resolves dynamic key and value for redis methods", async () => {
    const setProg = app({ key: "string", value: "string" }, ($) =>
      $.redis.set($.input.key, $.input.value),
    );
    expect(await run(setProg, { key: "dyn", value: "value" })).toBe("OK");

    const getProg = app({ key: "string" }, ($) => $.redis.get($.input.key));
    expect(await run(getProg, { key: "dyn" })).toBe("value");
  });
});
