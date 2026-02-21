import { buildKindInputs, buildLiftMap, buildTraitMap, boolPluginU, lt, mvfmU, numPluginU, ordPlugin, stdPlugins, strPluginU } from "./composition";
import { add, boolLit, eq, isCExpr, makeCExpr, makeNExpr, mul, numLit, strLit, sub } from "./expr";
import { incrementId } from "./increment";

/**
 * Koan-model API namespace (00-03a compatibility surface).
 */
export const koan = {
  add,
  boolLit,
  buildKindInputs,
  buildLiftMap,
  buildTraitMap,
  eq,
  incrementId,
  isCExpr,
  lt,
  makeCExpr,
  makeNExpr,
  mul,
  mvfmU,
  numLit,
  strLit,
  sub,
  boolPluginU,
  numPluginU,
  ordPlugin,
  stdPlugins,
  strPluginU,
};

export type {
  AdjOf,
  CExpr,
  CtrOf,
  IdOf,
  KindSpec,
  LiftKind,
  NExpr,
  OutOf,
  RuntimeEntry,
  StdRegistry,
  TraitKindSpec,
  TypeKey,
} from "./expr";
export type { Plugin, PluginShape, RegistryOf, TraitDef } from "./composition";
export type { Increment, IncrementLast } from "./increment";
export type { NeverGuard } from "./normalize-types";
