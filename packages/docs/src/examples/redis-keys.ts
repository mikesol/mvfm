import type { NodeExample } from "./types";

const REDIS = ["@mvfm/plugin-redis"];

const examples: Record<string, NodeExample> = {
  "redis/del": {
    description: "Delete one or more keys and return the count removed",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("a", "1"),
    $.redis.set("b", "2"),
    $.redis.del("a", "b")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/exists": {
    description: "Check how many of the given keys exist",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("a", "1"),
    $.redis.set("b", "2"),
    $.redis.exists("a", "b", "missing")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/expire": {
    description: "Set a time-to-live in seconds on a key",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("temp", "data"),
    $.redis.expire("temp", 60)
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/pexpire": {
    description: "Set a time-to-live in milliseconds on a key",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("temp", "data"),
    $.redis.pexpire("temp", 30000)
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/ttl": {
    description: "Get the remaining time-to-live of a key in seconds",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("temp", "data"),
    $.redis.expire("temp", 120),
    $.redis.ttl("temp")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/pttl": {
    description: "Get the remaining time-to-live of a key in milliseconds",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.set("temp", "data"),
    $.redis.pexpire("temp", 60000),
    $.redis.pttl("temp")
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
