import type { NodeExample } from "./types";

const CF_KV = ["@mvfm/plugin-cloudflare-kv"];

const examples: Record<string, NodeExample> = {
  "cloudflare-kv/get": {
    description: "Get a text value by key, returning null if missing",
    code: `const app = mvfm(prelude, cloudflareKv({ namespaceId: "MY_KV" }));
const prog = app({}, ($) => {
  return $.begin(
    $.kv.put("greeting", "hello"),
    $.kv.get("greeting")
  );
});
await foldAST(
  defaults(app, { "cloudflare-kv": memoryCloudflareKvInterpreter }),
  prog
);`,
    plugins: CF_KV,
    cloudflareKv: true,
  },

  "cloudflare-kv/get_json": {
    description: "Get a JSON-parsed value by key, returning null if missing",
    code: `const app = mvfm(prelude, cloudflareKv({ namespaceId: "MY_KV" }));
const prog = app({}, ($) => {
  return $.begin(
    $.kv.put("user", JSON.stringify({ name: "Alice", age: 30 })),
    $.kv.get("user", "json")
  );
});
await foldAST(
  defaults(app, { "cloudflare-kv": memoryCloudflareKvInterpreter }),
  prog
);`,
    plugins: CF_KV,
    cloudflareKv: true,
  },

  "cloudflare-kv/put": {
    description: "Store a string value at a key with optional expiration",
    code: `const app = mvfm(prelude, cloudflareKv({ namespaceId: "MY_KV" }));
const prog = app({}, ($) => {
  return $.begin(
    $.kv.put("session", "abc123", { expirationTtl: 3600 }),
    $.kv.get("session")
  );
});
await foldAST(
  defaults(app, { "cloudflare-kv": memoryCloudflareKvInterpreter }),
  prog
);`,
    plugins: CF_KV,
    cloudflareKv: true,
  },

  "cloudflare-kv/delete": {
    description: "Remove a key from the KV namespace",
    code: `const app = mvfm(prelude, cloudflareKv({ namespaceId: "MY_KV" }));
const prog = app({}, ($) => {
  return $.begin(
    $.kv.put("temp", "data"),
    $.kv.delete("temp"),
    $.kv.get("temp")
  );
});
await foldAST(
  defaults(app, { "cloudflare-kv": memoryCloudflareKvInterpreter }),
  prog
);`,
    plugins: CF_KV,
    cloudflareKv: true,
  },

  "cloudflare-kv/list": {
    description: "List keys with optional prefix filter and pagination",
    code: `const app = mvfm(prelude, cloudflareKv({ namespaceId: "MY_KV" }));
const prog = app({}, ($) => {
  return $.begin(
    $.kv.put("user:1", "Alice"),
    $.kv.put("user:2", "Bob"),
    $.kv.put("config:theme", "dark"),
    $.kv.list({ prefix: "user:" })
  );
});
await foldAST(
  defaults(app, { "cloudflare-kv": memoryCloudflareKvInterpreter }),
  prog
);`,
    plugins: CF_KV,
    cloudflareKv: true,
  },
};

export default examples;
