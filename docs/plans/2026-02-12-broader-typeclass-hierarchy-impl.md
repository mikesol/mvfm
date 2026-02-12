# Broader Typeclass Hierarchy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port PureScript prelude typeclasses (Eq update, Ord, Semiring, HeytingAlgebra) into ilo's trait dispatch system.

**Architecture:** Data plugins (num, boolean, str) register trait primitives. Trait plugins (eq, ord, semiring, heytingAlgebra) discover implementations and expose user-facing methods. Derived operations (gt/gte/lt/lte from compare, neq from eq) live in the trait plugins as wrapper nodes.

**Tech Stack:** TypeScript, Vitest, Biome

**Working directory:** `/home/mikesol/Documents/GitHub/ilo/ilo/.worktrees/issue-20`

---

### Task 1: Core infrastructure — TraitImpl and trait-utils

**Files:**
- Modify: `src/core.ts:124-136`
- Create: `src/trait-utils.ts`
- Modify: `src/plugins/eq/index.ts` (remove inferType/resolveSchemaType, import from trait-utils)

**Step 1: Update TraitImpl and PluginDefinition.traits in core.ts**

Change lines 124-136 from:

```ts
export interface TraitImpl {
  type: string;
  nodeKind: string;
}

export interface PluginDefinition<T = any> {
  name: string;
  nodeKinds: string[];
  build: (ctx: PluginContext) => T;
  traits?: {
    eq?: TraitImpl;
  };
}
```

To:

```ts
export interface TraitImpl {
  type: string;
  nodeKinds: Record<string, string>;
}

export interface PluginDefinition<T = any> {
  name: string;
  nodeKinds: string[];
  build: (ctx: PluginContext) => T;
  traits?: {
    eq?: TraitImpl;
    ord?: TraitImpl;
    semiring?: TraitImpl;
    heytingAlgebra?: TraitImpl;
  };
}
```

**Step 2: Create src/trait-utils.ts**

Extract `inferType` and `resolveSchemaType` from eq/index.ts, adapted for the new `nodeKinds` map:

```ts
import type { ASTNode, TraitImpl } from "./core";

/**
 * Infer the runtime type of an AST node by inspecting its structure.
 *
 * 1. Literals — typeof value
 * 2. Plugin nodes — match node kind prefix against trait declarations
 * 3. Input fields — walk the input schema
 */
export function inferType(
  node: ASTNode,
  impls: TraitImpl[],
  schema?: Record<string, unknown>,
): string | null {
  // 1. Literals
  if (node.kind === "core/literal") {
    if (node.value === null) return "null";
    return typeof node.value; // "string", "number", "boolean"
  }

  // 2. Plugin nodes — match against registered trait types
  for (const impl of impls) {
    const firstNodeKind = Object.values(impl.nodeKinds)[0];
    if (!firstNodeKind) continue;
    const pluginPrefix = firstNodeKind.split("/")[0];
    if (node.kind.startsWith(`${pluginPrefix}/`)) return impl.type;
  }

  // 3. Input fields — walk schema
  if (node.kind === "core/prop_access") {
    return resolveSchemaType(node, schema);
  }

  return null;
}

/**
 * Walk a core/prop_access chain back to core/input and resolve
 * the type from the input schema.
 */
export function resolveSchemaType(
  node: ASTNode,
  schema?: Record<string, unknown>,
): string | null {
  if (!schema) return null;

  // Build access path: $.input.address.city → ["address", "city"]
  const path: string[] = [];
  let current = node;
  while (current.kind === "core/prop_access") {
    path.unshift(current.property as string);
    current = current.object as ASTNode;
  }
  if (current.kind !== "core/input") return null;

  // Walk schema along the path
  let schemaNode: unknown = schema;
  for (const key of path) {
    if (typeof schemaNode === "object" && schemaNode !== null && key in schemaNode) {
      schemaNode = (schemaNode as Record<string, unknown>)[key];
    } else {
      return null;
    }
  }

  // Resolve terminal value to type string
  if (typeof schemaNode === "string") return schemaNode;
  if (typeof schemaNode === "object" && schemaNode !== null && "__tag" in schemaNode) {
    return (schemaNode as { __tag: string }).__tag;
  }
  return null;
}
```

**Step 3: Update eq/index.ts to import from trait-utils**

Replace the local `inferType` and `resolveSchemaType` definitions with imports. Update the trait discovery to use `nodeKinds` map:

```ts
import type { ASTNode, Expr, PluginContext, PluginDefinition } from "../../core";
import { inferType } from "../../trait-utils";

export interface EqMethods {
  eq(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  eq(a: Expr<string> | string, b: Expr<string> | string): Expr<boolean>;
  eq(a: Expr<boolean> | boolean, b: Expr<boolean> | boolean): Expr<boolean>;
  neq(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  neq(a: Expr<string> | string, b: Expr<string> | string): Expr<boolean>;
  neq(a: Expr<boolean> | boolean, b: Expr<boolean> | boolean): Expr<boolean>;
}

export const eq: PluginDefinition<EqMethods> = {
  name: "eq",
  nodeKinds: ["eq/neq"],
  build(ctx: PluginContext): EqMethods {
    const impls = ctx.plugins.filter((p) => p.traits?.eq).map((p) => p.traits!.eq!);

    function dispatchEq(a: any, b: any): Expr<boolean> {
      const aNode = ctx.lift(a).__node;
      const bNode = ctx.lift(b).__node;
      const type =
        inferType(aNode, impls, ctx.inputSchema) ?? inferType(bNode, impls, ctx.inputSchema);
      if (!type) {
        throw new Error("Cannot infer type for eq — both arguments are untyped");
      }
      const impl = impls.find((i) => i.type === type);
      if (!impl) {
        throw new Error(`No eq implementation for type: ${type}`);
      }
      return ctx.expr<boolean>({
        kind: impl.nodeKinds.eq,
        left: aNode,
        right: bNode,
      });
    }

    return {
      eq: dispatchEq,
      neq(a: any, b: any): Expr<boolean> {
        const inner = dispatchEq(a, b);
        return ctx.expr<boolean>({
          kind: "eq/neq",
          inner: inner.__node,
        });
      },
    } as EqMethods;
  },
};
```

**Step 4: Run build to check for type errors (will fail — data plugins still use old format)**

Run: `npm run build 2>&1 | head -20`
Expected: Type errors in num, str, boolean plugins (old `nodeKind` field). This is expected — we fix them in Task 2.

**Step 5: Commit infrastructure**

```bash
git add src/core.ts src/trait-utils.ts src/plugins/eq/index.ts
git commit -m "feat: extend TraitImpl to nodeKinds map, extract trait-utils"
```

---

### Task 2: Update data plugins — trait registrations and interpreters

**Files:**
- Modify: `src/plugins/num/index.ts`
- Modify: `src/plugins/num/interpreter.ts`
- Modify: `src/plugins/boolean/index.ts`
- Modify: `src/plugins/boolean/interpreter.ts`
- Modify: `src/plugins/str/index.ts`

**Step 1: Update num plugin**

`src/plugins/num/index.ts` — remove methods that move to traits, add new trait registrations, add/remove node kinds:

```ts
import type { Expr, PluginContext, PluginDefinition } from "../../core";

export interface NumMethods {
  sub(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  div(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  mod(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  neg(a: Expr<number> | number): Expr<number>;
  abs(a: Expr<number> | number): Expr<number>;
  floor(a: Expr<number> | number): Expr<number>;
  ceil(a: Expr<number> | number): Expr<number>;
  round(a: Expr<number> | number): Expr<number>;
  min(...values: (Expr<number> | number)[]): Expr<number>;
  max(...values: (Expr<number> | number)[]): Expr<number>;
}

export const num: PluginDefinition<NumMethods> = {
  name: "num",
  nodeKinds: [
    "num/add",
    "num/sub",
    "num/mul",
    "num/div",
    "num/mod",
    "num/compare",
    "num/neg",
    "num/abs",
    "num/floor",
    "num/ceil",
    "num/round",
    "num/min",
    "num/max",
    "num/eq",
    "num/zero",
    "num/one",
  ],
  traits: {
    eq: { type: "number", nodeKinds: { eq: "num/eq" } },
    ord: { type: "number", nodeKinds: { compare: "num/compare" } },
    semiring: {
      type: "number",
      nodeKinds: { add: "num/add", zero: "num/zero", mul: "num/mul", one: "num/one" },
    },
  },
  build(ctx: PluginContext): NumMethods {
    const binop = (kind: string) => (a: Expr<number> | number, b: Expr<number> | number) =>
      ctx.expr<number>({
        kind,
        left: ctx.lift(a).__node,
        right: ctx.lift(b).__node,
      });

    const unop = (kind: string) => (a: Expr<number> | number) =>
      ctx.expr<number>({ kind, operand: ctx.lift(a).__node });

    return {
      sub: binop("num/sub"),
      div: binop("num/div"),
      mod: binop("num/mod"),
      neg: unop("num/neg"),
      abs: unop("num/abs"),
      floor: unop("num/floor"),
      ceil: unop("num/ceil"),
      round: unop("num/round"),
      min: (...values) =>
        ctx.expr<number>({
          kind: "num/min",
          values: values.map((v) => ctx.lift(v).__node),
        }),
      max: (...values) =>
        ctx.expr<number>({
          kind: "num/max",
          values: values.map((v) => ctx.lift(v).__node),
        }),
    };
  },
};
```

**Step 2: Update num interpreter**

`src/plugins/num/interpreter.ts` — remove gt/gte/lt/lte handlers, add compare/zero/one:

```ts
import type { ASTNode, InterpreterFragment } from "../../core";

export const numInterpreter: InterpreterFragment = {
  pluginName: "num",
  canHandle: (node) => node.kind.startsWith("num/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "num/add":
        return (
          (recurse(node.left as ASTNode) as number) + (recurse(node.right as ASTNode) as number)
        );
      case "num/sub":
        return (
          (recurse(node.left as ASTNode) as number) - (recurse(node.right as ASTNode) as number)
        );
      case "num/mul":
        return (
          (recurse(node.left as ASTNode) as number) * (recurse(node.right as ASTNode) as number)
        );
      case "num/div":
        return (
          (recurse(node.left as ASTNode) as number) / (recurse(node.right as ASTNode) as number)
        );
      case "num/mod":
        return (
          (recurse(node.left as ASTNode) as number) % (recurse(node.right as ASTNode) as number)
        );
      case "num/compare": {
        const l = recurse(node.left as ASTNode) as number;
        const r = recurse(node.right as ASTNode) as number;
        return l < r ? -1 : l === r ? 0 : 1;
      }
      case "num/neg":
        return -(recurse(node.operand as ASTNode) as number);
      case "num/abs":
        return Math.abs(recurse(node.operand as ASTNode) as number);
      case "num/floor":
        return Math.floor(recurse(node.operand as ASTNode) as number);
      case "num/ceil":
        return Math.ceil(recurse(node.operand as ASTNode) as number);
      case "num/round":
        return Math.round(recurse(node.operand as ASTNode) as number);
      case "num/min":
        return Math.min(...(node.values as ASTNode[]).map((v) => recurse(v) as number));
      case "num/max":
        return Math.max(...(node.values as ASTNode[]).map((v) => recurse(v) as number));
      case "num/eq":
        return recurse(node.left as ASTNode) === recurse(node.right as ASTNode);
      case "num/zero":
        return 0;
      case "num/one":
        return 1;
      default:
        throw new Error(`Num interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 3: Update boolean plugin**

`src/plugins/boolean/index.ts` — remove all methods, add heytingAlgebra trait:

```ts
import type { PluginDefinition } from "../../core";

export interface BooleanMethods {}

export const boolean: PluginDefinition<BooleanMethods> = {
  name: "boolean",
  nodeKinds: ["boolean/and", "boolean/or", "boolean/not", "boolean/eq", "boolean/ff", "boolean/tt", "boolean/implies"],
  traits: {
    eq: { type: "boolean", nodeKinds: { eq: "boolean/eq" } },
    heytingAlgebra: {
      type: "boolean",
      nodeKinds: {
        conj: "boolean/and",
        disj: "boolean/or",
        not: "boolean/not",
        ff: "boolean/ff",
        tt: "boolean/tt",
        implies: "boolean/implies",
      },
    },
  },
  build(): BooleanMethods {
    return {};
  },
};
```

**Step 4: Update boolean interpreter**

`src/plugins/boolean/interpreter.ts` — add ff/tt/implies handlers:

```ts
import type { ASTNode, InterpreterFragment } from "../../core";

export const booleanInterpreter: InterpreterFragment = {
  pluginName: "boolean",
  canHandle: (node) => node.kind.startsWith("boolean/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "boolean/and":
        return (
          (recurse(node.left as ASTNode) as boolean) && (recurse(node.right as ASTNode) as boolean)
        );
      case "boolean/or":
        return (
          (recurse(node.left as ASTNode) as boolean) || (recurse(node.right as ASTNode) as boolean)
        );
      case "boolean/not":
        return !(recurse(node.operand as ASTNode) as boolean);
      case "boolean/eq":
        return recurse(node.left as ASTNode) === recurse(node.right as ASTNode);
      case "boolean/ff":
        return false;
      case "boolean/tt":
        return true;
      case "boolean/implies":
        return (
          !(recurse(node.left as ASTNode) as boolean) ||
          (recurse(node.right as ASTNode) as boolean)
        );
      default:
        throw new Error(`Boolean interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 5: Update str plugin**

`src/plugins/str/index.ts` — update trait registration format only (line 46):

Change:
```ts
  traits: { eq: { type: "string", nodeKind: "str/eq" } },
```

To:
```ts
  traits: { eq: { type: "string", nodeKinds: { eq: "str/eq" } } },
```

**Step 6: Commit data plugin updates**

```bash
git add src/plugins/num/ src/plugins/boolean/ src/plugins/str/index.ts
git commit -m "feat: update data plugins with new trait registrations"
```

---

### Task 3: Create trait plugins — ord, semiring, heytingAlgebra

**Files:**
- Create: `src/plugins/ord/index.ts`
- Create: `src/plugins/ord/interpreter.ts`
- Create: `src/plugins/semiring/index.ts`
- Create: `src/plugins/heyting-algebra/index.ts`
- Create: `src/plugins/eq/interpreter.ts`

**Step 1: Create ord plugin**

`src/plugins/ord/index.ts`:

```ts
import type { ASTNode, Expr, PluginContext, PluginDefinition } from "../../core";
import { inferType } from "../../trait-utils";

export interface OrdMethods {
  compare(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  gt(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  gte(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  lt(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  lte(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
}

export const ord: PluginDefinition<OrdMethods> = {
  name: "ord",
  nodeKinds: ["ord/gt", "ord/gte", "ord/lt", "ord/lte"],
  build(ctx: PluginContext): OrdMethods {
    const impls = ctx.plugins.filter((p) => p.traits?.ord).map((p) => p.traits!.ord!);

    function dispatchCompare(a: any, b: any): Expr<number> {
      const aNode = ctx.lift(a).__node;
      const bNode = ctx.lift(b).__node;
      const type =
        inferType(aNode, impls, ctx.inputSchema) ?? inferType(bNode, impls, ctx.inputSchema);
      if (!type) {
        throw new Error("Cannot infer type for compare — both arguments are untyped");
      }
      const impl = impls.find((i) => i.type === type);
      if (!impl) {
        throw new Error(`No ord implementation for type: ${type}`);
      }
      return ctx.expr<number>({
        kind: impl.nodeKinds.compare,
        left: aNode,
        right: bNode,
      });
    }

    function derived(op: "ord/gt" | "ord/gte" | "ord/lt" | "ord/lte") {
      return (a: any, b: any): Expr<boolean> => {
        const compareNode = dispatchCompare(a, b).__node;
        return ctx.expr<boolean>({ kind: op, operand: compareNode });
      };
    }

    return {
      compare: dispatchCompare,
      gt: derived("ord/gt"),
      gte: derived("ord/gte"),
      lt: derived("ord/lt"),
      lte: derived("ord/lte"),
    } as OrdMethods;
  },
};
```

**Step 2: Create ord interpreter**

`src/plugins/ord/interpreter.ts`:

```ts
import type { ASTNode, InterpreterFragment } from "../../core";

export const ordInterpreter: InterpreterFragment = {
  pluginName: "ord",
  canHandle: (node) => node.kind.startsWith("ord/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    const cmp = recurse(node.operand as ASTNode) as number;
    switch (node.kind) {
      case "ord/gt":
        return cmp > 0;
      case "ord/gte":
        return cmp >= 0;
      case "ord/lt":
        return cmp < 0;
      case "ord/lte":
        return cmp <= 0;
      default:
        throw new Error(`Ord interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 3: Create semiring plugin**

`src/plugins/semiring/index.ts`:

```ts
import type { Expr, PluginContext, PluginDefinition } from "../../core";
import { inferType } from "../../trait-utils";

export interface SemiringMethods {
  add(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  mul(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
}

export const semiring: PluginDefinition<SemiringMethods> = {
  name: "semiring",
  nodeKinds: [],
  build(ctx: PluginContext): SemiringMethods {
    const impls = ctx.plugins.filter((p) => p.traits?.semiring).map((p) => p.traits!.semiring!);

    function dispatch(op: string) {
      return (a: any, b: any): Expr<number> => {
        const aNode = ctx.lift(a).__node;
        const bNode = ctx.lift(b).__node;
        const type =
          inferType(aNode, impls, ctx.inputSchema) ?? inferType(bNode, impls, ctx.inputSchema);
        if (!type) {
          throw new Error(`Cannot infer type for ${op} — both arguments are untyped`);
        }
        const impl = impls.find((i) => i.type === type);
        if (!impl) {
          throw new Error(`No semiring implementation for type: ${type}`);
        }
        return ctx.expr<number>({
          kind: impl.nodeKinds[op],
          left: aNode,
          right: bNode,
        });
      };
    }

    return {
      add: dispatch("add"),
      mul: dispatch("mul"),
    } as SemiringMethods;
  },
};
```

**Step 4: Create heytingAlgebra plugin**

`src/plugins/heyting-algebra/index.ts`:

```ts
import type { Expr, PluginContext, PluginDefinition } from "../../core";
import { inferType } from "../../trait-utils";

export interface HeytingAlgebraMethods {
  and(a: Expr<boolean>, b: Expr<boolean>): Expr<boolean>;
  or(a: Expr<boolean>, b: Expr<boolean>): Expr<boolean>;
  not(a: Expr<boolean>): Expr<boolean>;
}

export const heytingAlgebra: PluginDefinition<HeytingAlgebraMethods> = {
  name: "heytingAlgebra",
  nodeKinds: [],
  build(ctx: PluginContext): HeytingAlgebraMethods {
    const impls = ctx.plugins
      .filter((p) => p.traits?.heytingAlgebra)
      .map((p) => p.traits!.heytingAlgebra!);

    function dispatchBinary(op: string) {
      return (a: Expr<boolean>, b: Expr<boolean>): Expr<boolean> => {
        const aNode = a.__node;
        const bNode = b.__node;
        const type =
          inferType(aNode, impls, ctx.inputSchema) ?? inferType(bNode, impls, ctx.inputSchema);
        if (!type) {
          throw new Error(`Cannot infer type for ${op} — both arguments are untyped`);
        }
        const impl = impls.find((i) => i.type === type);
        if (!impl) {
          throw new Error(`No heytingAlgebra implementation for type: ${type}`);
        }
        return ctx.expr<boolean>({
          kind: impl.nodeKinds[op],
          left: aNode,
          right: bNode,
        });
      };
    }

    return {
      and: dispatchBinary("conj"),
      or: dispatchBinary("disj"),
      not(a: Expr<boolean>): Expr<boolean> {
        const aNode = a.__node;
        const type = inferType(aNode, impls, ctx.inputSchema);
        if (!type) {
          throw new Error("Cannot infer type for not — argument is untyped");
        }
        const impl = impls.find((i) => i.type === type);
        if (!impl) {
          throw new Error(`No heytingAlgebra implementation for type: ${type}`);
        }
        return ctx.expr<boolean>({
          kind: impl.nodeKinds.not,
          operand: aNode,
        });
      },
    };
  },
};
```

**Step 5: Create eq interpreter**

`src/plugins/eq/interpreter.ts`:

```ts
import type { ASTNode, InterpreterFragment } from "../../core";

export const eqInterpreter: InterpreterFragment = {
  pluginName: "eq",
  canHandle: (node) => node.kind.startsWith("eq/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "eq/neq":
        return !recurse(node.inner as ASTNode);
      default:
        throw new Error(`Eq interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 6: Commit new trait plugins**

```bash
git add src/plugins/ord/ src/plugins/semiring/ src/plugins/heyting-algebra/ src/plugins/eq/interpreter.ts
git commit -m "feat: add ord, semiring, heytingAlgebra trait plugins"
```

---

### Task 4: Update exports

**Files:**
- Modify: `src/index.ts`

**Step 1: Update src/index.ts**

Add new exports and update changed exports. The `inferType` and `resolveSchemaType` now come from `trait-utils`, not `eq`:

```ts
// Public API

export type {
  ASTNode,
  Expr,
  Interpreter,
  InterpreterFragment,
  Plugin,
  PluginContext,
  PluginDefinition,
  Program,
  TraitImpl,
} from "./core";
export { composeInterpreters, ilo } from "./core";
export { coreInterpreter } from "./interpreters/core";
export type { BooleanMethods } from "./plugins/boolean";
export { boolean } from "./plugins/boolean";
export { booleanInterpreter } from "./plugins/boolean/interpreter";
export type { ControlMethods } from "./plugins/control";
export { control } from "./plugins/control";
export type { EqMethods } from "./plugins/eq";
export { eq } from "./plugins/eq";
export { eqInterpreter } from "./plugins/eq/interpreter";
export type { ErrorMethods } from "./plugins/error";
export { error } from "./plugins/error";
export type { FiberMethods } from "./plugins/fiber";
export { fiber } from "./plugins/fiber";
export type { HeytingAlgebraMethods } from "./plugins/heyting-algebra";
export { heytingAlgebra } from "./plugins/heyting-algebra";
export type { NumMethods } from "./plugins/num";
export { num } from "./plugins/num";
export { numInterpreter } from "./plugins/num/interpreter";
export type { OrdMethods } from "./plugins/ord";
export { ord } from "./plugins/ord";
export { ordInterpreter } from "./plugins/ord/interpreter";
export type { PostgresConfig, PostgresMethods } from "./plugins/postgres/3.4.8";
export { postgres } from "./plugins/postgres/3.4.8";
export type { SemiringMethods } from "./plugins/semiring";
export { semiring } from "./plugins/semiring";
export type { StMethods } from "./plugins/st";
export { st } from "./plugins/st";
export type { StrMethods } from "./plugins/str";
export { str } from "./plugins/str";
export { strInterpreter } from "./plugins/str/interpreter";
export { inferType, resolveSchemaType } from "./trait-utils";
export type {
  ArraySchema,
  InferSchema,
  NullableSchema,
  SchemaShape,
  SchemaTag,
  SchemaType,
} from "./schema";
export { array, nullable } from "./schema";
```

**Step 2: Run build**

Run: `npm run build`
Expected: PASS (all source code should compile)

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: export new trait plugins and interpreters"
```

---

### Task 5: Update existing tests

All existing tests that use `$.add`, `$.mul`, `$.gt`, `$.gte`, `$.lt`, `$.lte`, `$.and`, `$.or`, `$.not` need updating to include the appropriate trait plugin. `$.sub`, `$.div`, `$.mod`, `$.neg`, etc. stay on `num`.

**Files:**
- Modify: `tests/core.test.ts`
- Modify: `tests/rec.test.ts`
- Modify: `tests/composition.test.ts`
- Modify: `tests/plugins/num/index.test.ts`
- Modify: `tests/plugins/num/interpreter.test.ts`
- Modify: `tests/plugins/boolean/index.test.ts`
- Modify: `tests/plugins/eq/index.test.ts`
- Modify: `tests/plugins/eq/interpreter.test.ts`

**Step 1: Update tests/core.test.ts**

Key changes:
- Add `import { semiring } from "../src/plugins/semiring"` and `import { ord } from "../src/plugins/ord"` and `import { heytingAlgebra } from "../src/plugins/heyting-algebra"`
- Change `ilo(num)` to `ilo(num, semiring)` wherever `$.add` or `$.mul` is used
- Change `ilo(num, eq)` to `ilo(num, semiring, eq)` wherever `$.add` is used alongside eq
- Change `ilo(num, boolean, eq)` to `ilo(num, boolean, eq, heytingAlgebra)` where `$.and`/`$.or` is used
- Update trait protocol test (line 302-313): change `nodeKind` to `nodeKinds: { eq: "test/eq" }` and update assertion

**Step 2: Update tests/rec.test.ts**

Key changes:
- Add `import { semiring } from "../src/plugins/semiring"`
- Change `ilo(num, eq)` to `ilo(num, eq, semiring)`

**Step 3: Update tests/composition.test.ts**

Key changes:
- Add imports for `ord`, `semiring`
- Change `ilo(num, str, postgres(...), fiber, error)` to `ilo(num, str, ord, semiring, postgres(...), fiber, error)`
- Lines referencing `$.gt` now produce `ord/gt` wrapping `num/compare` instead of `num/gt` — update assertions:
  - `$.gt(...)` now produces `{ kind: "ord/gt", operand: { kind: "num/compare", left, right } }`
  - The error/guard tests check `$.gt(...)` structure — update expected node kinds

**Step 4: Update tests/plugins/num/index.test.ts**

Key changes:
- Remove `describe("num: binary operations")` entries for "add" and "mul" (move to semiring tests)
- Remove entire `describe("num: comparison operations")` block (move to ord tests)
- Remove `describe("num: auto-lifting")` tests that use `$.add` — OR add semiring import
- Update trait declaration test: `{ type: "number", nodeKind: "num/eq" }` → check new format with `nodeKinds`
- Add assertions for new traits (ord, semiring)

**Step 5: Update tests/plugins/num/interpreter.test.ts**

Key changes:
- Add `import { semiring } from "../../../src/plugins/semiring"` and `import { ord } from "../../../src/plugins/ord"` and `import { ordInterpreter } from "../../../src/plugins/ord/interpreter"`
- Change `ilo(num)` to `ilo(num, semiring, ord)`
- Add `ordInterpreter` to the interpreter fragments for comparison tests
- Comparison tests now go through ord wrapper — the end-to-end results should be the same

**Step 6: Update tests/plugins/boolean/index.test.ts**

Key changes:
- Add `import { heytingAlgebra } from "../../../src/plugins/heyting-algebra"`
- Change `ilo(num, boolean, eq)` to `ilo(num, boolean, eq, heytingAlgebra)`
- Update trait declaration test: check new `nodeKinds` format

**Step 7: Update tests/plugins/eq/index.test.ts**

Key changes:
- Add `import { semiring } from "../../../src/plugins/semiring"`
- Line 24 uses `$.add(1, 2)` — change `ilo(num, eq)` to `ilo(num, semiring, eq)` for that describe block
- Update assertion on eq dispatch for numExpr: `$.add(1, 2)` still produces a `num/add` node, dispatches to `num/eq` — should still work

**Step 8: Update tests/plugins/eq/interpreter.test.ts**

Should be fine as-is — doesn't directly call `$.add`/`$.gt`/`$.and`. Verify.

**Step 9: Run all tests**

Run: `npm test`
Expected: All 191 tests pass (some test content changed but behavior preserved)

**Step 10: Commit**

```bash
git add tests/
git commit -m "test: update existing tests for trait-dispatched operations"
```

---

### Task 6: Add new tests — ord, semiring, heytingAlgebra, eq/neq

**Files:**
- Create: `tests/plugins/ord/index.test.ts`
- Create: `tests/plugins/ord/interpreter.test.ts`
- Create: `tests/plugins/semiring/index.test.ts`
- Create: `tests/plugins/semiring/interpreter.test.ts`
- Create: `tests/plugins/heyting-algebra/index.test.ts`
- Create: `tests/plugins/heyting-algebra/interpreter.test.ts`
- Modify: `tests/plugins/eq/index.test.ts` (add neq tests)
- Modify: `tests/plugins/eq/interpreter.test.ts` (add neq interpreter tests)

**Step 1: Create ord AST tests**

`tests/plugins/ord/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ilo } from "../../../src/core";
import { num } from "../../../src/plugins/num";
import { ord } from "../../../src/plugins/ord";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("ord: compare dispatch", () => {
  const app = ilo(num, ord);

  it("$.compare(literal, literal) dispatches to num/compare", () => {
    const prog = app(($) => $.compare(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/compare");
    expect(ast.result.left.value).toBe(1);
    expect(ast.result.right.value).toBe(2);
  });

  it("$.compare with schema input dispatches to num/compare", () => {
    const prog = app({ x: "number" }, ($) => $.compare($.input.x, 5));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/compare");
  });
});

describe("ord: derived operations wrap compare", () => {
  const app = ilo(num, ord);

  it.each([
    ["gt", "ord/gt"],
    ["gte", "ord/gte"],
    ["lt", "ord/lt"],
    ["lte", "ord/lte"],
  ] as const)("$.%s wraps num/compare in %s", (method, kind) => {
    const prog = app(($) => ($[method] as any)(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe(kind);
    expect(ast.result.operand.kind).toBe("num/compare");
    expect(ast.result.operand.left.value).toBe(1);
    expect(ast.result.operand.right.value).toBe(2);
  });

  it("$.gt with schema input dispatches correctly", () => {
    const prog = app({ x: "number" }, ($) => $.gt($.input.x, 10));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("ord/gt");
    expect(ast.result.operand.kind).toBe("num/compare");
  });
});

describe("ord: error cases", () => {
  it("throws when no ord impl for inferred type", () => {
    const app = ilo(ord);
    expect(() => app(($) => $.gt(1, 2))).toThrow(/No ord implementation for type/);
  });
});
```

**Step 2: Create ord interpreter tests**

`tests/plugins/ord/interpreter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { ord } from "../../../src/plugins/ord";
import { ordInterpreter } from "../../../src/plugins/ord/interpreter";

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = composeInterpreters([coreInterpreter, numInterpreter, ordInterpreter]);
  return interp(ast.result);
}

const app = ilo(num, ord);

describe("ord interpreter: compare", () => {
  it("compare(3, 5) → -1", () => expect(run(app(($) => $.compare(3, 5)))).toBe(-1));
  it("compare(5, 5) → 0", () => expect(run(app(($) => $.compare(5, 5)))).toBe(0));
  it("compare(5, 3) → 1", () => expect(run(app(($) => $.compare(5, 3)))).toBe(1));
});

describe("ord interpreter: derived comparisons", () => {
  it("gt true", () => expect(run(app(($) => $.gt(5, 3)))).toBe(true));
  it("gt false", () => expect(run(app(($) => $.gt(3, 5)))).toBe(false));
  it("gt equal", () => expect(run(app(($) => $.gt(5, 5)))).toBe(false));
  it("gte true", () => expect(run(app(($) => $.gte(5, 5)))).toBe(true));
  it("gte false", () => expect(run(app(($) => $.gte(3, 5)))).toBe(false));
  it("lt true", () => expect(run(app(($) => $.lt(3, 5)))).toBe(true));
  it("lt false", () => expect(run(app(($) => $.lt(5, 3)))).toBe(false));
  it("lte true", () => expect(run(app(($) => $.lte(5, 5)))).toBe(true));
  it("lte false", () => expect(run(app(($) => $.lte(5, 3)))).toBe(false));
});

describe("ord interpreter: with input", () => {
  it("$.gt($.input.x, $.input.y)", () => {
    const prog = app({ x: "number", y: "number" }, ($) => $.gt($.input.x, $.input.y));
    expect(run(prog, { x: 10, y: 5 })).toBe(true);
    expect(run(prog, { x: 5, y: 10 })).toBe(false);
  });
});
```

**Step 3: Create semiring AST tests**

`tests/plugins/semiring/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ilo } from "../../../src/core";
import { num } from "../../../src/plugins/num";
import { semiring } from "../../../src/plugins/semiring";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("semiring: dispatch to num", () => {
  const app = ilo(num, semiring);

  it("$.add(literal, literal) dispatches to num/add", () => {
    const prog = app(($) => $.add(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/add");
    expect(ast.result.left.value).toBe(1);
    expect(ast.result.right.value).toBe(2);
  });

  it("$.mul(literal, literal) dispatches to num/mul", () => {
    const prog = app(($) => $.mul(3, 4));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/mul");
  });

  it("$.add with schema input dispatches to num/add", () => {
    const prog = app({ x: "number" }, ($) => $.add($.input.x, 5));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/add");
  });

  it("auto-lifts raw numbers", () => {
    const prog = app(($) => $.add(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.left.kind).toBe("core/literal");
    expect(ast.result.right.kind).toBe("core/literal");
  });
});

describe("semiring: error cases", () => {
  it("throws when no semiring impl for inferred type", () => {
    const app = ilo(semiring);
    expect(() => app(($) => $.add(1, 2))).toThrow(/No semiring implementation for type/);
  });
});
```

**Step 4: Create semiring interpreter tests**

`tests/plugins/semiring/interpreter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { semiring } from "../../../src/plugins/semiring";

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = composeInterpreters([coreInterpreter, numInterpreter]);
  return interp(ast.result);
}

const app = ilo(num, semiring);

describe("semiring interpreter: arithmetic", () => {
  it("add", () => expect(run(app(($) => $.add(3, 4)))).toBe(7));
  it("mul", () => expect(run(app(($) => $.mul(3, 4)))).toBe(12));
});

describe("semiring interpreter: with input", () => {
  it("$.add($.input.x, $.input.y)", () => {
    const prog = app({ x: "number", y: "number" }, ($) => $.add($.input.x, $.input.y));
    expect(run(prog, { x: 10, y: 20 })).toBe(30);
  });
});
```

**Step 5: Create heytingAlgebra AST tests**

`tests/plugins/heyting-algebra/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ilo } from "../../../src/core";
import { boolean } from "../../../src/plugins/boolean";
import { eq } from "../../../src/plugins/eq";
import { heytingAlgebra } from "../../../src/plugins/heyting-algebra";
import { num } from "../../../src/plugins/num";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

const app = ilo(num, boolean, eq, heytingAlgebra);

describe("heytingAlgebra: $.and()", () => {
  it("produces boolean/and", () => {
    const prog = app({ x: "number", y: "number" }, ($) =>
      $.and($.eq($.input.x, 1), $.eq($.input.y, 2)),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/and");
    expect(ast.result.left.kind).toBe("num/eq");
    expect(ast.result.right.kind).toBe("num/eq");
  });
});

describe("heytingAlgebra: $.or()", () => {
  it("produces boolean/or", () => {
    const prog = app({ x: "number", y: "number" }, ($) =>
      $.or($.eq($.input.x, 1), $.eq($.input.y, 2)),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/or");
  });
});

describe("heytingAlgebra: $.not()", () => {
  it("produces boolean/not", () => {
    const prog = app({ x: "number" }, ($) => $.not($.eq($.input.x, 1)));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/not");
    expect(ast.result.operand.kind).toBe("num/eq");
  });
});

describe("heytingAlgebra: trait declaration", () => {
  it("boolean declares heytingAlgebra trait", () => {
    expect(boolean.traits?.heytingAlgebra).toBeDefined();
    expect(boolean.traits?.heytingAlgebra?.type).toBe("boolean");
    expect(boolean.traits?.heytingAlgebra?.nodeKinds.conj).toBe("boolean/and");
    expect(boolean.traits?.heytingAlgebra?.nodeKinds.disj).toBe("boolean/or");
    expect(boolean.traits?.heytingAlgebra?.nodeKinds.not).toBe("boolean/not");
  });
});
```

**Step 6: Create heytingAlgebra interpreter tests**

`tests/plugins/heyting-algebra/interpreter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { boolean } from "../../../src/plugins/boolean";
import { booleanInterpreter } from "../../../src/plugins/boolean/interpreter";
import { eq } from "../../../src/plugins/eq";
import { heytingAlgebra } from "../../../src/plugins/heyting-algebra";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = composeInterpreters([coreInterpreter, numInterpreter, booleanInterpreter]);
  return interp(ast.result);
}

const app = ilo(num, boolean, eq, heytingAlgebra);

describe("heytingAlgebra interpreter", () => {
  it("and true", () => {
    const prog = app(($) => $.and($.eq(1, 1), $.eq(2, 2)));
    expect(run(prog)).toBe(true);
  });

  it("and false", () => {
    const prog = app(($) => $.and($.eq(1, 1), $.eq(1, 2)));
    expect(run(prog)).toBe(false);
  });

  it("or true", () => {
    const prog = app(($) => $.or($.eq(1, 2), $.eq(2, 2)));
    expect(run(prog)).toBe(true);
  });

  it("or false", () => {
    const prog = app(($) => $.or($.eq(1, 2), $.eq(3, 4)));
    expect(run(prog)).toBe(false);
  });

  it("not true", () => {
    const prog = app(($) => $.not($.eq(1, 2)));
    expect(run(prog)).toBe(true);
  });

  it("not false", () => {
    const prog = app(($) => $.not($.eq(1, 1)));
    expect(run(prog)).toBe(false);
  });
});
```

**Step 7: Add neq tests to eq test files**

Append to `tests/plugins/eq/index.test.ts`:

```ts
// Add to existing file:

describe("eq: neq dispatch", () => {
  const app = ilo(num, eq);

  it("$.neq(literal, literal) wraps num/eq in eq/neq", () => {
    const prog = app(($) => $.neq(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("eq/neq");
    expect(ast.result.inner.kind).toBe("num/eq");
    expect(ast.result.inner.left.value).toBe(1);
    expect(ast.result.inner.right.value).toBe(2);
  });
});
```

Append to `tests/plugins/eq/interpreter.test.ts`:

```ts
// Add eqInterpreter import and to fragments array, then add:

describe("eq interpretation: neq", () => {
  const app = ilo(num, eq);

  it("neq(1, 2) → true", () => {
    const prog = app(($) => $.neq(1, 2));
    expect(run(prog)).toBe(true);
  });

  it("neq(42, 42) → false", () => {
    const prog = app(($) => $.neq(42, 42));
    expect(run(prog)).toBe(false);
  });
});
```

**Step 8: Run all tests**

Run: `npm test`
Expected: All tests pass (old + new)

**Step 9: Commit**

```bash
git add tests/
git commit -m "test: add ord, semiring, heytingAlgebra, and neq tests"
```

---

### Task 7: Final validation

**Step 1: Full build + check + test**

Run: `npm run build && npm run check && npm test`
Expected: All pass, no errors

**Step 2: Update plugin-authoring-guide.ts if needed**

Check if `src/plugin-authoring-guide.ts` references the old `TraitImpl.nodeKind` format. If so, update to `nodeKinds`.

**Step 3: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "chore: final cleanup for broader typeclass hierarchy"
```

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `src/core.ts` (TraitImpl, PluginDefinition.traits) |
| Create | `src/trait-utils.ts` (inferType, resolveSchemaType) |
| Modify | `src/plugins/eq/index.ts` (import trait-utils, add neq) |
| Create | `src/plugins/eq/interpreter.ts` (eq/neq handler) |
| Modify | `src/plugins/num/index.ts` (remove migrated methods, add trait registrations) |
| Modify | `src/plugins/num/interpreter.ts` (add compare/zero/one, remove gt/gte/lt/lte) |
| Modify | `src/plugins/boolean/index.ts` (empty methods, add heytingAlgebra trait) |
| Modify | `src/plugins/boolean/interpreter.ts` (add ff/tt/implies) |
| Modify | `src/plugins/str/index.ts` (trait format update) |
| Create | `src/plugins/ord/index.ts` |
| Create | `src/plugins/ord/interpreter.ts` |
| Create | `src/plugins/semiring/index.ts` |
| Create | `src/plugins/heyting-algebra/index.ts` |
| Modify | `src/index.ts` (new exports) |
| Modify | `tests/core.test.ts` |
| Modify | `tests/rec.test.ts` |
| Modify | `tests/composition.test.ts` |
| Modify | `tests/plugins/num/index.test.ts` |
| Modify | `tests/plugins/num/interpreter.test.ts` |
| Modify | `tests/plugins/boolean/index.test.ts` |
| Modify | `tests/plugins/eq/index.test.ts` |
| Modify | `tests/plugins/eq/interpreter.test.ts` |
| Create | `tests/plugins/ord/index.test.ts` |
| Create | `tests/plugins/ord/interpreter.test.ts` |
| Create | `tests/plugins/semiring/index.test.ts` |
| Create | `tests/plugins/semiring/interpreter.test.ts` |
| Create | `tests/plugins/heyting-algebra/index.test.ts` |
| Create | `tests/plugins/heyting-algebra/interpreter.test.ts` |
