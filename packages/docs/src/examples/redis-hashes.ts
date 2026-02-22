import type { NodeExample } from "./types";

const REDIS = ["@mvfm/plugin-redis"];

const examples: Record<string, NodeExample> = {
  "redis/hset": {
    description: "Set fields in a hash and return the count of new fields added",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.redis.hset("user:1", { name: "Alice", email: "alice@example.com" });
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/hget": {
    description: "Get a single field from a hash",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.hset("user:1", { name: "Alice", email: "alice@example.com" }),
    $.redis.hget("user:1", "name")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/hmget": {
    description: "Get multiple fields from a hash in one call",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.hset("user:1", { name: "Alice", email: "alice@example.com" }),
    $.redis.hmget("user:1", "name", "email", "missing")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/hgetall": {
    description: "Get all fields and values from a hash as a flat key/value array",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.hset("user:1", { name: "Alice", email: "alice@example.com" }),
    $.redis.hgetall("user:1")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/hdel": {
    description: "Delete one or more fields from a hash",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.hset("user:1", { name: "Alice", email: "alice@example.com" }),
    $.redis.hdel("user:1", "email")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/hexists": {
    description: "Check if a field exists in a hash (returns 0 or 1)",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.hset("user:1", { name: "Alice" }),
    $.redis.hexists("user:1", "name")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/hlen": {
    description: "Get the number of fields in a hash",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.hset("user:1", { name: "Alice", email: "alice@example.com" }),
    $.redis.hlen("user:1")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/hkeys": {
    description: "Get all field names from a hash",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.hset("user:1", { name: "Alice", email: "alice@example.com" }),
    $.redis.hkeys("user:1")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/hvals": {
    description: "Get all values from a hash",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.hset("user:1", { name: "Alice", email: "alice@example.com" }),
    $.redis.hvals("user:1")
  );
});
await fold(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/hincrby": {
    description: "Increment a numeric hash field by a given amount",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.hset("user:1", { age: "30" }),
    $.redis.hincrby("user:1", "age", 5)
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
