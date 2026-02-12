# Typeclass Dispatch Design

**Date:** 2026-02-12
**Issue:** #19
**Status:** Design approved, pending implementation
**Depends on:** #18 (typed inputs — complete), #17 (design — approved)

## Problem

`$.eq` lives in core as a polymorphic equality operator that accepts any two `Expr<T>` and emits `core/eq`. There's no way for the interpreter to know whether it's comparing numbers, strings, or booleans — and no way to prevent comparing incompatible types. This is the typeclass problem: we need per-type dispatch with compile-time safety.

TypeScript erases types at runtime, so overload-based dispatch alone can't produce different AST node kinds. The solution: make every Expr in the system self-typing at the AST level, so a dispatcher can inspect arguments and route to the correct implementation.

## Architecture

Three parts:

1. **Runtime input schemas** — `app(schema, $ => ...)` replaces `app<I>($ => ...)`. The schema is both a runtime value (for dispatch) and a type-level marker (TypeScript infers the input type from it).

2. **Type inference from AST** — A `inferType(node, impls, schema)` function determines any Expr's type at build time:
   - `core/literal` → `typeof value`
   - Plugin nodes → looked up via trait declarations
   - `core/prop_access` on `core/input` → walked through the input schema

3. **Trait protocol** — `PluginDefinition` gains an optional `traits` field. The `eq` plugin discovers implementations from loaded plugins via `PluginContext.plugins`.

## Runtime input schemas

### JSON++ type vocabulary

Primitive types are string literals — no imports needed:

```ts
const prog = app({ name: "string", age: "number", active: "boolean" }, $ => {
  return $.eq($.input.name, "alice")
})
```

Nested records are plain objects. Arrays and nullable use imported helpers:

```ts
import { array, nullable } from 'ilo'

const prog = app({
  name: "string",
  scores: array("number"),
  address: { city: "string", zip: "string" },
  deletedAt: nullable("date"),
}, $ => ...)
```

Full vocabulary: `"string"`, `"number"`, `"boolean"`, `"date"`, `"null"`, `array(tag)`, `nullable(tag)`, nested record objects. Covers server-side input shapes.

### Type-level inference

```ts
type SchemaTag = "string" | "number" | "boolean" | "date" | "null";

type TagToType<T> =
  T extends "string" ? string :
  T extends "number" ? number :
  T extends "boolean" ? boolean :
  T extends "date" ? Date :
  T extends "null" ? null :
  never;

type InferSchema<S> =
  S extends SchemaTag ? TagToType<S> :
  S extends { __tag: "array"; of: infer U } ? InferSchema<U>[] :
  S extends { __tag: "nullable"; of: infer U } ? InferSchema<U> | null :
  S extends Record<string, unknown> ? { [K in keyof S]: InferSchema<S[K]> } :
  never;
```

TypeScript infers literal types from the schema value when passed to a generic function, so no `as const` is needed.

### API change

The `define` function returned by `ilo()` gains an overload:

```ts
function define<S extends SchemaShape>(
  schema: S,
  fn: ($: CoreDollar<InferSchema<S>> & MergePlugins<P>) => Expr<any> | any,
): Program;
function define<I = never>(
  fn: ($: CoreDollar<I> & MergePlugins<P>) => Expr<any> | any,
): Program;
```

The schema object is stored on `PluginContext.inputSchema` for trait plugins to access.

## Trait protocol

### PluginDefinition changes

```ts
export interface TraitImpl {
  type: string;      // "number", "string", "boolean", etc.
  nodeKind: string;  // "num/eq", "str/eq", etc.
}

export interface PluginDefinition<T = any> {
  name: string;
  nodeKinds: string[];
  build: (ctx: PluginContext) => T;
  traits?: {
    eq?: TraitImpl;
    // future: ord?: TraitImpl, show?: TraitImpl, etc.
  };
}
```

### PluginContext changes

```ts
export interface PluginContext {
  expr: <T>(node: ASTNode) => Expr<T>;
  lift: <T>(value: T | Expr<T>) => Expr<T>;
  isExpr: (value: unknown) => value is Expr<unknown>;
  emit: (node: ASTNode) => void;
  statements: ASTNode[];
  _registry: Map<number, ASTNode>;
  plugins: PluginDefinition[];              // NEW: all loaded plugins
  inputSchema?: Record<string, unknown>;    // NEW: runtime schema
}
```

### Plugin trait declarations

Plugins add trait declarations to their existing definitions:

```ts
// num plugin
export const num: PluginDefinition<NumMethods> = {
  name: "num",
  nodeKinds: [..., "num/eq"],  // add num/eq
  traits: { eq: { type: "number", nodeKind: "num/eq" } },
  build(ctx) { ... }  // unchanged
};

// str plugin
export const str: PluginDefinition<StrMethods> = {
  name: "str",
  nodeKinds: [..., "str/eq"],
  traits: { eq: { type: "string", nodeKind: "str/eq" } },
  build(ctx) { ... }
};

// boolean plugin
export const boolean: PluginDefinition<BooleanMethods> = {
  name: "boolean",
  nodeKinds: [..., "boolean/eq"],
  traits: { eq: { type: "boolean", nodeKind: "boolean/eq" } },
  build(ctx) { ... }
};
```

Plugins that don't participate in traits change nothing — `traits` is optional.

## The eq plugin

### Interface

```ts
export interface EqMethods {
  eq(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  eq(a: Expr<string> | string, b: Expr<string> | string): Expr<boolean>;
  eq(a: Expr<boolean> | boolean, b: Expr<boolean> | boolean): Expr<boolean>;
}
```

TypeScript resolves the overload based on argument types. `$.eq(numExpr, strExpr)` is a type error.

### Implementation

```ts
export function eq(): PluginDefinition<EqMethods> {
  return {
    name: "eq",
    nodeKinds: [],  // delegates to num/eq, str/eq, etc.
    build(ctx) {
      const impls = ctx.plugins
        .filter(p => p.traits?.eq)
        .map(p => p.traits!.eq!);

      return {
        eq(a: any, b: any) {
          const aNode = ctx.lift(a).__node;
          const bNode = ctx.lift(b).__node;
          const type = inferType(aNode, impls, ctx.inputSchema)
                    ?? inferType(bNode, impls, ctx.inputSchema);
          if (!type) {
            throw new Error("Cannot infer type for eq — both arguments are untyped");
          }
          const impl = impls.find(i => i.type === type);
          if (!impl) {
            throw new Error(`No eq implementation for type: ${type}`);
          }
          return ctx.expr({ kind: impl.nodeKind, left: aNode, right: bNode });
        }
      };
    }
  };
}
```

### Type inference from AST nodes

```ts
function inferType(
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
    const pluginPrefix = impl.nodeKind.split("/")[0];
    if (node.kind.startsWith(pluginPrefix + "/")) return impl.type;
  }

  // 3. Input fields — walk schema
  if (node.kind === "core/prop_access") {
    return resolveSchemaType(node, schema);
  }

  return null;
}

function resolveSchemaType(
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

## Interpretation

Every feature must have interpretation tests — not just AST construction tests. This is a new project-wide requirement.

### Interpreter fragments

Each plugin ships an interpreter fragment alongside its AST builder:

```ts
// Core interpreter
const coreInterpreter: InterpreterFragment = {
  pluginName: "core",
  canHandle: (node) => node.kind.startsWith("core/"),
  visit(node, recurse) {
    switch (node.kind) {
      case "core/literal": return node.value;
      case "core/input": return node.__inputData;
      case "core/prop_access": return recurse(node.object)[node.property];
      case "core/cond":
        return recurse(node.predicate) ? recurse(node.then) : recurse(node.else);
      case "core/do": {
        for (const step of node.steps) recurse(step);
        return recurse(node.result);
      }
      // ... etc
    }
  }
};

// Num interpreter
const numInterpreter: InterpreterFragment = {
  pluginName: "num",
  canHandle: (node) => node.kind.startsWith("num/"),
  visit(node, recurse) {
    switch (node.kind) {
      case "num/add": return recurse(node.left) + recurse(node.right);
      case "num/sub": return recurse(node.left) - recurse(node.right);
      case "num/eq": return recurse(node.left) === recurse(node.right);
      // ... etc
    }
  }
};

// Str interpreter
const strInterpreter: InterpreterFragment = {
  pluginName: "str",
  canHandle: (node) => node.kind.startsWith("str/"),
  visit(node, recurse) {
    switch (node.kind) {
      case "str/eq": return recurse(node.left) === recurse(node.right);
      // ... etc
    }
  }
};
```

### Test pattern

```ts
describe("eq interpretation", () => {
  const app = ilo(num, str, eq);
  const run = (prog: Program, input: Record<string, unknown>) => {
    const interp = composeInterpreters([coreInterpreter, numInterpreter, strInterpreter]);
    // Inject input data into the core/input node
    return interp({ ...prog.ast, __inputData: input });
  };

  it("number equality", () => {
    const prog = app({ x: "number", y: "number" }, $ =>
      $.eq($.input.x, $.input.y)
    );
    expect(run(prog, { x: 42, y: 42 })).toBe(true);
    expect(run(prog, { x: 42, y: 99 })).toBe(false);
  });

  it("string equality", () => {
    const prog = app({ name: "string" }, $ =>
      $.eq($.input.name, "alice")
    );
    expect(run(prog, { name: "alice" })).toBe(true);
    expect(run(prog, { name: "bob" })).toBe(false);
  });

  it("cross-type comparison is a compile error", () => {
    app({ x: "number" }, $ => {
      // @ts-expect-error — number and string can't be compared
      return $.eq($.input.x, "hello");
    });
  });
});
```

**Rule going forward:** No feature ships without an interpretation test proving it produces the right result, not just the right AST shape.

## Migration

### core/eq removal

- `CoreDollar<I>` loses its `eq` method
- The `eq` implementation inside `ilo()` is deleted
- `"core/eq"` is no longer a valid node kind

### Test migration

Every test using `$.eq` adds the `eq` plugin and (if using `$.input`) a schema:

```ts
// Before:
const app = ilo(num, str)
app($ => $.eq($.input.x, 1))

// After:
const app = ilo(num, str, eq)
app({ x: "number" }, $ => $.eq($.input.x, 1))
```

Tests not using `$.eq` or `$.input` don't change.

## Future work

- **#20**: Broader typeclasses (Ord, Semiring, HeytingAlgebra) — same trait protocol, new trait names
- **#22**: Zod bridge — `fromZod(zodSchema)` produces an ilo schema object
- Plugin authoring guide update for trait registration

## Risks

- Overloaded `eq` on `EqMethods` may have poor TypeScript error messages when neither overload matches
- `inferType` based on node kind prefixes assumes plugins namespace consistently (enforced by standing rules)
- Recursive schema resolution for deeply nested `core/prop_access` chains — should be tested
- The `composeInterpreters` function in core has never been used in tests; may need fixes
