/**
 * Koan 15: Fold — index-based interpreters over DAG adjacency maps
 *
 * RULE: Never rewrite this file.
 *
 * What we prove:
 * - Operations define children by position (index), not named fields
 * - fold(dag, interpreter) walks the adjacency map post-order
 * - Memoization: shared nodes are evaluated once (DAG, not tree)
 * - Interpreter handlers receive evaluated child results by index
 * - PluginDef: { name, nodeKinds, defaultInterpreter? }
 * - defaults(plugins, overrides?) merges interpreters from plugin list
 * - defaults throws when a plugin has kinds but no interpreter and no override
 * - defaults accepts overrides for plugins without defaultInterpreter
 * - defaults(plugins) + fold = end-to-end evaluation
 * - Transform-then-fold: pipe rewrite → defaults → fold
 *
 * This proves the adjacency-map representation is foldable with the
 * same stack-pushing/popping strategy as foldAST, using positional
 * children instead of named fields. The isomorphism is mechanical.
 *
 * Imports: 14-dagql (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/15-bridge.ts
 *   npx tsx spike-koans/15-bridge.ts
 */

export * from "./14-dagql";

import type { RuntimeEntry } from "./14-dagql";
import {
  makeNExpr,
  numLit,
  add,
  mul,
  app,
  replaceWhere,
  byKind,
  pipe,
} from "./14-dagql";

// ─── Interpreter: kind → handler(childResults, entry) → result ──────
export type Interpreter = Record<
  string,
  (children: unknown[], entry: RuntimeEntry) => unknown
>;

// ─── fold: post-order DAG traversal with memoization ────────────────
export function fold<T>(
  rootId: string,
  adj: Record<string, RuntimeEntry>,
  interp: Interpreter,
): T {
  const memo: Record<string, unknown> = {};

  function visit(id: string): unknown {
    if (id in memo) return memo[id];
    const entry = adj[id];
    if (!entry) throw new Error(`fold: missing node "${id}"`);
    const handler = interp[entry.kind];
    if (!handler) throw new Error(`fold: no handler for "${entry.kind}"`);
    const childResults = entry.children.map(visit);
    const result = handler(childResults, entry);
    memo[id] = result;
    return result;
  }

  return visit(rootId) as T;
}

// ─── PluginDef: minimal plugin definition ───────────────────────────
export interface PluginDef {
  name: string;
  nodeKinds: readonly string[];
  defaultInterpreter?: () => Interpreter;
}

// ─── defaults: merge interpreters from plugin list ──────────────────
// Same strategy as core: iterate plugins, merge defaultInterpreter or
// override. Throws if a plugin has nodeKinds but neither.
export function defaults(
  plugins: readonly PluginDef[],
  overrides: Record<string, Interpreter> = {},
): Interpreter {
  const composed: Interpreter = {};
  for (const plugin of plugins) {
    if (plugin.name in overrides) {
      Object.assign(composed, overrides[plugin.name]);
    } else if (plugin.defaultInterpreter) {
      Object.assign(composed, plugin.defaultInterpreter());
    } else if (plugin.nodeKinds.length === 0) {
      // no kinds → nothing to interpret
    } else {
      throw new Error(
        `Plugin "${plugin.name}" has no defaultInterpreter and no override`,
      );
    }
  }
  return composed;
}

// ─── Plugin definitions ─────────────────────────────────────────────

const numPlugin: PluginDef = {
  name: "num",
  nodeKinds: ["num/literal", "num/add", "num/mul", "num/sub"],
  defaultInterpreter: () => ({
    "num/literal": (_ch, entry) => entry.out as number,
    "num/add": (ch) => (ch[0] as number) + (ch[1] as number),
    "num/mul": (ch) => (ch[0] as number) * (ch[1] as number),
    "num/sub": (ch) => (ch[0] as number) - (ch[1] as number),
  }),
};

const boolPlugin: PluginDef = {
  name: "bool",
  nodeKinds: ["bool/literal"],
  defaultInterpreter: () => ({
    "bool/literal": (_ch, entry) => entry.out as boolean,
  }),
};

const corePlugin: PluginDef = {
  name: "core",
  nodeKinds: ["core/cond"],
  defaultInterpreter: () => ({
    "core/cond": (ch) => (ch[0] ? ch[1] : ch[2]),
  }),
};

const strPlugin: PluginDef = {
  name: "str",
  nodeKinds: ["str/literal", "str/concat"],
  defaultInterpreter: () => ({
    "str/literal": (_ch, entry) => entry.out as string,
    "str/concat": (ch) => (ch as string[]).join(""),
  }),
};

// Plugin with no defaultInterpreter (requires override)
const customPlugin: PluginDef = {
  name: "custom",
  nodeKinds: ["custom/double"],
};

// Plugin with no kinds (utility/meta plugin, always safe)
const emptyPlugin: PluginDef = {
  name: "meta",
  nodeKinds: [],
};

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME TESTS
// ═══════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

// --- defaults: num plugin only ---
const numInterp = defaults([numPlugin]);
const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
const result = fold<number>(prog.__id, prog.__adj, numInterp);
assert(result === 35, `(3+4)*5 = ${result}, expected 35`);

// --- defaults: multi-plugin merge ---
const multiInterp = defaults([corePlugin, boolPlugin, numPlugin]);
const condAdj: Record<string, RuntimeEntry> = {
  a: { kind: "bool/literal", children: [], out: true },
  b: { kind: "num/literal", children: [], out: 10 },
  c: { kind: "num/literal", children: [], out: 20 },
  d: { kind: "core/cond", children: ["a", "b", "c"], out: undefined },
};
assert(fold<number>("d", condAdj, multiInterp) === 10, "cond(true) = 10");
condAdj.a = { kind: "bool/literal", children: [], out: false };
assert(fold<number>("d", condAdj, multiInterp) === 20, "cond(false) = 20");

// --- defaults: string plugin ---
const strInterp = defaults([strPlugin]);
const strAdj: Record<string, RuntimeEntry> = {
  a: { kind: "str/literal", children: [], out: "hello" },
  b: { kind: "str/literal", children: [], out: " " },
  c: { kind: "str/literal", children: [], out: "world" },
  d: { kind: "str/concat", children: ["a", "b", "c"], out: undefined },
};
assert(fold<string>("d", strAdj, strInterp) === "hello world", "str defaults");

// --- defaults: override for plugin without defaultInterpreter ---
const customInterp = defaults([numPlugin, customPlugin], {
  custom: {
    "custom/double": (ch) => (ch[0] as number) * 2,
  },
});
const customAdj: Record<string, RuntimeEntry> = {
  a: { kind: "num/literal", children: [], out: 7 },
  b: { kind: "custom/double", children: ["a"], out: undefined },
};
assert(fold<number>("b", customAdj, customInterp) === 14, "custom override");

// --- defaults: empty plugin (no kinds) is fine ---
const withEmpty = defaults([numPlugin, emptyPlugin]);
assert(
  fold<number>(prog.__id, prog.__adj, withEmpty) === 35,
  "empty plugin harmless",
);

// --- defaults: throws on missing interpreter + no override ---
let threwNoInterp = false;
try {
  defaults([customPlugin]); // has kinds but no defaultInterpreter
} catch (e: any) {
  threwNoInterp = e.message.includes("no defaultInterpreter");
}
assert(threwNoInterp, "throws on plugin without interpreter or override");

// --- Memoization: shared node evaluated once ---
let evalCount = 0;
const countingPlugin: PluginDef = {
  name: "counting",
  nodeKinds: ["num/literal", "num/add"],
  defaultInterpreter: () => ({
    "num/literal": (_ch, entry) => { evalCount++; return entry.out as number; },
    "num/add": (ch) => { evalCount++; return (ch[0] as number) + (ch[1] as number); },
  }),
};
const shared = app(add(numLit(3), numLit(3)));
evalCount = 0;
fold<number>(shared.__id, shared.__adj, defaults([countingPlugin]));
assert(evalCount === 2, `shared: ${evalCount} evals (literal once + add once)`);

// --- Transform then fold: pipe → defaults → fold ---
const transformed = pipe(
  prog,
  (e) => replaceWhere(e, byKind("num/add"), "num/mul"),
);
assert(
  fold<number>(transformed.__id, transformed.__adj, numInterp) === 60,
  "(3*4)*5 = 60 via transform+defaults+fold",
);

// --- Mixed: rewrite then fold with full plugin stack ---
const prog2 = app(mul(add(numLit(1), numLit(2)), add(numLit(3), numLit(4))));
const rewritten = pipe(
  prog2,
  (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
);
const mixedResult = fold<number>(rewritten.__id, rewritten.__adj, numInterp);
assert(mixedResult === 1, `(1-2)*(3-4) = ${mixedResult}, expected 1`);

// --- Error: missing handler (fold-level) ---
let threwMissing = false;
try {
  fold("d", condAdj, defaults([numPlugin])); // no bool/literal handler
} catch (e: any) {
  threwMissing = e.message.includes("no handler");
}
assert(threwMissing, "fold throws on missing handler");

// --- Error: missing node ---
let threwNode = false;
try {
  fold("nonexistent", {}, numInterp);
} catch (e: any) {
  threwNode = e.message.includes("missing node");
}
assert(threwNode, "fold throws on missing node");

console.log(`\n15-fold: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
