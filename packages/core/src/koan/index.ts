import { deepThing } from "./accessor";
import {
  boolPluginU,
  buildKindInputs,
  buildLiftMap,
  buildTraitMap,
  lt,
  mvfmU,
  numPluginU,
  ordPlugin,
  stdPlugins,
  strPluginU,
} from "./composition";
import { add, boolLit, eq, isCExpr, makeCExpr, makeNExpr, mul, numLit, strLit, sub } from "./expr";
import { incrementId } from "./increment";
import { mapWhere } from "./map";
import { app, createApp } from "./normalize";
import { and, byKind, byKindGlob, byName, hasChildCount, isLeaf, not, or } from "./predicates";
import { selectWhere } from "./select";
import { appS, point } from "./structural";

/**
 * Koan-model API namespace (00-03a compatibility surface).
 */
export const koan = {
  add,
  boolLit,
  buildKindInputs,
  buildLiftMap,
  buildTraitMap,
  createApp,
  app,
  appS,
  point,
  deepThing,
  eq,
  incrementId,
  isCExpr,
  lt,
  mapWhere,
  makeCExpr,
  makeNExpr,
  mul,
  mvfmU,
  not,
  numLit,
  strLit,
  selectWhere,
  sub,
  byKind,
  byKindGlob,
  byName,
  hasChildCount,
  isLeaf,
  and,
  or,
  boolPluginU,
  numPluginU,
  ordPlugin,
  stdPlugins,
  strPluginU,
};

export type { Plugin, PluginShape, RegistryOf, TraitDef } from "./composition";
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
export type { Increment, IncrementLast } from "./increment";
export type { MapAdj, MapOut, MatchingEntries } from "./map";
export type { NeverGuard } from "./normalize-types";
export type {
  AndPred,
  CountPred,
  EvalPred,
  KindGlobPred,
  KindPred,
  LeafPred,
  NamePred,
  NotPred,
  OrPred,
  PredBase,
  SelectKeys,
} from "./predicates";
