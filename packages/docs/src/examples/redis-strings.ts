import type { NodeExample } from "./types";

const REDIS = ["@mvfm/plugin-redis"];

const examples: Record<string, NodeExample> = {
  "redis/set": {
    description: "Set a string value by key",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.redis.set("greeting", "hello");
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/get": {
    description: "Get a string value by key, returning null if missing",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("greeting", "hello"),
    $.redis.get("greeting")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/incr": {
    description: "Atomically increment a numeric string by one",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("counter", "10"),
    $.redis.incr("counter")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/incrby": {
    description: "Increment a numeric string by a specific amount",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("counter", "10"),
    $.redis.incrby("counter", 5)
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/decr": {
    description: "Atomically decrement a numeric string by one",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("counter", "10"),
    $.redis.decr("counter")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/decrby": {
    description: "Decrement a numeric string by a specific amount",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("counter", "10"),
    $.redis.decrby("counter", 3)
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/mget": {
    description: "Get the values of multiple keys in one call",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("a", "1"),
    $.redis.set("b", "2"),
    $.redis.mget("a", "b", "missing")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/mset": {
    description: "Set multiple key-value pairs in one atomic call",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.mset({ x: "10", y: "20", z: "30" }),
    $.redis.mget("x", "y", "z")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/append": {
    description: "Append a string to an existing value",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("msg", "hello"),
    $.redis.append("msg", " world"),
    $.redis.get("msg")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/getrange": {
    description: "Get a substring of a stored value by byte offsets",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("msg", "hello world"),
    $.redis.getrange("msg", 0, 4)
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/setrange": {
    description: "Overwrite part of a string starting at an offset",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("msg", "hello world"),
    $.redis.setrange("msg", 6, "redis"),
    $.redis.get("msg")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },
};

export default examples;
