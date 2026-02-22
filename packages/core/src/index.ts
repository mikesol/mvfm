/**
 * @mvfm/core — public API surface.
 *
 * Organized into five tiers:
 *   1. Public API — the main consumer-facing functions
 *   2. Plugins — built-in plugin instances and constructors
 *   3. Types — core type definitions for programs, plugins, expressions
 *   4. Compat shims — legacy API bridge for plugins not yet migrated
 *   5. Advanced / internal — DAG ops, predicates, elaboration internals
 */

// ─── 1. Public API ──────────────────────────────────────────────────
// Consumer-facing: mvfm, fold, defaults, injectInput, prelude

export { defaults, fold, injectInput, mvfm, prelude } from "./api";

// ─── 2. Plugins ─────────────────────────────────────────────────────
// Built-in plugin values and the core plugin/interpreter

export { control } from "./control";
export { coreInterpreter, corePlugin } from "./core-plugin";
export { error } from "./error";
export { fiber } from "./fiber";
export { st } from "./st";
export { boolPlugin, numPlugin, ordPlugin, strPlugin } from "./std-plugins";

// ─── 3. Types ───────────────────────────────────────────────────────
// Core type definitions used by plugin authors and consumers

export type { Program } from "./api";
export type { CExpr, NExpr, RuntimeEntry } from "./expr";
export type { FoldState, PluginDef } from "./fold";
export type {
  DollarSign,
  FoldYield,
  Handler,
  Interpreter,
  Plugin,
  RecurseScopedEffect,
  ScopedBinding,
  TraitDef,
} from "./plugin";
export type {
  KindSpec,
  LiftKind,
  RegistryEntry,
  StdRegistry,
  TraitKindSpec,
  TypeKey,
} from "./registry";

// ─── 4. Compat shims ───────────────────────────────────────────────
// Legacy API bridge — kept for external plugins not yet migrated (zod, openai, anthropic).
// These will be removed once all external plugins use the new API.

export {
  defineInterpreter,
  definePlugin,
  type Expr,
  type ExprBase,
  eval_,
  foldAST,
  type NodeTypeMap,
  type PluginContext,
  type TypedNode,
} from "./compat";

// U-suffixed aliases — deprecated, kept for external plugins not yet migrated.
import { numPlugin } from "./std-plugins";
import { boolPlugin } from "./std-plugins-bool";
import { strPlugin } from "./std-plugins-str";
/** @deprecated Use numPlugin instead. */
export const numPluginU = numPlugin;
/** @deprecated Use strPlugin instead. */
export const strPluginU = strPlugin;
/** @deprecated Use boolPlugin instead. */
export const boolPluginU = boolPlugin;

// ─── 5. Advanced / internal escape hatch ────────────────────────────
// DAG construction, elaboration, predicates, expression helpers.
// Use these when building custom tooling on top of the core.

// Commit / gc
export { commit, gc } from "./commit";
// Constructors (num, str, bool helpers)
export * from "./constructors";
// DAG operations
export { pipe } from "./dagql";
export * from "./dirty";
// Elaboration (CExpr → NExpr)
export { app, createApp, KIND_INPUTS, LIFT_MAP, TRAIT_MAP } from "./elaborate";
export type {
  AppResult,
  DeepResolve,
  ElaborateExpr,
  NeverGuard,
  SNodeEntry,
  UnionToTuple,
} from "./elaborate-types";
export type {
  AccessorOverlay,
  AdjOf,
  CArgsOf,
  CKindOf,
  COutOf,
  CtrOf,
  IdOf,
  NodeEntry,
  OutOf,
} from "./expr";
// Expression constructors and inspectors
export { CREF, isCExpr, makeCExpr, makeNExpr } from "./expr";
// Fold internals
export { createFoldState, recurseScoped, VOLATILE_KINDS } from "./fold";
export * from "./gc";
export * from "./increment";
export * from "./map";
export * from "./named";
export type { RegistryOf } from "./plugin";
// Plugin composition
export {
  buildKindInputs,
  buildLiftMap,
  buildStructuralShapes,
  buildTraitMap,
  mvfmU,
} from "./plugin";
export * from "./predicates";
export * from "./replace";
export * from "./select";
export * from "./splice";
// Std plugin internals
export { lt, stdPlugins } from "./std-plugins";
export { boolPlugin as _boolPluginDef } from "./std-plugins-bool";
export { ordPlugin as _ordPluginDef } from "./std-plugins-ord";
export { strPlugin as _strPluginDef } from "./std-plugins-str";
export * from "./structural-children";
export * from "./wrap";
