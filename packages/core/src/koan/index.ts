import { deepThing } from "./accessor";
import { defaults, fold } from "./bridge";
import { commit, gc } from "./commit";
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
import { pipe } from "./dagql";
import { addEntry, dirty, removeEntry, rewireChildren, setRoot, swapEntry } from "./dirty";
import { add, boolLit, eq, isCExpr, makeCExpr, makeNExpr, mul, numLit, strLit, sub } from "./expr";
import { collectReachable, liveAdj } from "./gc";
import { incrementId } from "./increment";
import { mapWhere } from "./map";
import { gcPreservingAliases, name } from "./named";
import { app, createApp } from "./normalize";
import { and, byKind, byKindGlob, byName, hasChildCount, isLeaf, not, or } from "./predicates";
import { replaceWhere } from "./replace";
import { selectWhere } from "./select";
import { spliceWhere } from "./splice";
import { appS, point } from "./structural";
import { wrapByName } from "./wrap";

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
  fold,
  defaults,
  commit,
  gc,
  gcPreservingAliases,
  name,
  pipe,
  eq,
  collectReachable,
  liveAdj,
  incrementId,
  isCExpr,
  lt,
  mapWhere,
  replaceWhere,
  wrapByName,
  spliceWhere,
  dirty,
  addEntry,
  removeEntry,
  swapEntry,
  rewireChildren,
  setRoot,
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

export type { Handler, Interpreter, PluginDef } from "./bridge";
export type { Plugin, PluginShape, RegistryOf, TraitDef } from "./composition";
export type { DirtyAdjOf, DirtyCtrOf, DirtyExpr, DirtyIdOf, DirtyOutOf, RewireAdj } from "./dirty";
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
export type { CollectReachable, LiveAdj } from "./gc";
export type { Increment, IncrementLast } from "./increment";
export type { MapAdj, MapOut, MatchingEntries } from "./map";
export type { NameAlias, PreserveAliases } from "./named";
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
export type { SpliceAdj } from "./splice";
export type { WrapOneResult } from "./wrap";
