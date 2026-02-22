/**
 * Checks docs coverage for every checked plugin.
 *
 * CI fails when either:
 * 1) a node kind is missing a docs example entry, or
 * 2) a plugin namespace is missing a namespace index page.
 */

// Use relative paths to source to avoid pnpm workspace resolution issues
import { boolPlugin, numPlugin, ordPlugin, strPlugin } from "../packages/core/src/std-plugins.js";
import { control } from "../packages/core/src/control.js";
import { error } from "../packages/core/src/error.js";
import { st } from "../packages/core/src/st.js";
import { consolePlugin } from "../packages/plugin-console/src/22.0.0/index.js";
import { postgres as postgresPlugin } from "../packages/plugin-postgres/src/3.4.8/index.js";
import { redis as redisPlugin } from "../packages/plugin-redis/src/5.4.1/index.js";
import { s3 as s3Plugin } from "../packages/plugin-s3/src/3.989.0/index.js";
import { fetch as fetchPlugin } from "../packages/plugin-fetch/src/whatwg/index.js";
import { pino as pinoPlugin } from "../packages/plugin-pino/src/10.3.1/index.js";
import { zod as zodPlugin } from "../packages/plugin-zod/src/index.js";
import { openai as openaiPlugin } from "../packages/plugin-openai/src/6.21.0/index.js";
import { anthropic as anthropicPlugin } from "../packages/plugin-anthropic/src/0.74.0/index.js";
import { fal as falPlugin } from "../packages/plugin-fal/src/1.9.1/index.js";
import { stripe as stripePlugin } from "../packages/plugin-stripe/src/2025-04-30.basil/index.js";
import { resend as resendPlugin } from "../packages/plugin-resend/src/6.9.2/index.js";
import { cloudflareKv as cloudflareKvPlugin } from "../packages/plugin-cloudflare-kv/src/4.20260213.0/index.js";
import { twilio as twilioPlugin } from "../packages/plugin-twilio/src/5.5.1/index.js";
import { slack as slackPlugin } from "../packages/plugin-slack/src/7.14.0/index.js";
import { getAllExamples } from "../packages/docs/src/examples/index.js";
import { isNamespaceIndex } from "../packages/docs/src/examples/types.js";

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
  boolPlugin,
  numPlugin,
  strPlugin,
  ordPlugin,
  st,
  control,
  error,
  consolePlugin(),
  postgresPlugin(),
  redisPlugin(),
  s3Plugin({ region: "us-east-1" }),
  fetchPlugin(),
  pinoPlugin(),
  zodPlugin,
  openaiPlugin({ apiKey: "unused" }),
  anthropicPlugin({ apiKey: "unused" }),
  falPlugin({ credentials: "unused" }),
  stripePlugin({ apiKey: "unused" }),
  resendPlugin({ apiKey: "unused" }),
  cloudflareKvPlugin({ namespaceId: "unused" }),
  twilioPlugin({ accountSid: "unused", authToken: "unused" }),
  slackPlugin({ token: "unused" }),
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
      { mapping?: Record<string, string>; nodeKinds?: Record<string, string> }
    >;
    for (const trait of Object.values(traits)) {
      const kindMap = trait.mapping ?? trait.nodeKinds;
      if (kindMap) {
        for (const kind of Object.values(kindMap)) {
          if (!INTERNAL_KINDS.has(kind)) {
            allKinds.add(kind);
          }
        }
      }
    }
  }
}

// Collect documented kinds from examples registry
const examples = getAllExamples();
const documentedKinds = new Set(Object.keys(examples));
const namespaceKeys = new Set(
  Object.entries(examples)
    .filter(([, entry]) => isNamespaceIndex(entry))
    .map(([kind]) => kind),
);

// Every namespace with checked node kinds must have a namespace landing page.
const expectedNamespaces = new Set<string>(["core"]);
for (const kind of allKinds) {
  const [namespace] = kind.split("/");
  expectedNamespaces.add(namespace);
}

// Find missing
const missing = [...allKinds].filter((k) => !documentedKinds.has(k)).sort();
const missingNamespaceIndexes = [...expectedNamespaces]
  .filter((namespace) => !namespaceKeys.has(namespace))
  .sort();

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

if (missingNamespaceIndexes.length > 0) {
  console.error(
    `\n${missingNamespaceIndexes.length} plugin namespace index page(s) missing:\n`,
  );
  for (const namespace of missingNamespaceIndexes) {
    console.error(`  - ${namespace}`);
  }
  console.error(
    "\nAdd namespace entries to packages/docs/src/examples/indexes.ts for each missing plugin.",
  );
  process.exit(1);
}

console.log(
  `\nAll ${allKinds.size} node kinds have docs examples and plugin namespace index pages.\n`,
);
