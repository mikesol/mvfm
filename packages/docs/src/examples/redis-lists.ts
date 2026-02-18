import type { NodeExample } from "./types";

const REDIS = ["@mvfm/plugin-redis"];

const examples: Record<string, NodeExample> = {
  "redis/lpush": {
    description: "Push one or more elements to the head of a list",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.lpush("tasks", "first", "second"),
    $.redis.lrange("tasks", 0, -1)
  );
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/rpush": {
    description: "Push one or more elements to the tail of a list",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.rpush("tasks", "first", "second"),
    $.redis.lrange("tasks", 0, -1)
  );
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/lpop": {
    description: "Remove and return the first element of a list",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.rpush("tasks", "a", "b", "c"),
    $.redis.lpop("tasks")
  );
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/rpop": {
    description: "Remove and return the last element of a list",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.rpush("tasks", "a", "b", "c"),
    $.redis.rpop("tasks")
  );
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/llen": {
    description: "Get the length of a list",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.rpush("tasks", "a", "b", "c"),
    $.redis.llen("tasks")
  );
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/lrange": {
    description: "Get a range of elements from a list (stop is inclusive)",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.rpush("tasks", "a", "b", "c", "d"),
    $.redis.lrange("tasks", 1, 2)
  );
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/lindex": {
    description: "Get an element by its index (negative counts from the end)",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.rpush("tasks", "a", "b", "c"),
    $.redis.lindex("tasks", -1)
  );
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/lset": {
    description: "Set the value of an element at a given index",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.rpush("tasks", "a", "b", "c"),
    $.redis.lset("tasks", 1, "B"),
    $.redis.lrange("tasks", 0, -1)
  );
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/lrem": {
    description:
      "Remove elements by value (count=0 all, >0 from head, <0 from tail)",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.rpush("tasks", "a", "b", "a", "c", "a"),
    $.redis.lrem("tasks", 2, "a"),
    $.redis.lrange("tasks", 0, -1)
  );
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },

  "redis/linsert": {
    description: "Insert an element before or after a pivot element",
    code: `const app = mvfm(prelude, redis);
const prog = app({}, ($) => {
  return $.begin(
    $.redis.rpush("tasks", "a", "b", "c"),
    $.redis.linsert("tasks", "BEFORE", "b", "x"),
    $.redis.lrange("tasks", 0, -1)
  );
});
await foldAST(
  defaults(app, { redis: memoryRedisInterpreter }),
  prog
);`,
    plugins: REDIS,
    redis: true,
  },
};

export default examples;
