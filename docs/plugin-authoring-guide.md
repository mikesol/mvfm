# How to Write an Ilo Plugin

This guide is the single source of truth for building ilo plugins. Every plugin — whether built by a human or an LLM agent — must follow these patterns exactly. The audience is LLM agents generating plugins. The guide is exhaustive and unambiguous by design.

## Two plugin types

**Ilo-native plugins** (num, str, eq, boolean, ord, semigroup, semiring, monoid, show, etc.) implement operations that are part of ilo itself. They have no external dependencies, no upstream version to track, and live at `src/plugins/<name>/index.ts`.

**External-service plugins** (postgres, stripe, redis, etc.) wrap a real-world library or API. They track a specific upstream version, require source-level analysis of the real library before any code is written, and live at `src/plugins/<name>/<version>/index.ts`.

The distinction matters because external-service plugins have additional requirements: version directories, SDK adapters, server/client handlers, integration tests, and the source-level analysis described in Step 0.

---

## Step 0: Source-Level Analysis (external-service plugins only)

Before writing any plugin code for an external service, you must understand the real library by reading its source — not its documentation.

1. **Clone the upstream repo at the exact version tag you are targeting:**

   ```bash
   git clone --branch v3.4.8 --depth 1 https://github.com/porsager/postgres.git /tmp/postgres-3.4.8
   ```

   The version tag becomes the directory name in `src/plugins/<name>/<version>/`. This is not negotiable — the filesystem is the version registry.

2. **Read the actual source code.** Not the README. Not the docs site. The implementation.
   - Find the main entry point and trace the public API surface
   - Read resource definitions, request handling, error types, encoding logic
   - Identify the underlying protocol: is it pure request-response, or does it have stateful/nested scoping (transactions, cursors, subscriptions)?

3. **Build an honest assessment matrix.** For every operation in the upstream API, classify it:

   | Category | Meaning | Example |
   |----------|---------|---------|
   | **Maps cleanly** | 1:1 mapping to an ilo AST node | Stripe `paymentIntents.create()` — pure request-response |
   | **Needs deviation** | Modelable but ilo's API must differ from upstream (document why) | postgres.js `sql(identifier)` — ilo uses `$.sql.id()` because `sql` is already the tagged template |
   | **Can't model** | Fundamentally incompatible with a finite, inspectable AST | postgres.js LISTEN/NOTIFY — push-based, no request-response shape |

4. **Document the assessment** in the plugin's `index.ts` header comment. Every external-service plugin must have an implementation status header and an honest assessment section. See `src/plugins/postgres/3.4.8/index.ts` and `src/plugins/stripe/2025-04-30.basil/index.ts` for the reference format.

> **Docs lie. Source doesn't.** An agent that reads the postgres.js README will miss edge cases in `src/types.js` and `src/connection.js`. An agent that reads the Stripe API docs will not discover that `rawRequest()` encodes GET and POST parameters differently. The assessment must come from source.

### Scoping: how much to implement

After completing the assessment matrix, decide how much of the upstream API to port. Classify the plugin by the size of its modelable API surface (excluding anything in the "can't model" category):

| Size | Modelable operations | Implementation strategy | Example |
|------|---------------------|------------------------|---------|
| **Small** | < 15 distinct operations | Implement 100% in one pass | postgres (queries, transactions, savepoints, cursors) |
| **Medium** | 15–50 operations | Two passes: 75% core operations, then 25% long tail | — |
| **Large** | 50+ operations | Three passes following a 60/30/10 rule | Stripe (57 top-level resources, each with CRUD methods) |

**The 60/30/10 rule for large plugins:**
1. **Pass 1 (60%):** The operations that cover 60% of real-world usage. Pick the resources/methods that most users reach for first. The goal is a plugin that's useful for the majority of use cases. This pass must also prove the architecture — if the plugin needs multiple effect types, handler patterns, or SDK adapter quirks, they must surface here.
2. **Pass 2 (30%):** The next tier of operations. Same patterns, less common resources. No architectural changes expected — just more switch cases.
3. **Pass 3 (10%):** The long tail. Rarely-used resources, edge-case operations. Mechanical additions.

**The 75/25 rule for medium plugins:**
1. **Pass 1 (75%):** Core operations covering most usage plus architecture validation.
2. **Pass 2 (25%):** Remaining operations.

**Document the sizing decision in `index.ts`.** After the implementation status line, add a plugin size line:

```ts
// Plugin size: SMALL — fully implemented modulo known limitations
// Plugin size: MEDIUM — at pass 1 of 75/25 split
// Plugin size: LARGE — at pass 1 of 60/30/10 split (3 of 57 resources)
```

This tells future authors (and agents) where the plugin is in its lifecycle and how much work remains.

---

## Step 1: Directory Structure

Create the directory layout before writing any code. The layout differs by plugin type. Do not deviate from these structures.

### Ilo-native plugins

Ilo-native plugins are unversioned. They live directly under `src/plugins/<name>/`:

```
src/plugins/<name>/
  index.ts           # PluginDefinition + types
  interpreter.ts     # InterpreterFragment
```

Tests mirror the source layout under `tests/`:

```
tests/plugins/<name>/
  index.test.ts           # AST construction tests
  interpreter.test.ts     # Interpreter evaluation tests
```

Real examples from the codebase:

```
src/plugins/num/
  index.ts
  interpreter.ts

tests/plugins/num/
  index.test.ts
  interpreter.test.ts
```

```
src/plugins/eq/
  index.ts
  interpreter.ts

tests/plugins/eq/
  index.test.ts
  interpreter.test.ts
```

Not every ilo-native plugin has an interpreter yet. Some (like `bounded`, `semigroup`, `semiring`) only have `index.ts`. At minimum, create `index.ts`. Add `interpreter.ts` when the plugin has runtime behavior to implement.

### External-service plugins

External-service plugins are versioned. The upstream package version is the directory name. Every file lives under `src/plugins/<name>/<version>/`:

```
src/plugins/<name>/<version>/
  index.ts            # PluginDefinition + types
  interpreter.ts      # Generator-based interpreter fragment (const, not factory)
  handler.server.ts   # Server-side StepHandler (wraps native SDK)
  handler.client.ts   # Client-side StepHandler (proxies over HTTP)
  client-<sdk>.ts     # SDK adapter (wraps real SDK into internal interface)
```

Tests:

```
tests/plugins/<name>/<version>/
  index.test.ts           # AST construction tests
  interpreter.test.ts     # Effect-yielding tests with mock handlers
  integration.test.ts     # Real SDK tests against containers/mocks
```

Real examples from the codebase:

```
src/plugins/postgres/3.4.8/
  index.ts
  interpreter.ts
  handler.server.ts
  handler.client.ts
  client-postgres-js.ts

tests/plugins/postgres/3.4.8/
  index.test.ts
  interpreter.test.ts
  round-trip.test.ts
```

```
src/plugins/stripe/2025-04-30.basil/
  index.ts
  interpreter.ts
  handler.server.ts
  handler.client.ts
  client-stripe-sdk.ts

tests/plugins/stripe/2025-04-30.basil/
  index.test.ts
  interpreter.test.ts
  integration.test.ts
```

### File purposes

| File | Purpose |
|------|---------|
| `index.ts` | Exports the `PluginDefinition`, all AST node types, and the public builder API. This is the only file other plugins import from. |
| `interpreter.ts` | Exports the `InterpreterFragment` — a const (not a factory function) that maps node kinds to generator functions. Each generator yields effects or returns values. |
| `handler.server.ts` | Server-side `StepHandler` that calls the real SDK. Runs in a trusted environment with credentials. |
| `handler.client.ts` | Client-side `StepHandler` that serializes effects and proxies them over HTTP to the server handler. |
| `client-<sdk>.ts` | Thin adapter that wraps the real SDK (e.g., `postgres` or `stripe`) into an internal interface the handler consumes. Isolates SDK-specific types from ilo's handler logic. |

### Versioning rules

1. **Ilo-native plugins are unversioned.** They live at `src/plugins/<name>/` with no version directory. Their API is ilo's API — it evolves with the project.

2. **External-service plugins use the upstream version as the directory name.** When postgres.js ships v3.5.0, create a new directory `src/plugins/postgres/3.5.0/` — do not patch `3.4.8/`. The filesystem is the version registry.

3. **The version string is the upstream package version, exactly as published.** For postgres.js v3.4.8, the directory is `3.4.8/`. For Stripe API version `2025-04-30.basil`, the directory is `2025-04-30.basil/`. No normalization, no prefix stripping.

4. **Old versions are never deleted.** A program compiled against postgres 3.4.8 must keep working. New versions are additive.

5. **Cross-version imports are forbidden.** `postgres/3.5.0/` must not import from `postgres/3.4.8/`. Each version directory is self-contained. Shared logic between versions means the shared logic should be extracted into an ilo-native plugin.

---

## Step 2: Plugin Definition

Every plugin is a `PluginDefinition<T>`. This is the contract. No exceptions.

### The interface

From `src/core.ts`:

```ts
export interface PluginDefinition<T = any> {
  name: string;           // unique namespace prefix
  nodeKinds: string[];    // every AST node kind this plugin emits
  build: (ctx: PluginContext) => T;  // returns what goes on $
  traits?: {              // optional typeclass implementations
    eq?: TraitImpl;
    ord?: TraitImpl;
    semiring?: TraitImpl;
    heytingAlgebra?: TraitImpl;
    show?: TraitImpl;
    semigroup?: TraitImpl;
    monoid?: TraitImpl;
    bounded?: TraitImpl;
  };
}
```

Three required fields:

- **`name`** — A unique string that becomes the namespace prefix for this plugin's AST node kinds. For `num`, the prefix is `"num"`. For `stripe`, the prefix is `"stripe"`. Every node kind emitted by the plugin must start with `name/`.

- **`nodeKinds`** — An exhaustive list of every AST node `kind` string this plugin can emit. The interpreter uses this for dispatch; the build system uses it for validation. If a node kind is missing from this list, it is a bug.

- **`build(ctx)`** — A function that receives a `PluginContext` and returns an object of type `T`. That object is spread onto `$`. If your plugin adds `{ sub, div, mod }`, then the program closure sees `$.sub()`, `$.div()`, `$.mod()`.

The optional **`traits`** field registers typeclass implementations. This is how the `eq`, `ord`, `semiring`, etc. plugins discover that `num` provides equality for numbers or that `str` provides a semigroup for strings. See Step 5 (when written) for details.

### PluginContext methods

The `PluginContext` object passed to `build()` is your only interface to the ilo runtime. These are its methods and fields:

| Method / Field | Signature | Purpose |
|---|---|---|
| `ctx.expr<T>(node)` | `<T>(node: ASTNode) => Expr<T>` | Wrap an AST node as an `Expr<T>`. This is how you create DSL values. The returned `Expr` is a Proxy that supports property access and method chaining. |
| `ctx.lift(value)` | `<T>(value: T \| Expr<T>) => Expr<T>` | Auto-lift a raw JS value to `Expr` if it is not already one. Handles primitives (number, string, boolean, null), arrays (to `core/tuple`), and objects (to `core/record`). If the value is already an `Expr`, returns it unchanged. |
| `ctx.isExpr(value)` | `(value: unknown) => value is Expr<unknown>` | Type guard that checks whether a value is already an `Expr`. Useful when you need to branch on whether an argument was passed as a raw value or a DSL expression. |
| `ctx.emit(node)` | `(node: ASTNode) => void` | Add a statement-level AST node to the program. Used for side effects that do not produce a return value. |
| `ctx.statements` | `ASTNode[]` | The current program's statement list. Nodes added via `ctx.emit()` appear here. |
| `ctx.plugins` | `PluginDefinition[]` | All resolved plugin definitions loaded in this program. Used by typeclass plugins (eq, ord, etc.) to find trait implementations at build time. |

There are also internal fields (`ctx._registry`, `ctx.inputSchema`) that plugins should not use directly.

### Code example: stripe plugin (configured, factory function)

This is the real stripe plugin from `src/plugins/stripe/2025-04-30.basil/index.ts`, simplified to show the essential pattern:

```ts
import type { Expr, PluginContext, PluginDefinition } from "../../../core";

export interface StripeConfig {
  apiKey: string;
  apiVersion?: string;
}

export interface StripeMethods {
  stripe: {
    paymentIntents: {
      create(params: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;
      retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;
      confirm(id: Expr<string> | string, params?: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;
    };
    customers: {
      create(params: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;
      retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;
      update(id: Expr<string> | string, params: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;
      list(params?: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;
    };
    // ... charges, etc.
  };
}

export function stripe(config: StripeConfig): PluginDefinition<StripeMethods> {
  return {
    name: "stripe",
    nodeKinds: [
      "stripe/create_payment_intent",
      "stripe/retrieve_payment_intent",
      "stripe/confirm_payment_intent",
      "stripe/create_customer",
      "stripe/retrieve_customer",
      "stripe/update_customer",
      "stripe/list_customers",
      // ...
    ],

    build(ctx: PluginContext): StripeMethods {
      function resolveId(id: Expr<string> | string) {
        return ctx.isExpr(id) ? id.__node : ctx.lift(id).__node;
      }

      function resolveParams(params: Expr<Record<string, unknown>> | Record<string, unknown>) {
        return ctx.lift(params).__node;
      }

      return {
        stripe: {
          paymentIntents: {
            create(params) {
              return ctx.expr({
                kind: "stripe/create_payment_intent",
                params: resolveParams(params),
                config,  // baked into the AST node
              });
            },
            retrieve(id) {
              return ctx.expr({
                kind: "stripe/retrieve_payment_intent",
                id: resolveId(id),
                config,
              });
            },
            confirm(id, params?) {
              return ctx.expr({
                kind: "stripe/confirm_payment_intent",
                id: resolveId(id),
                params: params != null ? resolveParams(params) : null,
                config,
              });
            },
          },
          customers: {
            create(params) {
              return ctx.expr({
                kind: "stripe/create_customer",
                params: resolveParams(params),
                config,
              });
            },
            // ... retrieve, update, list follow the same pattern
          },
        },
      };
    },
  };
}
```

Key things to notice:

1. `stripe` is a **function** that takes `StripeConfig` and returns `PluginDefinition<StripeMethods>`. The config is captured in the closure and baked into every AST node.
2. Every node kind is prefixed with `stripe/`.
3. Every method parameter accepts `Expr<T> | T` and uses `ctx.lift()` or `ctx.isExpr()` to normalize.
4. `config` is stored directly on each AST node — the AST is self-contained.
5. `build()` only constructs and returns an object of methods. No side effects.

### Code example: num plugin (unconfigured, const)

This is the real num plugin from `src/plugins/num/index.ts`, simplified:

```ts
import type { Expr, PluginContext, PluginDefinition } from "../../core";

export interface NumMethods {
  sub(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  div(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  mod(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  neg(a: Expr<number> | number): Expr<number>;
  abs(a: Expr<number> | number): Expr<number>;
  // ...
}

export const num: PluginDefinition<NumMethods> = {
  name: "num",
  nodeKinds: [
    "num/add", "num/sub", "num/mul", "num/div", "num/mod",
    "num/neg", "num/abs", "num/floor", "num/ceil", "num/round",
    "num/min", "num/max", "num/eq", "num/zero", "num/one",
    "num/show", "num/top", "num/bottom",
    // ...
  ],
  traits: {
    eq: { type: "number", nodeKinds: { eq: "num/eq" } },
    ord: { type: "number", nodeKinds: { compare: "num/compare" } },
    semiring: {
      type: "number",
      nodeKinds: { add: "num/add", zero: "num/zero", mul: "num/mul", one: "num/one" },
    },
    show: { type: "number", nodeKinds: { show: "num/show" } },
    bounded: { type: "number", nodeKinds: { top: "num/top", bottom: "num/bottom" } },
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
      // ...
    };
  },
};
```

Key difference: `num` is a **const**, not a factory function. It needs no configuration, so it is directly a `PluginDefinition`. No wrapper function, no config parameter.

### The six rules

Every plugin must follow these rules. Violating any of them is a build error, a runtime bug, or an architectural regression.

**1. Namespace your node kinds: `plugin/kind`, not bare `kind`.**

Every AST node kind must be prefixed with the plugin's `name` followed by a slash. The num plugin emits `"num/sub"`, not `"sub"`. The stripe plugin emits `"stripe/create_payment_intent"`, not `"create_payment_intent"`. This prevents collisions between plugins and makes the AST self-documenting — you can tell which plugin owns a node by reading its kind.

**2. `nodeKinds` must list every kind the plugin emits.**

If your `build()` function calls `ctx.expr({ kind: "my/foo" })`, then `"my/foo"` must appear in the `nodeKinds` array. The interpreter uses `nodeKinds` to route evaluation. A missing entry means the node will not be interpreted and the program will fail at runtime.

**3. Accept `Expr<T> | T` for all parameters — use `ctx.lift()` to normalize.**

Every method parameter that could be either a raw JS value or an existing DSL expression must accept the union type `Expr<T> | T`. Inside the method body, call `ctx.lift(value)` to normalize both cases into an `Expr<T>`. This is what makes `$.sub(1, 2)` and `$.sub($.input.x, $.input.y)` both work.

**4. Bake config into AST nodes — AST must be self-contained.**

If your plugin requires configuration (API keys, connection strings, options), store the config directly on each AST node. The stripe plugin stores `config` on every `stripe/*` node. This makes the AST portable — an interpreter can evaluate the program without having access to the original plugin closure. Never rely on closure-captured state that is not part of the AST.

**5. Keep `build()` pure — no side effects.**

`build()` must only construct and return an object of builder methods. It must not make HTTP requests, write to files, log to console, or mutate shared state. The methods it returns must only create AST nodes (via `ctx.expr()`) or record statements (via `ctx.emit()`). Everything else happens at interpretation time, not build time.

**6. Return `Expr<T>` with accurate types.**

Every builder method must return `Expr<T>` where `T` accurately reflects the type of the value the expression will produce at runtime. If a method computes a number, it returns `Expr<number>`. If it computes a string, it returns `Expr<string>`. This is what gives the DSL its type safety — the TypeScript compiler checks that you do not pass an `Expr<string>` where an `Expr<number>` is expected.

### Config pattern: configured vs. unconfigured plugins

Ilo plugins come in two shapes:

**Unconfigured plugins** need no configuration. They are exported as a `const` that IS the `PluginDefinition`:

```ts
// num IS a PluginDefinition — no function call needed
export const num: PluginDefinition<NumMethods> = {
  name: "num",
  nodeKinds: [...],
  build(ctx) { ... },
};
```

**Configured plugins** need runtime configuration. They are exported as a factory function that RETURNS a `PluginDefinition`:

```ts
// stripe is a function that returns a PluginDefinition
export function stripe(config: StripeConfig): PluginDefinition<StripeMethods> {
  return {
    name: "stripe",
    nodeKinds: [...],
    build(ctx) { ... },
  };
}
```

The `ilo()` entry point accepts both forms. You compose plugins by passing them as arguments:

```ts
import { ilo, num, str } from "ilo";
import { stripe } from "ilo/plugins/stripe/2025-04-30.basil";

const app = ilo(num, str, stripe({ apiKey: "sk_test_..." }));

const program = app(($) => {
  const customer = $.stripe.customers.create({ email: "alice@example.com" });
  const total = $.sub($.input.price, $.input.discount);
  return $.do(customer, total);
});
```

Notice the difference: `num` and `str` are passed directly (they are already `PluginDefinition` values). `stripe({ apiKey: "..." })` is called first to produce a `PluginDefinition`. Both end up as the same type by the time `ilo()` sees them.

---

## Step 3: Interpreter Fragment

The interpreter fragment is where a plugin defines runtime behavior. Step 2 builds AST nodes; Step 3 evaluates them. This is the most important part of a plugin — get it wrong and the program silently produces incorrect results.

### The InterpreterFragment interface

From `src/core.ts`:

```ts
export interface InterpreterFragment {
  pluginName: string;
  canHandle: (node: ASTNode) => boolean;
  visit: (node: ASTNode) => Generator<StepEffect, unknown, unknown>;
  isVolatile?: (node: ASTNode) => boolean;
}
```

Four fields:

- **`pluginName`** — Must match the plugin's `name` from the `PluginDefinition`. Used for diagnostics and tracing.

- **`canHandle(node)`** — Returns `true` if this fragment knows how to evaluate the given node. The standard pattern is `node.kind.startsWith("pluginName/")`. The evaluator calls `canHandle` on each fragment in order until one matches. If none match, evaluation throws.

- **`visit(node)`** — A **sync generator** (not async, not a regular function) that evaluates the node. It yields effects and receives resolved values back. The generator's return value is the result of evaluating the node.

- **`isVolatile(node)`** — Optional. Returns `true` if the node must never be cached. Used for nodes whose value changes between evaluations (lambda parameters, cursor batch data). See the volatility section below.

### The generator contract

`visit()` is a sync generator function (`*visit`, not `async *visit`). It communicates with the evaluator by yielding `StepEffect` objects and receiving resolved values:

**To recurse into a child node:**

```ts
const result = yield { type: "recurse", child: childNode };
```

The evaluator pauses the generator, evaluates `childNode` (which may itself yield effects), and feeds the result back as the return value of `yield`. This is how the interpreter traverses the AST without explicit recursion.

**To perform IO:**

```ts
const response = yield { type: "stripe/api_call", method: "POST", path: "/v1/customers", params };
```

Yield an effect with a plugin-specific `type` string. The evaluator delegates this to the registered `StepHandler` for that effect type. The handler executes the real IO (API call, database query, etc.) and returns the result, which the generator receives back from `yield`.

**To return a final value:**

```ts
return someValue;
```

When the generator returns (via `return`), evaluation of this node is complete. The returned value is cached (unless the node is volatile) and fed to the parent generator that yielded the `recurse` effect.

### The StepEffect type

From `src/core.ts`:

```ts
export type StepEffect =
  | { type: "recurse"; child: ASTNode }
  | { type: string; [key: string]: unknown };
```

Every effect has a `type` string. The `"recurse"` type is built-in — the evaluator handles it automatically by descending into the child node. All other type strings are plugin-defined IO effects that get routed to a `StepHandler`.

### Example: stripe interpreter (uniform effect)

The stripe interpreter is the simplest pattern. Every node yields `recurse` effects to resolve its parameters, then yields exactly one `stripe/api_call` effect. From `src/plugins/stripe/2025-04-30.basil/interpreter.ts`:

```ts
export const stripeInterpreter: InterpreterFragment = {
  pluginName: "stripe",
  canHandle: (node) => node.kind.startsWith("stripe/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "stripe/create_payment_intent": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: "/v1/payment_intents",
          params,
        };
      }

      case "stripe/retrieve_payment_intent": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: `/v1/payment_intents/${id}`,
        };
      }

      case "stripe/confirm_payment_intent": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: `/v1/payment_intents/${id}/confirm`,
          ...(params !== undefined ? { params } : {}),
        };
      }

      // ... remaining cases follow the same pattern

      default:
        throw new Error(`Stripe interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

Key things to notice:

1. **It is a `const`, not a factory function.** The interpreter has no configuration — it translates AST structure into effects. Configuration lives on the AST nodes (baked in during `build()`), not in the interpreter.
2. **Every case recurses first, then yields IO.** The pattern is always: resolve child nodes via `recurse`, then yield one `stripe/api_call` effect with the resolved values.
3. **One effect type for everything.** All stripe operations use `stripe/api_call` with varying `method` and `path`. The handler doesn't need to know which stripe operation it is — it just makes the HTTP request.
4. **Optional parameters are guarded.** `confirm_payment_intent` checks `node.params != null` before recursing. If the param wasn't provided at build time, it doesn't recurse.

### Helper generators with `yield*`

When SQL construction requires inline resolution of sub-expressions, use a helper generator and delegate to it with `yield*`. From `src/plugins/postgres/3.4.8/interpreter.ts`:

```ts
function* buildSQL(node: ASTNode): Generator<StepEffect, BuiltQuery, unknown> {
  const strings = node.strings as string[];
  const paramNodes = node.params as ASTNode[];
  let sql = "";
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < paramNodes.length) {
      const param = paramNodes[i];
      if (param.kind === "postgres/identifier") {
        const name = (yield { type: "recurse", child: param.name as ASTNode }) as string;
        sql += escapeIdentifier(name);
      } else if (param.kind === "postgres/insert_helper") {
        const data = (yield { type: "recurse", child: param.data as ASTNode }) as
          | Record<string, unknown>
          | Record<string, unknown>[];
        const columns =
          (param.columns as string[] | null) ?? Object.keys(Array.isArray(data) ? data[0] : data);
        const rows = Array.isArray(data) ? data : [data];
        sql +=
          "(" +
          columns.map(escapeIdentifier).join(",") +
          ") values " +
          rows
            .map(
              (row) =>
                "(" +
                columns
                  .map((col) => {
                    params.push(row[col]);
                    return `$${params.length}`;
                  })
                  .join(",") +
                ")",
            )
            .join(",");
      } else {
        // Regular parameter -- recurse to get the value
        params.push(yield { type: "recurse", child: param });
        sql += `$${params.length}`;
      }
    }
  }

  return { sql, params };
}
```

The postgres interpreter calls this helper with `yield*`:

```ts
export const postgresInterpreter: InterpreterFragment = {
  pluginName: "postgres",
  canHandle: (node) => node.kind.startsWith("postgres/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "postgres/query": {
        const { sql, params } = yield* buildSQL(node);
        return yield { type: "query", sql, params };
      }

      case "postgres/cursor": {
        const queryNode = node.query as ASTNode;
        const { sql, params } = yield* buildSQL(queryNode);
        const batchSize = (yield { type: "recurse", child: node.batchSize as ASTNode }) as number;
        return yield {
          type: "cursor",
          sql,
          params,
          batchSize,
          body: node.body as ASTNode,
        };
      }

      // ...
    }
  },
  isVolatile: (node) => node.kind === "postgres/cursor_batch",
};
```

`yield*` delegates to the helper generator. Every `yield` inside `buildSQL` passes through to the evaluator as if the `visit` generator had yielded it directly. The helper's return value becomes the result of the `yield*` expression.

This pattern keeps `visit()` clean when a single node kind requires complex multi-step resolution (like building parameterized SQL from template strings with interleaved sub-expressions).

### `isVolatile` — nodes that must not be cached

The evaluator caches results by AST node identity (WeakMap). Most nodes produce the same value every time — a `core/literal` always returns its value, a `num/add` always returns the sum of its children. But some nodes must produce a different value on each evaluation:

- **`core/lambda_param`** — A lambda parameter's value changes each time the lambda is invoked (e.g., in `map`, `filter`, `reduce`).
- **`postgres/cursor_batch`** — A cursor injects different row batches into this node on each iteration.

The evaluator checks `isVolatile` before caching. If a node is volatile, its result is never cached, and any ancestor node that depends on it is also excluded from caching (taint propagation).

From the postgres interpreter:

```ts
isVolatile: (node) => node.kind === "postgres/cursor_batch",
```

From the core interpreter (`src/interpreters/core.ts`):

```ts
isVolatile: (node) => node.kind === "core/lambda_param",
```

The default volatile check in `src/core.ts` also covers these two kinds as a safety net. Plugin-specific `isVolatile` is additive — if any fragment's `isVolatile` returns `true`, the node is volatile.

**Rule:** If your plugin introduces a node kind whose value can change between evaluations of the same AST (because external data is injected into it), mark it volatile. If you are unsure, it is not volatile — most nodes are deterministic.

### Core nodes are always sync

The core interpreter (`src/interpreters/core.ts`) handles `core/do`, `core/record`, `core/tuple`, `core/cond`, `core/prop_access`, `core/program`, `core/literal`, and `core/input`. These nodes yield only `recurse` effects — they never yield IO effects. They are pure structure: sequencing (`do`), branching (`cond`), field access (`prop_access`), and aggregation (`record`, `tuple`).

This matters for plugin authors because it means:

1. You do not need to handle core node kinds in your interpreter. The `coreInterpreter` handles all of them.
2. When your plugin needs sequencing or branching, rely on the user composing with `$.do()` and `$.cond()` at the DSL level. Your interpreter only needs to handle your own `plugin/kind` nodes.
3. The evaluator composes all fragments (core + plugins) and dispatches by `canHandle`. Your fragment only sees nodes it claims.

### Decision: uniform vs multi-effect

When designing your interpreter, you must decide whether to use one effect type or many. This is a design decision about the service, not the plugin.

**Uniform effect (1 effect type):** Use this for request-response services where every operation has the same shape — send a request, get a response. Stripe is the canonical example:

- Every operation yields `stripe/api_call` with `method`, `path`, and optional `params`.
- The handler makes one HTTP request and returns the response.
- No nesting, no state, no scoping.

**Multi-effect (N effect types):** Use this for stateful protocols where operations have different lifecycles or nesting semantics. Postgres is the canonical example:

- `query` — execute SQL, return rows.
- `begin` — open a transaction scope, evaluate a body within it, commit or rollback.
- `savepoint` — open a nested savepoint within a transaction.
- `cursor` — stream a query in batches, evaluate a body per batch.

The postgres handler must understand each effect type differently: `query` is fire-and-forget, but `begin` creates a scope with a new client (the transaction connection), `savepoint` nests within `begin`, and `cursor` loops with injected data. These are fundamentally different operations, not variations of the same request.

**How to decide:** If every operation in your service is "send a request, get a response" with no scoping or statefulness, use uniform. If some operations create scopes that other operations must execute within (transactions, sessions, subscriptions), use multi-effect. The decision is about the underlying protocol, not about how many API endpoints there are — stripe has dozens of endpoints but one effect type.

### Plugin sequencing: transactions and callbacks

When a multi-effect plugin has scoping (transactions, cursors), the handler — not the interpreter — manages the scope lifecycle. The interpreter yields the scope effect with all the information the handler needs. The handler creates a fresh evaluator for the scoped body.

From `src/plugins/postgres/3.4.8/handler.server.ts`, the `begin` effect handler:

```ts
case "begin": {
  const { mode, body, queries } = effect as {
    type: "begin";
    mode: string;
    body?: ASTNode;
    queries?: ASTNode[];
  };

  return client.begin(async (tx) => {
    // Transactions get a fresh evaluator with a new cache and new client
    const txEval = serverEvaluateInternal(tx, fragments);
    if (mode === "pipeline") {
      const results: unknown[] = [];
      for (const q of queries!) {
        results.push(await txEval(q));
      }
      return results;
    }
    return await txEval(body!);
  });
}
```

Key points:

1. **The interpreter yields the body AST, not its result.** The `begin` case in the interpreter yields `{ type: "begin", body: node.body }` — it passes the unevaluated AST subtree to the handler. The handler decides when and how to evaluate it.
2. **The handler creates a fresh evaluator.** `serverEvaluateInternal(tx, fragments)` creates a new evaluation function with a fresh cache, bound to the transaction client `tx`. Queries inside the transaction execute on the transaction connection, not the top-level connection.
3. **Do not rely on `core/do` for sequencing within scopes.** The handler explicitly loops over `queries` in pipeline mode. The sequencing is the handler's responsibility because it must happen within the transaction callback provided by the database driver.

This pattern generalizes: any time your service has a callback-based scope (database transactions, HTTP sessions, streaming contexts), your interpreter yields the scope effect with the body AST, and your handler evaluates the body within the callback.

---

## Step 4: Effect Handlers (external-service plugins only)

External-service plugins provide three files beyond the plugin definition and interpreter: `handler.server.ts`, `handler.client.ts`, and `client-<sdk>.ts`. This separation enables portability — the same AST and the same interpreter produce the same effects, but different handlers execute those effects in different environments. The server handler calls the real SDK with credentials. The client handler serializes effects as JSON and proxies them over HTTP to a server endpoint. The SDK adapter isolates the real SDK's types and quirks behind a clean internal interface.

### Server handler

The server handler is a function that takes a client (the SDK adapter) and returns a `StepHandler`. It receives effects yielded by the interpreter and executes them against the real service.

**Simple pattern (uniform effect):** When every operation in your service yields a single effect type, the server handler is a single function that pattern-matches on the effect type. From `src/plugins/stripe/2025-04-30.basil/handler.server.ts`:

```ts
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { StripeClient } from "./interpreter";

export function serverHandler(client: StripeClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "stripe/api_call") {
      const { method, path, params } = effect as {
        type: "stripe/api_call";
        method: string;
        path: string;
        params?: Record<string, unknown>;
      };
      const value = await client.request(method, path, params);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}
```

Key things to notice:

1. The handler takes `StripeClient` (the SDK adapter interface), not the real Stripe SDK. This is what makes testing possible — pass a mock client and the handler works the same way.
2. The state type is `void` — stripe operations are stateless request-response. Each call is independent.
3. The handler throws on unrecognized effect types. This is mandatory — silent swallowing of unknown effects causes subtle bugs.
4. The handler returns `{ value, state }`. The `value` is fed back to the interpreter generator as the result of `yield`. The `state` is threaded to the next handler call.

**Complex pattern (multi-effect):** When your service has stateful scoping (transactions, cursors, sessions), the server handler must understand multiple effect types with different lifecycles. The postgres handler in `src/plugins/postgres/3.4.8/handler.server.ts` demonstrates this. Instead of a single `StepHandler`, it builds an internal effect handler that switches on effect type:

```ts
function buildEffectHandler(
  client: PostgresClient,
  fragments: InterpreterFragment[],
  evaluate: (node: ASTNode) => Promise<unknown>,
): (effect: StepEffect, currentNode: ASTNode) => Promise<unknown> {
  return async (effect: StepEffect, _currentNode: ASTNode): Promise<unknown> => {
    switch (effect.type) {
      case "query": {
        const { sql, params } = effect as { type: "query"; sql: string; params: unknown[] };
        return client.query(sql, params);
      }

      case "begin": {
        const { mode, body, queries } = effect as {
          type: "begin";
          mode: string;
          body?: ASTNode;
          queries?: ASTNode[];
        };

        return client.begin(async (tx) => {
          // Transactions get a fresh evaluator with a new cache and new client
          const txEval = serverEvaluateInternal(tx, fragments);
          if (mode === "pipeline") {
            const results: unknown[] = [];
            for (const q of queries!) {
              results.push(await txEval(q));
            }
            return results;
          }
          return await txEval(body!);
        });
      }

      case "savepoint": {
        // Same pattern as begin — fresh evaluator inside the savepoint callback
        const { mode, body, queries } = effect as {
          type: "savepoint";
          mode: string;
          body?: ASTNode;
          queries?: ASTNode[];
        };

        return client.savepoint(async (tx) => {
          const txEval = serverEvaluateInternal(tx, fragments);
          if (mode === "pipeline") {
            const results: unknown[] = [];
            for (const q of queries!) {
              results.push(await txEval(q));
            }
            return results;
          }
          return await txEval(body!);
        });
      }

      case "cursor": {
        const { sql, params, batchSize, body } = effect as {
          type: "cursor";
          sql: string;
          params: unknown[];
          batchSize: number;
          body: ASTNode;
        };

        const batchNode = findCursorBatch(body);

        await client.cursor(sql, params, batchSize, async (rows) => {
          if (batchNode) {
            batchNode.__batchData = rows;
          }
          await evaluate(body);
          return undefined;
        });

        return undefined;
      }

      default:
        throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
    }
  };
}
```

The critical difference from the simple pattern: **scoped effects (`begin`, `savepoint`, `cursor`) create fresh evaluators for nested scopes.** The `serverEvaluateInternal` function builds a new evaluator bound to the transaction client (`tx`), with its own cache. This ensures that queries inside a transaction run on the transaction connection, not the top-level connection. The cursor case is different — it reuses the outer evaluator's shared cache so that results cached outside the cursor body are not re-evaluated on each iteration.

Multi-effect handlers also need `buildEvaluate` — a custom evaluation loop that drives generators and delegates effects to the handler. The postgres handler builds this internally because it needs control over caching and taint propagation across scope boundaries. See `src/plugins/postgres/3.4.8/handler.server.ts` for the full implementation.

### Client handler

The client handler enables browser-side execution. Instead of calling the real SDK, it serializes each effect as JSON and sends it to a server endpoint via HTTP. The server endpoint runs the server handler against the real SDK and returns the result. From `src/plugins/stripe/2025-04-30.basil/handler.client.ts`:

```ts
import type { StepContext, StepEffect, StepHandler } from "../../../core";

export interface ClientHandlerOptions {
  /** Base URL of the server endpoint (e.g., "https://api.example.com"). */
  baseUrl: string;
  /** Contract hash from the program, used for verification. */
  contractHash: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof globalThis.fetch;
  /** Additional headers to include in requests. */
  headers?: Record<string, string>;
}

export interface ClientHandlerState {
  /** The current step index, incremented after each effect. */
  stepIndex: number;
}

export function clientHandler(options: ClientHandlerOptions): StepHandler<ClientHandlerState> {
  const { baseUrl, contractHash, headers = {} } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return async (
    effect: StepEffect,
    context: StepContext,
    state: ClientHandlerState,
  ): Promise<{ value: unknown; state: ClientHandlerState }> => {
    const response = await fetchFn(`${baseUrl}/ilo/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        contractHash,
        stepIndex: state.stepIndex,
        path: context.path,
        effect,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Client handler: server returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { result: unknown };

    return {
      value: data.result,
      state: { stepIndex: state.stepIndex + 1 },
    };
  };
}
```

Key things to notice:

1. **`contractHash`** is sent with every request. The server verifies that the contract hash matches the expected program. This is the 0-trust verification mechanism — the client cannot send arbitrary effects. The server knows exactly which AST produced the effects (identified by hash) and can reject anything that doesn't match. A program's contract hash is derived from its AST, so any modification to the program changes the hash.
2. **`stepIndex`** is a monotonically increasing counter. It tells the server which effect in the program's execution sequence this request corresponds to. Combined with the contract hash, this makes replay attacks detectable — the server knows the exact sequence of effects a valid program will produce.
3. **`context.path`** is the path of node kinds from root to the current node. It gives the server additional structural information for verification.
4. **State is minimal.** The client tracks only `stepIndex`. The server is stateless across requests — each request contains enough information (hash + index + path + effect) for independent verification.
5. **The client handler is plugin-agnostic.** It serializes whatever effects it receives. Both the stripe and postgres client handlers share the same structure because the protocol is the same — only the effects differ.

### SDK adapter

The SDK adapter wraps the real SDK behind an internal interface. This serves two purposes: it isolates handler code from SDK-specific types, and it enables mock clients for testing.

**Define the internal client interface** in `interpreter.ts`. From `src/plugins/stripe/2025-04-30.basil/interpreter.ts`:

```ts
export interface StripeClient {
  /** Execute a Stripe API request and return the parsed response. */
  request(method: string, path: string, params?: Record<string, unknown>): Promise<unknown>;
}
```

This is the interface consumed by `serverHandler`. It knows nothing about the Stripe SDK — it is a generic HTTP-like interface with `method`, `path`, and `params`.

**Wrap the real SDK** in `client-<sdk>.ts`. From `src/plugins/stripe/2025-04-30.basil/client-stripe-sdk.ts`:

```ts
import type Stripe from "stripe";
import type { StripeClient } from "./interpreter";

export function wrapStripeSdk(stripe: Stripe): StripeClient {
  return {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const upperMethod = method.toUpperCase();

      if (upperMethod === "POST") {
        // POST: params go in the request body
        return stripe.rawRequest(upperMethod, path, params ?? undefined);
      }

      // GET/DELETE: encode params as query string
      let finalPath = path;
      if (params && Object.keys(params).length > 0) {
        const qs = new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ).toString();
        finalPath = `${path}?${qs}`;
      }
      return stripe.rawRequest(upperMethod, finalPath);
    },
  };
}
```

Key things to notice:

1. **The adapter handles encoding quirks.** Stripe's `rawRequest()` only accepts body params on POST. For GET and DELETE requests, params must be encoded as query string parameters on the path. This is exactly the kind of protocol quirk that Step 0's source-level analysis should have discovered. The adapter is the right place to handle it — the handler code stays clean.
2. **The SDK type (`Stripe`) appears only in this file.** Neither the handler nor the interpreter imports from `stripe` directly. If the Stripe SDK changes its API in a future version, only this adapter file needs updating.
3. **The adapter function takes a configured SDK instance.** The caller is responsible for constructing the Stripe SDK with the right API key and options. The adapter just bridges the interface.

**Naming convention:** The file is named `client-<sdk>.ts` where `<sdk>` is the npm package name. For Stripe it is `client-stripe-sdk.ts`. For postgres.js it is `client-postgres-js.ts`. If a service has multiple SDK options (e.g., official SDK vs. lightweight HTTP client), each gets its own adapter file.

### `serverEvaluate` wrapper

Every external-service plugin must export a `serverEvaluate` function. This is the top-level entry point for server-side evaluation — it composes the interpreter fragments and server handler into a single async function that takes an AST node and returns the result.

**Simple version (stripe):** From `src/plugins/stripe/2025-04-30.basil/handler.server.ts`:

```ts
export function serverEvaluate(
  client: StripeClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
```

For uniform-effect plugins, `serverEvaluate` is a thin wrapper around `runAST`. It creates the handler and passes it through. The initial state is `undefined` (matching the `void` state type of the handler).

**Complex version (postgres):** From `src/plugins/postgres/3.4.8/handler.server.ts`:

```ts
export function serverEvaluate(
  client: PostgresClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return serverEvaluateInternal(client, fragments);
}
```

For multi-effect plugins, `serverEvaluate` delegates to an internal function (`serverEvaluateInternal`) that builds a custom evaluation loop with its own cache management. The postgres version cannot use `runAST` directly because it needs control over cache sharing across transaction and cursor scopes.

**The contract:** `serverEvaluate` always has the same signature — it takes a client and interpreter fragments, and returns `(root: ASTNode) => Promise<unknown>`. Callers do not need to know whether the plugin uses the simple or complex pattern. Usage looks the same:

```ts
import { stripeInterpreter } from "ilo/plugins/stripe/2025-04-30.basil/interpreter";
import { serverEvaluate } from "ilo/plugins/stripe/2025-04-30.basil/handler.server";
import { wrapStripeSdk } from "ilo/plugins/stripe/2025-04-30.basil/client-stripe-sdk";
import Stripe from "stripe";

const sdk = new Stripe("sk_test_...");
const client = wrapStripeSdk(sdk);
const evaluate = serverEvaluate(client, [coreInterpreter, stripeInterpreter]);

const result = await evaluate(program.ast);
```

### Handler composition

Composition IS the customization mechanism. There is no separate hook interface, no middleware chain, no event emitter. If you need to customize how effects are handled — add logging, add retries, transform parameters, gate access — you compose handlers.

A handler is a function. To add behavior, wrap it:

```ts
function withLogging(inner: StepHandler<void>): StepHandler<void> {
  return async (effect, context, state) => {
    console.log(`Effect: ${effect.type}`, effect);
    const result = await inner(effect, context, state);
    console.log(`Result:`, result.value);
    return result;
  };
}

// Use it:
const handler = withLogging(serverHandler(client));
```

To compose handlers from multiple plugins:

```ts
function composedHandler(
  stripeClient: StripeClient,
  postgresClient: PostgresClient,
  fragments: InterpreterFragment[],
): StepHandler<void> {
  const stripeH = serverHandler(stripeClient);
  const postgresH = postgresServerHandler(postgresClient, fragments);

  return async (effect, context, state) => {
    if (effect.type === "stripe/api_call") {
      return stripeH(effect, context, state);
    }
    // Delegate everything else to postgres
    return postgresH(effect, context, state);
  };
}
```

This is deliberate. Handler composition is simple function composition — no framework, no registration, no lifecycle hooks. The `StepHandler` type is the only abstraction. If you can write a function that matches `(effect, context, state) => Promise<{ value, state }>`, you can customize handling.

---

## Step 5: Traits

Traits are ilo's typeclass system. They let generic plugins (like `eq`, `ord`, `show`) dispatch to the correct type-specific implementation at build time. If your plugin introduces a type that supports equality, ordering, display, or algebraic operations, you declare traits so that the generic plugins can find your implementation.

### When to participate

Declare traits when your plugin introduces a type that should participate in generic operations. The `num` plugin introduces numbers, and numbers support equality, ordering, semiring arithmetic, display, and bounds. The `str` plugin introduces strings, and strings support equality, display, concatenation (semigroup), and empty string (monoid). If your plugin does not introduce a new type (e.g., `stripe` operates on opaque records, not a custom type), you do not need traits.

### The TraitImpl interface

From `src/core.ts`:

```ts
export interface TraitImpl {
  type: string;
  nodeKinds: Record<string, string>;
}
```

Two fields:

- **`type`** — A runtime type string that identifies what type this trait implementation handles. This is the string returned by `typeof` for primitives (`"number"`, `"string"`, `"boolean"`) or a custom type name for complex types. The `inferType` utility uses this to match AST nodes to trait implementations.

- **`nodeKinds`** — A map from operation name to the AST node kind that implements it. Each trait has its own set of expected operation names. For example, the `eq` trait expects an `eq` key; the `ord` trait expects a `compare` key; the `semiring` trait expects `add`, `zero`, `mul`, and `one`.

### Available traits

The `traits` field on `PluginDefinition` supports these trait slots:

| Trait | Expected operations | Purpose |
|-------|-------------------|---------|
| `eq` | `eq` | Structural equality comparison |
| `ord` | `compare` | Three-way ordering (-1, 0, 1) |
| `semiring` | `add`, `zero`, `mul`, `one` | Addition and multiplication with identities |
| `heytingAlgebra` | (varies) | Boolean algebra operations |
| `show` | `show` | Convert to string representation |
| `semigroup` | `append` | Associative binary operation (concatenation) |
| `monoid` | `mempty` | Identity element for semigroup |
| `bounded` | `top`, `bottom` | Upper and lower bounds |

### Code example: num plugin traits

From `src/plugins/num/index.ts`, the `num` plugin declares five traits:

```ts
export const num: PluginDefinition<NumMethods> = {
  name: "num",
  nodeKinds: [
    "num/add", "num/sub", "num/mul", "num/div", "num/mod",
    "num/compare", "num/neg", "num/abs", "num/floor", "num/ceil",
    "num/round", "num/min", "num/max", "num/eq", "num/zero",
    "num/one", "num/show", "num/top", "num/bottom",
  ],
  traits: {
    eq: { type: "number", nodeKinds: { eq: "num/eq" } },
    ord: { type: "number", nodeKinds: { compare: "num/compare" } },
    semiring: {
      type: "number",
      nodeKinds: { add: "num/add", zero: "num/zero", mul: "num/mul", one: "num/one" },
    },
    show: { type: "number", nodeKinds: { show: "num/show" } },
    bounded: { type: "number", nodeKinds: { top: "num/top", bottom: "num/bottom" } },
  },
  build(ctx) { /* ... */ },
};
```

Key things to notice:

1. **Every node kind referenced in `traits` must also appear in `nodeKinds`.** The trait declaration `{ eq: "num/eq" }` means the `eq` plugin will emit `num/eq` nodes. That kind must be in the `nodeKinds` array so the interpreter can handle it.
2. **The `type` field is `"number"` — matching `typeof` for JS numbers.** This is how `inferType` resolves a `core/literal` with value `42` to the `num` plugin's trait implementation.
3. **Multiple traits can share node kinds.** The `semiring` trait references `num/add`, which is also a standalone operation in `build()`. A single AST node kind can serve double duty.

### Code example: str plugin traits

From `src/plugins/str/index.ts`, the `str` plugin declares four traits:

```ts
export const str: PluginDefinition<StrMethods> = {
  name: "str",
  nodeKinds: [
    "str/template", "str/concat", "str/upper", "str/lower",
    "str/trim", "str/slice", "str/includes", "str/startsWith",
    "str/endsWith", "str/split", "str/join", "str/replace",
    "str/len", "str/eq", "str/show", "str/append", "str/mempty",
  ],
  traits: {
    eq: { type: "string", nodeKinds: { eq: "str/eq" } },
    show: { type: "string", nodeKinds: { show: "str/show" } },
    semigroup: { type: "string", nodeKinds: { append: "str/append" } },
    monoid: { type: "string", nodeKinds: { mempty: "str/mempty" } },
  },
  build(ctx) { /* ... */ },
};
```

Notice that `str` provides `semigroup` (string concatenation via `append`) and `monoid` (empty string via `mempty`), while `num` provides `semiring` (arithmetic) and `bounded`. Different types participate in different traits based on what operations make mathematical sense.

### Runtime dispatch: how the eq plugin uses traits

The trait system works because consumer plugins (like `eq`, `ord`, `show`) look up which data plugins (like `num`, `str`) declare trait implementations at build time. Here is how the `eq` plugin dispatches. From `src/plugins/eq/index.ts`:

```ts
export const eq: PluginDefinition<EqMethods> = {
  name: "eq",
  nodeKinds: ["eq/neq"],
  build(ctx: PluginContext): EqMethods {
    // Step 1: Collect all eq trait implementations from loaded plugins
    const impls = ctx.plugins.filter((p) => p.traits?.eq).map((p) => p.traits!.eq!);

    function dispatchEq(a: any, b: any): Expr<boolean> {
      const aNode = ctx.lift(a).__node;
      const bNode = ctx.lift(b).__node;

      // Step 2: Infer the type of the arguments
      const type =
        inferType(aNode, impls, ctx.inputSchema) ??
        inferType(bNode, impls, ctx.inputSchema);

      // Step 3: Find the matching implementation
      const impl = type
        ? impls.find((i) => i.type === type)
        : impls.length === 1
          ? impls[0]
          : undefined;

      if (!impl) {
        throw new Error(
          type
            ? `No eq implementation for type: ${type}`
            : "Cannot infer type for eq — both arguments are untyped",
        );
      }

      // Step 4: Emit the type-specific node kind
      return ctx.expr<boolean>({
        kind: impl.nodeKinds.eq,  // e.g., "num/eq" or "str/eq"
        left: aNode,
        right: bNode,
      });
    }

    return {
      eq: dispatchEq,
      neq(a: any, b: any): Expr<boolean> {
        const inner = dispatchEq(a, b);
        return ctx.expr<boolean>({ kind: "eq/neq", inner: inner.__node });
      },
    } as EqMethods;
  },
};
```

The dispatch algorithm works in four steps:

1. **Collect implementations.** At build time, `ctx.plugins` contains all loaded plugins. The `eq` plugin filters for plugins that declare `traits.eq` and extracts their `TraitImpl` objects. If both `num` and `str` are loaded, `impls` contains `[{ type: "number", nodeKinds: { eq: "num/eq" } }, { type: "string", nodeKinds: { eq: "str/eq" } }]`.

2. **Infer the type.** The `inferType` utility examines AST nodes to determine their runtime type. For `core/literal` nodes, it returns `typeof value` (e.g., `"number"` for `42`). For plugin-prefixed nodes (e.g., `num/add`), it finds the matching trait implementation by prefix. For `core/prop_access` nodes, it resolves the type from the input schema.

3. **Find the implementation.** Once the type is known (e.g., `"number"`), the plugin finds the `TraitImpl` with `type === "number"`. If neither argument's type can be inferred but exactly one trait implementation is loaded, it falls back to that implementation (single-type programs are unambiguous).

4. **Emit the type-specific node.** Instead of emitting a generic `eq/eq` node, the plugin emits the concrete node kind from the trait implementation — `num/eq` for numbers, `str/eq` for strings. This means the `eq` plugin itself does not need its own interpreter for the `eq` operation. The `num` or `str` interpreter handles `num/eq` or `str/eq` respectively. The only node kind the `eq` plugin emits under its own namespace is `eq/neq` (which wraps an inner equality node and negates it).

This pattern — collect, infer, dispatch — is the same across all consumer plugins: `ord`, `show`, `semigroup`, `semiring`, `monoid`, `bounded`. They differ only in which trait slot they query and which operation keys they look up.

### The prelude rule

If an operation could be useful to more than one plugin, it MUST be its own plugin. This is not a guideline — it is a rule. Examples:

- Equality comparison: `eq` plugin (not inlined into `num` or `str`)
- Ordering comparison: `ord` plugin (not inlined into `num`)
- Null handling: `nullable` plugin (not inlined into any service plugin)
- String conversion: `show` plugin (not inlined into any data plugin)
- Concatenation: `semigroup` plugin (not inlined into `str`)

When you discover a missing prelude operation while building a plugin, STOP. Create an issue for the prelude plugin. Build it. Then resume your original plugin. This rule exists because agents learn by example — if a reference plugin inlines generic logic, every agent-generated plugin will do the same, creating an unmaintainable codebase.

---

## Step 6: Tests

Every plugin requires tests. The test strategy has three tiers, each testing a different layer of the stack. Ilo-native plugins need Tiers 1 and 2. External-service plugins need all three.

### Tier 1: AST construction (`index.test.ts`)

AST construction tests verify that builder methods produce correct AST nodes. They test the `build()` function from Step 2 — that calling a method on `$` produces an AST node with the right `kind`, the right structure, and the right child nodes.

**What to test:**
- Each builder method produces the expected node kind
- Literal parameters become `core/literal` nodes with the correct value
- `Expr` parameters (like `$.input.x`) become `core/prop_access` nodes
- Optional parameters are `null` when omitted
- Cross-operation dependencies (using one result as input to another) produce correct AST references
- Orphaned side-effecting nodes are rejected (reachability validation)

**Pattern:** Create the `ilo` app with your plugin, call builder methods to construct programs, then inspect the resulting AST. Use a `strip` helper to remove non-deterministic fields (`__id`, `config`) before assertions.

From `tests/plugins/stripe/2025-04-30.basil/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { stripe } from "../../../../src/plugins/stripe/2025-04-30.basil";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, stripe({ apiKey: "sk_test_123" }));

describe("stripe: paymentIntents.create", () => {
  it("produces stripe/create_payment_intent node", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/create_payment_intent");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.amount.kind).toBe("core/literal");
    expect(ast.result.params.fields.amount.value).toBe(2000);
    expect(ast.result.params.fields.currency.kind).toBe("core/literal");
    expect(ast.result.params.fields.currency.value).toBe("usd");
  });

  it("accepts Expr params and captures proxy dependencies", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.create({
        amount: $.input.amount,
        currency: $.input.currency,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/create_payment_intent");
    expect(ast.result.params.fields.amount.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.currency.kind).toBe("core/prop_access");
  });
});

describe("stripe: paymentIntents.confirm", () => {
  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.confirm("pi_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/confirm_payment_intent");
    expect(ast.result.params).toBeNull();
  });
});

describe("stripe: integration with $.do()", () => {
  it("orphaned operations are rejected", () => {
    expect(() => {
      app(($) => {
        const customer = $.stripe.customers.retrieve("cus_123");
        $.stripe.charges.create({ amount: 1000, currency: "usd" }); // orphan!
        return customer;
      });
    }).toThrow(/unreachable node/i);
  });
});
```

Key things to notice:

1. **The `strip` helper** removes `__id` (non-deterministic internal IDs) and `config` (opaque configuration) so assertions focus on structure.
2. **Tests assert on node `kind` strings** — confirming the correct plugin/operation mapping.
3. **Tests assert on child node types** — `core/literal` for raw values, `core/prop_access` for input references, `core/record` for object parameters.
4. **The orphan test** verifies ilo's reachability analysis catches side-effecting nodes that are not connected to the return value via `$.do()`.

### Tier 2: Interpretation (`interpreter.test.ts`)

Interpretation tests verify that the interpreter fragment yields correct effects with correct parameters. They test the generator from Step 3 — that for a given AST, the interpreter recurses into child nodes and yields the expected IO effects.

**What to test:**
- Each node kind yields the correct effect type
- Effect parameters (`method`, `path`, `params`, `sql`, etc.) are correct
- Input values are resolved through recurse
- Optional parameters are absent in the effect when omitted at build time
- The handler's return value becomes the program's result

**Pattern:** Create a program, then run it through `foldAST` with a mock handler that captures yielded effects. Assert on the captured effects and the final result.

From `tests/plugins/stripe/2025-04-30.basil/interpreter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { foldAST, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { stripe } from "../../../../src/plugins/stripe/2025-04-30.basil";
import { stripeInterpreter } from "../../../../src/plugins/stripe/2025-04-30.basil/interpreter";

const app = ilo(num, str, stripe({ apiKey: "sk_test_123" }));
const fragments = [stripeInterpreter, coreInterpreter];

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

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "stripe/api_call": async (effect) => {
      captured.push(effect);
      return { id: "mock_id", object: "mock" };
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

describe("stripe interpreter: create_payment_intent", () => {
  it("yields POST /v1/payment_intents with correct params", async () => {
    const prog = app(($) => $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("stripe/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/payment_intents");
    expect(captured[0].params).toEqual({ amount: 2000, currency: "usd" });
  });
});

describe("stripe interpreter: retrieve_payment_intent", () => {
  it("yields GET /v1/payment_intents/{id}", async () => {
    const prog = app(($) => $.stripe.paymentIntents.retrieve("pi_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("stripe/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/payment_intents/pi_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("stripe interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ amount: "number", currency: "string" }, ($) =>
      $.stripe.paymentIntents.create({
        amount: $.input.amount,
        currency: $.input.currency,
      }),
    );
    const { captured } = await run(prog, { amount: 3000, currency: "eur" });
    expect(captured).toHaveLength(1);
    expect(captured[0].params).toEqual({ amount: 3000, currency: "eur" });
  });
});

describe("stripe interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.stripe.customers.retrieve("cus_123"));
    const { result } = await run(prog);
    expect(result).toEqual({ id: "mock_id", object: "mock" });
  });
});
```

Key things to notice:

1. **`foldAST` composes fragments and handlers.** It takes interpreter fragments and a handler map, and returns a `RecurseFn` that evaluates AST nodes. The handler map keys are effect type strings — `"stripe/api_call"` routes to the mock handler.
2. **The mock handler captures effects.** Instead of making real API calls, it pushes each effect into a `captured` array and returns a canned response. This lets you assert on exactly what the interpreter yielded.
3. **`injectInput` simulates runtime input.** At runtime, the evaluator injects input data into `core/input` nodes. In tests, this helper does the same thing by walking the AST and attaching `__inputData`.
4. **Tests verify effect shape, not AST shape.** Tier 1 tests check the AST. Tier 2 tests check what the interpreter produces from that AST — the method, path, params, and effect type.

### Tier 3: Integration (`integration.test.ts`)

Integration tests verify the full stack: AST construction, interpretation, handler execution, SDK adapter, and real service interaction. They test the entire pipeline end-to-end against a real (or mock) service running in a container.

**When required:** Only for external-service plugins. Ilo-native plugins (num, str, eq, etc.) do not need integration tests because they have no external service to test against.

**What to test:**
- Each operation succeeds against the real service
- Response shapes match expected formats
- Chained operations (output of one as input to another) work end-to-end
- Composition with other plugins (error handling, parallelism) works correctly

**Pattern:** Start a container with the real service (or a mock of it), construct a configured SDK client, build programs, and run them through `serverEvaluate`. Assert on the actual service responses.

From `tests/plugins/stripe/2025-04-30.basil/integration.test.ts`:

```ts
import Stripe from "stripe";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";
import { stripe as stripePlugin } from "../../../../src/plugins/stripe/2025-04-30.basil";
import { wrapStripeSdk } from "../../../../src/plugins/stripe/2025-04-30.basil/client-stripe-sdk";
import { serverEvaluate } from "../../../../src/plugins/stripe/2025-04-30.basil/handler.server";
import { stripeInterpreter } from "../../../../src/plugins/stripe/2025-04-30.basil/interpreter";

let container: StartedTestContainer;
let sdk: Stripe;

const allFragments = [stripeInterpreter, coreInterpreter, numInterpreter, strInterpreter];
const app = ilo(num, str, stripePlugin({ apiKey: "sk_test_fake" }));

function injectInput(node: any, input: Record<string, unknown>): any {
  // ... same helper as Tier 2
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const client = wrapStripeSdk(sdk);
  const evaluate = serverEvaluate(client, allFragments);
  return await evaluate(ast.result);
}

beforeAll(async () => {
  container = await new GenericContainer("stripe/stripe-mock:latest")
    .withExposedPorts(12111)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(12111);

  sdk = new Stripe("sk_test_fake", {
    host,
    port: String(port),
    protocol: "http",
  });
}, 60000);

afterAll(async () => {
  await container.stop();
});

describe("stripe integration: payment intents", () => {
  it("create payment intent", async () => {
    const prog = app(($) => $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" }));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("payment_intent");
    expect(result.id).toBeDefined();
  });

  it("retrieve payment intent", async () => {
    const prog = app(($) => $.stripe.paymentIntents.retrieve("pi_xxxxxxxxxxxxx"));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("payment_intent");
  });
});

describe("stripe integration: chaining", () => {
  it("create customer then charge with customer id", async () => {
    const prog = app(($) => {
      const customer = $.stripe.customers.create({ email: "chain@test.com" });
      return $.stripe.charges.create({
        amount: 3000,
        currency: "usd",
        customer: (customer as any).id,
        source: "tok_visa",
      });
    });
    const result = (await run(prog)) as any;
    expect(result.object).toBe("charge");
    expect(result.id).toBeDefined();
  });
});
```

Key things to notice:

1. **Container setup.** The `beforeAll` hook starts a `stripe/stripe-mock` container using testcontainers. The container provides a real Stripe API surface that returns realistic responses without requiring credentials. For postgres, the equivalent is a real PostgreSQL container.
2. **Real SDK client.** The test constructs a real `Stripe` SDK instance pointed at the container, wraps it with `wrapStripeSdk`, and passes it to `serverEvaluate`. This tests the full adapter chain — no mocks.
3. **All interpreter fragments are included.** Unlike Tier 2 (which only needs the plugin's fragment and `coreInterpreter`), integration tests include fragments for all plugins in the program (`numInterpreter`, `strInterpreter`, etc.) because the full evaluation pipeline is exercised.
4. **Assertions are on service responses, not effects.** Tier 2 asserts on what the interpreter yields. Tier 3 asserts on what the real service returns — `result.object`, `result.id`, response shapes.
5. **Timeout on `beforeAll`.** Container startup can be slow. The `60000` ms timeout (60 seconds) prevents CI from failing on cold pulls.

### Which tiers you need

| Plugin type | Tier 1 (AST) | Tier 2 (Interpreter) | Tier 3 (Integration) |
|------------|:------------:|:-------------------:|:-------------------:|
| Ilo-native (num, str, eq, ...) | Required | Required | Not needed |
| External-service (stripe, postgres, ...) | Required | Required | Required |

Ilo-native plugins do not talk to external services, so there is nothing to integration-test. Their Tier 2 tests are sufficient because the interpreter evaluates to final values without yielding IO effects (or yields only `recurse` effects handled by the core interpreter).

### Container choices for integration tests

| Service | Container | Notes |
|---------|-----------|-------|
| Stripe | `stripe/stripe-mock:latest` | Returns realistic responses, stateless |
| PostgreSQL | testcontainers `PostgreSqlContainer` | Full PostgreSQL instance, stateful |

When writing integration tests for a new external-service plugin, find the service's official mock container or test image. If none exists, consider whether a lightweight HTTP mock server is sufficient. The goal is to test the real protocol — serialization, encoding, error handling — not just happy-path responses.

---

## Step 7: Documentation

Every plugin must document itself in two ways: an implementation status header at the top of `index.ts`, and TSDoc comments on all public exports. These are not optional. Autogenerated API docs depend on TSDoc. Agents reading the codebase depend on the status header.

### Implementation status header

Every plugin's `index.ts` must begin with a block comment that describes what the plugin implements, what it cannot implement, and what remains to be done. The format is fixed:

```ts
// ============================================================
// ILO PLUGIN: <name> (<compatible API>)
// ============================================================
//
// Implementation status: COMPLETE (modulo known limitations)
//   -- or --
// Implementation status: PARTIAL (N of M <unit>)
//
// Plugin size: SMALL -- fully implemented modulo known limitations
//   -- or --
// Plugin size: MEDIUM -- at pass N of 75/25 split
//   -- or --
// Plugin size: LARGE -- at pass N of 60/30/10 split (N of M <unit>)
//
// Implemented:
//   - <resource/operation>
//
// Not doable (fundamental mismatch with AST model):
//   - <resource/operation>: <reason>
//   (can be empty -- expected for request-response services)
//
// Remaining (same pattern, add as needed):
//   - <resources to implement>
//
// Goal: <what the user experience should feel like>
//
// Real <library> API:
//   <2-5 lines showing the upstream library's actual usage>
//
// ============================================================
```

**"Not doable" being empty is fine.** For pure request-response services (like Stripe), every operation is modelable as an AST node. The section exists for services with fundamental mismatches -- push-based protocols, streaming, async iteration -- where certain operations cannot be expressed as a finite, inspectable AST.

#### Real example: postgres plugin (COMPLETE)

From `src/plugins/postgres/3.4.8/index.ts`:

```ts
// ============================================================
// ILO PLUGIN: postgres (porsager/postgres compatible API)
// ============================================================
//
// Implementation status: COMPLETE (modulo known limitations)
// Plugin size: SMALL — fully implemented modulo known limitations
//
// Known limitations (deliberate omissions):
//   - No COPY (streaming bulk import/export)
//   - No LISTEN/NOTIFY (async pub/sub channels)
//   - No SUBSCRIBE (realtime logical replication)
//
// Goal: An LLM that knows postgres.js should be able to write
// Ilo programs with near-zero learning curve. The API should
// look like the real postgres.js as closely as possible.
//
// Real postgres.js API:
//   const sql = postgres('postgres://...')
//   const users = await sql`select * from users where id = ${id}`
//   const [user] = await sql`select * from users where id = ${id}`
//   await sql`insert into users ${sql(user, 'name', 'age')}`
//   sql(identifier)           -- dynamic identifier
//   sql(object, ...columns)   -- dynamic insert/update
//   sql.begin(fn)             -- transactions
//   sql.savepoint(fn)         -- savepoints
//
// ============================================================
```

#### Real example: stripe plugin (PARTIAL)

From `src/plugins/stripe/2025-04-30.basil/index.ts`:

```ts
// ============================================================
// ILO PLUGIN: stripe (stripe-node compatible API)
// ============================================================
//
// Implementation status: PARTIAL (3 of 57 top-level resources)
// Plugin size: LARGE — at pass 1 of 60/30/10 split (3 of 57 resources)
//
// Implemented:
//   - PaymentIntents: create, retrieve, confirm
//   - Customers: create, retrieve, update, list
//   - Charges: create, retrieve, list
//
// Not doable (fundamental mismatch with AST model):
//   (none -- every Stripe resource is request/response, all are
//   modelable. Even pagination can be done via $.rec + has_more.)
//
// Remaining (same CRUD pattern, add as needed):
//   Accounts, AccountLinks, AccountSessions, ApplicationFees,
//   Balance, BalanceTransactions, Coupons, CreditNotes,
//   Disputes, Events, Files, FileLinks, Invoices, InvoiceItems,
//   Mandates, PaymentLinks, PaymentMethods, Payouts, Plans,
//   Prices, Products, PromotionCodes, Quotes, Refunds,
//   SetupIntents, ShippingRates, Sources, Subscriptions,
//   SubscriptionItems, SubscriptionSchedules, Tokens, Topups,
//   Transfers, WebhookEndpoints, and sub-resources under
//   Billing, Checkout, Climate, Identity, Issuing, Radar,
//   Reporting, Sigma, Tax, Terminal, Treasury.
//
//   Each resource follows the same pattern: add node kinds,
//   add methods to StripeMethods, add switch cases to the
//   interpreter. The interpreter/handler architecture does
//   not need to change -- stripe/api_call covers everything.
//
// ============================================================
//
// Goal: An LLM that knows stripe-node should be able to write
// Ilo programs with near-zero learning curve. The API should
// look like the real stripe-node SDK as closely as possible.
//
// Real stripe-node API (v2025-04-30.basil):
//   const stripe = new Stripe('sk_test_...')
//   const pi = await stripe.paymentIntents.create({ amount: 2000, currency: 'usd' })
//   const pi = await stripe.paymentIntents.retrieve('pi_123')
//   const pi = await stripe.paymentIntents.confirm('pi_123', { payment_method: 'pm_abc' })
//   const customer = await stripe.customers.create({ email: 'test@example.com' })
//   const customer = await stripe.customers.retrieve('cus_123')
//   const customer = await stripe.customers.update('cus_123', { name: 'New Name' })
//   const customers = await stripe.customers.list({ limit: 10 })
//   const charge = await stripe.charges.create({ amount: 5000, currency: 'usd' })
//   const charge = await stripe.charges.retrieve('ch_123')
//   const charges = await stripe.charges.list({ limit: 25 })
//
// Based on source-level analysis of stripe-node
// (github.com/stripe/stripe-node). The SDK uses
// StripeResource.extend() with stripeMethod() specs defining
// HTTP method + fullPath for each operation.
//
// ============================================================
```

Notice the differences: postgres uses `COMPLETE (modulo known limitations)` because it covers the full API surface minus deliberate omissions. Stripe uses `PARTIAL (3 of 57 top-level resources)` because it implements a subset. Both state the implementation count honestly.

### HONEST ASSESSMENT section

Every external-service plugin must end its `index.ts` with an honest assessment. This section is for the next developer or agent working on the plugin -- it tells them what works, what is awkward, and what is fundamentally hard. The format has four categories:

- **WORKS GREAT** -- What maps 1:1 with the real SDK. Side-by-side comparisons of real vs. ilo code.
- **WORKS BUT DIFFERENT** -- What is modelable but requires a different API shape. Must explain why the deviation exists.
- **DOESN'T WORK / HARD** -- Fundamental gaps. Operations that cannot be expressed as a finite AST, or that would require significant new infrastructure.
- **SUMMARY** -- A pragmatic coverage assessment. What percentage of the upstream API is covered? What is the main gap? What is the recommended next step?

#### Real example: postgres honest assessment

From the end of `src/plugins/postgres/3.4.8/index.ts`:

```ts
// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Basic queries:
//    Real:  const users = await sql`select * from users where age > ${age}`
//    Ilo: const users = $.sql`select * from users where age > ${age}`
//    Nearly identical. The only diff is $ prefix and no await.
//
// 2. Parameterized queries with proxy values:
//    const user = $.sql`select * from users where id = ${$.input.id}`
//    const posts = $.sql`select * from posts where user_id = ${user[0].id}`
//    Proxy chains capture the dependency graph perfectly.
//
// 3. Dynamic identifiers:
//    Real:  sql`select ${sql('name')} from ${sql('users')}`
//    Ilo: $.sql`select ${$.sql.id('name')} from ${$.sql.id('users')}`
//    Slightly more verbose but unambiguous.
//
// 4. Transactions (pipeline mode):
//    Real:  sql.begin(sql => [sql`update ...`, sql`insert ...`])
//    Ilo: $.sql.begin(sql => [sql`update ...`, sql`insert ...`])
//    Identical! Array = sequence of effects.
//
// 5. Insert helpers:
//    Real:  sql`insert into users ${sql(user, 'name', 'age')}`
//    Ilo: $.sql`insert into users ${$.sql.insert(user, ['name', 'age'])}`
//    Slightly different call style but same semantics.
//
// WORKS BUT DIFFERENT:
//
// 6. Destructuring results:
//    Real:  const [user] = await sql`select ... limit 1`
//    Ilo: const user = $.sql`select ... limit 1`[0]
//    Can't destructure proxies. [0] index access works though.
//
// 7. Transactions (callback mode with dependencies):
//    Ilo requires $.do() to sequence side effects. No destructuring.
//
// DOESN'T WORK / HARD:
//
// 8. Conditional queries inside transactions:
//    Must use $.cond() instead of native if(). Works but less natural.
//
// 9. Async/await ordering:
//    The fundamental mismatch: real postgres.js uses await for
//    sequencing. Ilo uses proxy chains + $.do(). For pure data
//    dependencies this is seamless. For "do A then B" without
//    data dependency, you need $.do() or array pipeline syntax.
//
// SUMMARY:
// For the 80% case of "query, transform, return" -- nearly
// identical to real postgres.js. For complex conditional logic
// inside transactions, it diverges. Not supported: COPY,
// LISTEN/NOTIFY, cursor async-iterable form.
// ============================================================
```

#### Real example: stripe honest assessment

From the end of `src/plugins/stripe/2025-04-30.basil/index.ts`:

```ts
// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Basic CRUD operations:
//    Real:  const pi = await stripe.paymentIntents.create({ amount: 2000, currency: 'usd' })
//    Ilo:   const pi = $.stripe.paymentIntents.create({ amount: 2000, currency: 'usd' })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Parameterized operations with proxy values:
//    const customer = $.stripe.customers.create({ email: $.input.email })
//    const pi = $.stripe.paymentIntents.create({ customer: customer.id, amount: $.input.amount })
//    Proxy chains capture the dependency graph perfectly.
//
// 3. Resource method naming:
//    Real:  stripe.paymentIntents.create(...)
//    Ilo:   $.stripe.paymentIntents.create(...)
//    The nested resource pattern maps 1:1.
//
// WORKS BUT DIFFERENT:
//
// 5. Return types:
//    Real stripe-node has 100+ typed response interfaces.
//    Ilo uses Record<string, unknown> for all return types.
//    Property access works via proxy but no autocomplete.
//
// DOESN'T WORK / NOT MODELED:
//
// 7. Pagination (auto-pagination): Can't model async iterators.
// 8. Webhooks: Server-initiated push events, not request/response.
// 9. Idempotency keys, request options: Not modeled yet.
//
// SUMMARY:
// For the core 80% use case of "create/retrieve/update/list
// resources" -- nearly identical to real stripe-node.
// The main gap is typed response objects.
// Not supported: auto-pagination, webhooks, file uploads,
// streaming, request-level options.
// ============================================================
```

### TSDoc on all public exports

Every public export must have a TSDoc comment. This applies to types, interfaces, functions, and consts exported from a plugin's `index.ts` and from `src/index.ts`. The comment must include:

- A description of what the export does
- `@param` for each parameter (on functions)
- `@returns` describing the return value (on functions)
- `@example` where appropriate (especially for builder methods and factory functions)

This is enforced project-wide. Autogenerated API docs depend on it.

#### Real example: TSDoc from the codebase

From `src/plugins/stripe/2025-04-30.basil/handler.server.ts` -- the `serverHandler` function:

```ts
/**
 * Creates a server-side {@link StepHandler} that executes Stripe effects
 * against a real Stripe client.
 *
 * Handles `stripe/api_call` effects by delegating to
 * `client.request(method, path, params)`. Throws on unhandled effect types.
 *
 * @param client - The {@link StripeClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: StripeClient): StepHandler<void> {
```

From `src/plugins/stripe/2025-04-30.basil/handler.server.ts` -- the `serverEvaluate` function:

```ts
/**
 * Creates a unified evaluation function that evaluates an AST against
 * a Stripe client using the provided interpreter fragments.
 *
 * Convenience wrapper composing fragments + {@link serverHandler} via `runAST`.
 *
 * @param client - The {@link StripeClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: StripeClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
```

From `src/plugins/postgres/3.4.8/index.ts` -- the `PostgresMethods` interface:

```ts
/**
 * Database operations added to the DSL context by the postgres plugin.
 *
 * Mirrors the postgres.js (porsager/postgres) v3.4.x API as closely
 * as possible: tagged template queries, dynamic identifiers, insert/set
 * helpers, transactions, savepoints, and cursors.
 */
export interface PostgresMethods {
  /**
   * Tagged template query -- the core of postgres.js.
   *
   * Real postgres.js:
   *   const users = await sql`select * from users where age > ${age}`
   *
   * Ilo:
   *   const users = $.sql`select * from users where age > ${age}`
   *
   * Returns `Expr<Row[]>` -- an array of result rows.
   */
  sql: PostgresSql;
}
```

The pattern: describe what it does, link to related types with `{@link}`, document every parameter, document the return value. For interfaces, document each field.

---

## Standing Rules

These 10 rules apply to every plugin. They are non-negotiable. Violating any of them is either a build error, a runtime bug, or an architectural regression.

**1. Namespace all node kinds: `plugin/kind`, not bare `kind`.**

Every AST node kind must be prefixed with the plugin's `name` followed by a slash. The num plugin emits `"num/sub"`, not `"sub"`. The stripe plugin emits `"stripe/create_payment_intent"`, not `"create_payment_intent"`. This prevents collisions between plugins and makes the AST self-documenting.

**2. `nodeKinds` must list every kind the plugin emits.**

If your `build()` function calls `ctx.expr({ kind: "my/foo" })`, then `"my/foo"` must appear in the `nodeKinds` array. The interpreter uses `nodeKinds` to route evaluation. A missing entry means the node will not be interpreted and the program will fail at runtime.

**3. Never import the backend SDK from the interpreter -- all IO through yielded effects.**

The interpreter translates AST structure into effects. The handler executes those effects against the real SDK. The interpreter must never `import` from `stripe`, `postgres`, or any other backend SDK. All IO flows through `yield` -- the interpreter yields an effect, the handler executes it, and the result comes back via the generator protocol.

**4. "Not doable" being empty is fine -- expected for request-response services.**

For pure request-response services (like Stripe), every operation is modelable as an AST node. The "Not doable" section in the implementation status header can and should be empty in this case. Do not invent limitations to fill the section.

**5. Config goes in AST nodes, not runtime lookups -- AST must be self-contained.**

If your plugin requires configuration (API keys, connection strings, options), store the config directly on each AST node. The stripe plugin stores `config` on every `stripe/*` node. This makes the AST portable -- an interpreter can evaluate the program without having access to the original plugin closure.

**6. Interpreter fragments compose via `composeInterpreters` -- first match wins.**

The evaluator calls `canHandle` on each fragment in order until one matches. If your fragment claims a node kind that another fragment also claims, the first fragment in the array wins. Plugin interpreters should only claim nodes under their own namespace (`node.kind.startsWith("pluginName/")`).

**7. Factory functions for configured plugins, const for unconfigured.**

If your plugin needs configuration, export a factory function: `export function myPlugin(config: Config): PluginDefinition<T>`. If your plugin needs no configuration, export a const: `export const myPlugin: PluginDefinition<T> = { ... }`. Do not use a factory function when there is no config -- it adds unnecessary indirection.

**8. The prelude rule is non-negotiable -- reusable logic becomes its own plugin.**

If an operation could be useful to more than one plugin, it MUST be its own plugin. Equality goes in `eq`, ordering goes in `ord`, null handling goes in `nullable`, string conversion goes in `show`. When you discover a missing prelude operation while building a plugin, STOP. Create an issue for the prelude plugin. Build it. Then resume.

**9. Three test tiers for external-service plugins, two for ilo-native.**

External-service plugins require Tier 1 (AST construction), Tier 2 (interpretation with mock handlers), and Tier 3 (integration against real/mock containers). Ilo-native plugins require Tier 1 and Tier 2. No exceptions. See Step 6 for details.

**10. Every public export gets TSDoc.**

Every type, interface, function, and const exported from a plugin must have a TSDoc comment with a description, `@param` tags, and `@returns` tags where applicable. This is enforced project-wide. Autogenerated API docs depend on it. When you spot an existing export missing TSDoc during unrelated work, file a GitHub issue (labeled `documentation`) describing what is missing, then continue your current task.
