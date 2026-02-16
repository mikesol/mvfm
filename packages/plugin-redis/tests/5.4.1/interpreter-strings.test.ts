import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { app, run } from "./interpreter.shared";

describe("redis interpreter: typing hygiene", () => {
  it("contains no untyped node:any handler parameters", () => {
    const source = readFileSync(join(process.cwd(), "src/5.4.1/interpreter.ts"), "utf8");
    expect(source).not.toMatch(/node:\s*any/);
  });

  it("contains no broad kind:string node interface fields", () => {
    const source = readFileSync(join(process.cwd(), "src/5.4.1/interpreter.ts"), "utf8");
    expect(source).not.toMatch(/kind:\s*string/);
  });
});

describe("redis interpreter: string commands", () => {
  it("yields GET command", async () => {
    const { captured } = await run(app(($) => $.redis.get("mykey")));
    expect(captured[0]).toEqual({ command: "GET", args: ["mykey"] });
  });

  it("yields SET command variants", async () => {
    expect((await run(app(($) => $.redis.set("mykey", "myvalue")))).captured[0].args).toEqual([
      "mykey",
      "myvalue",
    ]);
    expect(
      (await run(app(($) => $.redis.set("mykey", "myvalue", "EX", 60, "NX")))).captured[0].args,
    ).toEqual(["mykey", "myvalue", "EX", 60, "NX"]);
    expect(
      (await run(app(($) => $.redis.set("mykey", "myvalue", "PX", 5000)))).captured[0].args,
    ).toEqual(["mykey", "myvalue", "PX", 5000]);
  });

  it("yields INCR/INCRBY/DECR/DECRBY", async () => {
    expect((await run(app(($) => $.redis.incr("counter")))).captured[0].command).toBe("INCR");
    expect((await run(app(($) => $.redis.incrby("counter", 5)))).captured[0].args).toEqual([
      "counter",
      5,
    ]);
    expect((await run(app(($) => $.redis.decr("counter")))).captured[0].command).toBe("DECR");
    expect((await run(app(($) => $.redis.decrby("counter", 3)))).captured[0].args).toEqual([
      "counter",
      3,
    ]);
  });

  it("yields MGET/MSET/APPEND/GETRANGE/SETRANGE", async () => {
    expect((await run(app(($) => $.redis.mget("k1", "k2")))).captured[0].command).toBe("MGET");
    expect((await run(app(($) => $.redis.mset({ k1: "v1", k2: "v2" })))).captured[0].args).toEqual([
      "k1",
      "v1",
      "k2",
      "v2",
    ]);
    expect((await run(app(($) => $.redis.append("mykey", "extra")))).captured[0].command).toBe(
      "APPEND",
    );
    expect((await run(app(($) => $.redis.getrange("mykey", 0, 5)))).captured[0].command).toBe(
      "GETRANGE",
    );
    expect((await run(app(($) => $.redis.setrange("mykey", 3, "abc")))).captured[0].command).toBe(
      "SETRANGE",
    );
  });
});
