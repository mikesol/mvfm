// ============================================================
// MVFM — Core type definitions
// ============================================================

// ---- Branding & Expr ----------------------------------------

/** @internal Brand symbol for Expr detection. */
export const MVFM = Symbol.for("mvfm");

/**
 * Base fields present on every Expr regardless of T.
 * Kept as an interface so the MVFM symbol key works.
 */
export interface ExprBase<T> {
  readonly [MVFM]: true;
  readonly __type: T; // phantom — never read at runtime
  readonly __node: any; // the underlying AST node
}

/**
 * Conditional mapped fields for `Expr<T>`.
 *
 * - `never`        → `{}` (no property access — forces schema declaration)
 * - `T[]`          → permissive index sig (array typing deferred, see #18)
 * - Record type  → mapped `{ K: Expr<T[K]> }` (type-preserving proxy)
 * - leaf (string, number, etc.) → `{}` (no extra properties)
 */
export type ExprFields<T> = [T] extends [never]
  ? {}
  : [T] extends [readonly any[]]
    ? { readonly [key: string]: any }
    : T extends Record<string, unknown>
      ? { readonly [K in keyof T as K extends `__${string}` | symbol ? never : K]: Expr<T[K]> }
      : {};

/**
 * Expr<T> is the phantom-typed wrapper around every value in
 * the DSL. At runtime it's a Proxy. At the type level it
 * carries T so your IDE gives you completions and errors.
 *
 * The brand symbol lets plugins detect "is this already a
 * Mvfm value or a raw JS primitive?"
 */
export type Expr<T> = ExprBase<T> & ExprFields<T>;

// ---- Program ------------------------------------------------

/**
 * A Program is what mvfm() returns — the complete AST plus
 * a hash for verification.
 */
export interface Program {
  ast: any;
  hash: string;
  plugins: string[];
  inputSchema: Record<string, unknown>;
}

// ---- Plugin Interface ---------------------------------------

/**
 * A Plugin is a function that receives the proxy builder
 * context and returns:
 *
 *   name      — unique namespace (e.g. "num", "str", "db")
 *   build     — called during $ construction; returns the
 *               methods/properties this plugin adds to $
 *   nodeKinds — the set of AST node kinds this plugin emits
 *               (for validation & interpreter dispatch)
 */
export interface PluginContext {
  /** Create an Expr<T> wrapping an AST node */
  expr: <T>(node: any) => Expr<T>;

  /** Auto-lift a raw JS value to Expr if it isn't already */
  lift: <T>(value: T | Expr<T>) => Expr<T>;

  /** Check if a value is already an Expr */
  isExpr: (value: unknown) => value is Expr<unknown>;

  /** Record a statement-level AST node (no return value) */
  emit: (node: any) => void;

  /** Access the current program's statement list */
  statements: any[];

  /**
   * Internal: all nodes created during closure execution.
   * Used for reachability analysis — NOT for building the AST.
   */
  _registry: Map<number, any>;

  /** All resolved plugin definitions loaded in this program */
  plugins: PluginDefinition[];

  /** Runtime schema passed via the schema overload, if any */
  inputSchema?: Record<string, unknown>;
}

/**
 * Declares a typeclass trait implementation for a plugin's type.
 *
 * Maps a runtime type string (e.g. `"number"`) to the AST node kinds
 * that implement each operation in the trait.
 */
export interface TraitImpl {
  type: string;
  nodeKinds: Record<string, string>;
}

/**
 * Phantom marker: a typeclass plugin's contribution depends on which
 * type plugins provide implementations for the named trait.
 * @internal
 */
export interface TypeclassSlot<Name extends string> {
  readonly __typeclassSlot: Name;
}

/**
 * Error type injected when a typeclass plugin is used without any
 * type plugin providing the required trait.
 * @internal
 */
export interface MissingTraitError<_TraitName extends string, Hint extends string> {
  /** @deprecated This typeclass has no provider — see Hint. */
  readonly __error: Hint;
}

/**
 * Registry mapping trait names to their generic template types.
 * Extended by typeclass plugins via declaration merging.
 * @internal
 */
// biome-ignore lint/correctness/noUnusedVariables: T is used by module augmentation
export interface TypeclassMapping<T> {}

/**
 * Defines a plugin's contract: its name, the AST node kinds it emits,
 * and a build function that returns the methods it contributes to `$`.
 */
// biome-ignore lint/correctness/noUnusedVariables: Traits is reserved for trait-based plugin dispatch
export interface PluginDefinition<T = any, Traits extends Record<string, unknown> = {}> {
  name: string;
  nodeKinds: string[];
  build: (ctx: PluginContext) => T;
  traits?: {
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

/**
 * A plugin export: either a bare PluginDefinition or a factory
 * function that returns one (for plugins requiring configuration).
 */
export type Plugin<T = any, Traits extends Record<string, unknown> = {}> =
  | PluginDefinition<T, Traits>
  | (() => PluginDefinition<T, Traits>);

/**
 * A plugin input accepted by {@link mvfm}.
 *
 * Supports either a single plugin/factory or an arbitrarily nested
 * readonly array/tuple of plugin inputs.
 */
export type PluginInput = Plugin | readonly PluginInput[];

// ---- Type-level helpers -------------------------------------

/** Extract the methods type T from a plugin or factory */
export type ExtractPluginType<P> =
  P extends PluginDefinition<infer T, any>
    ? T
    : P extends (...args: any[]) => PluginDefinition<infer T, any>
      ? T
      : {};

/** Extract the Traits record from a plugin or factory */
export type ExtractPluginTraits<P> =
  P extends PluginDefinition<any, infer Traits>
    ? Traits
    : P extends (...args: any[]) => PluginDefinition<any, infer Traits>
      ? Traits
      : {};

/** @internal */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

/** Collect trait type for a specific trait name K across all plugins */
export type CollectTrait<Plugins extends readonly any[], K extends string> =
  ExtractPluginTraits<Plugins[number]> extends infer AllTraits
    ? AllTraits extends Record<string, unknown>
      ? K extends keyof AllTraits
        ? AllTraits[K]
        : never
      : never
    : never;

/**
 * Resolve a single plugin's contribution to $.
 * Regular plugins: pass through T unchanged.
 * TypeclassSlot plugins: resolve against collected traits via TypeclassMapping.
 */
export type ResolvePlugin<P, Plugins extends readonly any[]> =
  ExtractPluginType<P> extends TypeclassSlot<infer Name>
    ? Name extends keyof TypeclassMapping<any>
      ? [CollectTrait<Plugins, Name>] extends [never]
        ? MissingTraitError<
            Name,
            `No plugin provides trait '${Name}'. Include a type plugin that registers it.`
          >
        : UnionToIntersection<
            CollectTrait<Plugins, Name> extends infer T
              ? T extends any
                ? TypeclassMapping<T>[Name]
                : never
              : never
          >
      : MissingTraitError<
          Name,
          `No plugin provides trait '${Name}'. Include a type plugin that registers it.`
        >
    : ExtractPluginType<P>;

/** @internal */
export type FlattenPluginInput<P> = P extends readonly any[] ? FlattenPluginInputs<P> : [P];

/** @internal */
export type FlattenPluginInputs<Plugins extends readonly any[]> = Plugins extends readonly [
  infer Head,
  ...infer Tail,
]
  ? [...FlattenPluginInput<Head>, ...FlattenPluginInputs<Tail>]
  : [];

/** @internal */
export type MergePlugins<Plugins extends readonly any[]> = UnionToIntersection<
  ResolvePlugin<Plugins[number], Plugins>
>;

// ---- Core $ methods -----------------------------------------

/**
 * Core methods available on every `$` regardless of loaded plugins.
 */
export interface CoreDollar<I = never> {
  /** Input parameters to the program — typed when I is provided */
  input: Expr<I>;

  /** Conditional branching (returns a branch builder) */
  cond(predicate: Expr<boolean>): {
    t: (then: Expr<any> | any) => { f: (els: Expr<any> | any) => Expr<any> };
    f: (els: Expr<any> | any) => { t: (then: Expr<any> | any) => Expr<any> };
  };

  /**
   * Sequence expressions, return the last.
   *
   *   return $.begin(
   *     $.db.exec('UPDATE ...', []),
   *     $.kv.set('key', value),
   *     user   // ← returned
   *   )
   */
  begin(first: Expr<any> | any, ...rest: (Expr<any> | any)[]): Expr<any>;

  /**
   * Recursion via Y combinator. The callback receives `self`
   * (a function that produces recursive call nodes) and `param`
   * (the input to the recursive function).
   */
  rec<T, R>(fn: (self: (arg: Expr<T> | T) => Expr<R>, param: Expr<T>) => Expr<R> | R): Expr<R>;
}
