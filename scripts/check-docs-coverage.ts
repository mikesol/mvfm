/**
 * Checks that every non-internal node kind emitted by core + documented
 * plugins has a corresponding example in the docs registry.
 *
 * Design decision: this script only checks plugins that are imported by
 * the docs site (core prelude + plugin-console + st + control + error +
 * fiber). External plugins (postgres, zod, etc.) are NOT checked because
 * they don't have docs examples yet. When examples are added for a new
 * plugin, add its import here to include it in coverage.
 *
 * Exit code 1 if any documented plugin has node kinds without examples.
 */

// Use relative paths to source to avoid pnpm workspace resolution issues
import { boolean } from "../packages/core/src/plugins/boolean/index.js";
import { control } from "../packages/core/src/plugins/control/index.js";
import { eq } from "../packages/core/src/plugins/eq/index.js";
import { error } from "../packages/core/src/plugins/error/index.js";
import { fiber } from "../packages/core/src/plugins/fiber/index.js";
import { num } from "../packages/core/src/plugins/num/index.js";
import { ord } from "../packages/core/src/plugins/ord/index.js";
import { st } from "../packages/core/src/plugins/st/index.js";
import { str } from "../packages/core/src/plugins/str/index.js";
import { consolePlugin } from "../packages/plugin-console/src/22.0.0/index.js";
import { postgres as postgresPlugin } from "../packages/plugin-postgres/src/3.4.8/index.js";
import { redis as redisPlugin } from "../packages/plugin-redis/src/5.4.1/index.js";
import { s3 as s3Plugin } from "../packages/plugin-s3/src/3.989.0/index.js";
import { fetch as fetchPlugin } from "../packages/plugin-fetch/src/whatwg/index.js";
import { pino as pinoPlugin } from "../packages/plugin-pino/src/10.3.1/index.js";
import { zod as zodPlugin } from "../packages/plugin-zod/src/index.js";
import { openai as openaiPlugin } from "../packages/plugin-openai/src/6.21.0/index.js";
import { anthropic as anthropicPlugin } from "../packages/plugin-anthropic/src/0.74.0/index.js";
import { stripe as stripePlugin } from "../packages/plugin-stripe/src/2025-04-30.basil/index.js";
import { cloudflareKv as cloudflareKvPlugin } from "../packages/plugin-cloudflare-kv/src/4.20260213.0/index.js";
import { getAllExamples } from "../packages/docs/src/examples/index.js";

// Internal node kinds excluded from coverage requirements.
// These are structural/implicit and not user-facing.
const INTERNAL_KINDS = new Set([
  "core/program",
  "core/prop_access",
  "core/lambda_param",
  "core/lambda",
  "core/method_call",
  "core/rec",
  "core/rec_call",
]);

// Collect all node kinds from documented plugins.
// Each plugin definition has a `nodeKinds: string[]` array.
// Typeclass dispatch plugins (semiring, semigroup, etc.) have empty
// nodeKinds because they delegate to type-specific plugins.
const plugins: Array<{ nodeKinds: string[]; traits?: any }> = [
  boolean,
  num,
  str,
  eq,
  ord,
  st,
  control,
  error,
  fiber,
  consolePlugin(),
  postgresPlugin(),
  redisPlugin(),
  s3Plugin({ region: "us-east-1" }),
  fetchPlugin(),
  pinoPlugin(),
  zodPlugin,
  openaiPlugin({ apiKey: "unused" }),
  anthropicPlugin({ apiKey: "unused" }),
  stripePlugin({ apiKey: "unused" }),
  cloudflareKvPlugin({ namespaceId: "unused" }),
];

// Also include core node kinds that aren't from plugins
const CORE_KINDS = [
  "core/begin",
  "core/cond",
  "core/literal",
  "core/input",
  "core/record",
  "core/tuple",
];

const allKinds = new Set<string>();

for (const kind of CORE_KINDS) {
  if (!INTERNAL_KINDS.has(kind)) {
    allKinds.add(kind);
  }
}

for (const plugin of plugins) {
  for (const kind of plugin.nodeKinds) {
    if (!INTERNAL_KINDS.has(kind)) {
      allKinds.add(kind);
    }
  }
  // Also collect trait-emitted node kinds
  if (plugin.traits) {
    const traits = plugin.traits as Record<
      string,
      { nodeKinds: Record<string, string> }
    >;
    for (const trait of Object.values(traits)) {
      for (const kind of Object.values(trait.nodeKinds)) {
        if (!INTERNAL_KINDS.has(kind)) {
          allKinds.add(kind);
        }
      }
    }
  }
}

// Collect documented kinds from examples registry
const examples = getAllExamples();
const documentedKinds = new Set(Object.keys(examples));

// Find missing
const missing = [...allKinds].filter((k) => !documentedKinds.has(k)).sort();

if (missing.length > 0) {
  console.error(
    `\n${missing.length} node kind(s) missing documentation examples:\n`,
  );
  for (const kind of missing) {
    console.error(`  - ${kind}`);
  }
  console.error(
    "\nAdd examples to packages/docs/src/examples/ for each missing kind.",
  );
  process.exit(1);
}

console.log(
  `\nAll ${allKinds.size} node kinds have documentation examples.\n`,
);
