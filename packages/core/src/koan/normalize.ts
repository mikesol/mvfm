import {
  buildKindInputs,
  buildLiftMap,
  buildTraitMap,
  type Plugin,
  type RegistryOf,
  stdPlugins,
} from "./composition";
import { type CExpr, isCExpr, makeNExpr, type NExpr, type RuntimeEntry } from "./expr";
import { incrementId } from "./increment";
import type { AppResult } from "./normalize-types";

export type { AppResult } from "./normalize-types";

function buildKindOutputs(plugins: readonly Plugin[]): Record<string, string> {
  const outputs: Record<string, string> = {};
  for (const p of plugins) {
    for (const [kind, spec] of Object.entries(p.kinds)) {
      outputs[kind] = typeof spec.output;
    }
  }
  return outputs;
}

function elaborate(
  expr: CExpr<unknown>,
  liftMap: Record<string, string>,
  traitMap: Record<string, Record<string, string>>,
  kindInputs: Record<string, string[]>,
  kindOutputs: Record<string, string>,
): NExpr<unknown, string, Record<string, RuntimeEntry>, string> {
  const entries: Record<string, RuntimeEntry> = {};
  let counter = "a";

  function alloc(): string {
    const id = counter;
    counter = incrementId(counter);
    return id;
  }

  function visitValue(value: unknown, expectedTag?: string): { id: string; outType: string } {
    if (isCExpr(value)) {
      return visitExpr(value as CExpr<unknown>, expectedTag);
    }
    if (Array.isArray(value)) {
      const childIds = value.map((v) => visitValue(v).id);
      const id = alloc();
      entries[id] = { kind: "core/tuple", children: [], out: childIds };
      return { id, outType: "object" };
    }
    if (value !== null && typeof value === "object") {
      const childMap: Record<string, string> = {};
      for (const [k, v] of Object.entries(value)) {
        childMap[k] = visitValue(v).id;
      }
      const id = alloc();
      entries[id] = { kind: "core/record", children: [], out: childMap };
      return { id, outType: "object" };
    }

    const tag = typeof value;
    if (expectedTag && expectedTag !== tag) {
      throw new Error(`Expected ${expectedTag}, got ${tag}`);
    }
    const liftKind = liftMap[tag];
    if (!liftKind) {
      throw new Error(`No lift kind for ${tag}`);
    }
    const id = alloc();
    entries[id] = { kind: liftKind, children: [], out: value };
    return { id, outType: tag };
  }

  function visitExpr(node: CExpr<unknown>, expectedTag?: string): { id: string; outType: string } {
    const kind = node.__kind;
    const args = node.__args;

    if (kind === "core/access") {
      const parent = visitValue(args[0]);
      const key = args[1];
      const id = alloc();
      entries[id] = { kind, children: [parent.id], out: key };
      return { id, outType: expectedTag ?? "unknown" };
    }

    if (kind in traitMap) {
      const left = visitValue(args[0]);
      const right = visitValue(args[1], left.outType);
      const resolved = traitMap[kind]?.[left.outType];
      if (!resolved) throw new Error(`No ${kind} implementation for type: ${left.outType}`);
      const id = alloc();
      entries[id] = { kind: resolved, children: [left.id, right.id], out: undefined };
      return { id, outType: kindOutputs[resolved] ?? expectedTag ?? "unknown" };
    }

    const expectedInputs = kindInputs[kind] ?? [];
    const childIds = args.map((arg, i) => visitValue(arg, expectedInputs[i]).id);
    const id = alloc();
    entries[id] = { kind, children: childIds, out: undefined };
    return { id, outType: kindOutputs[kind] ?? expectedTag ?? "unknown" };
  }

  const root = visitExpr(expr);
  return makeNExpr(root.id, entries, counter) as NExpr<
    unknown,
    string,
    Record<string, RuntimeEntry>,
    string
  >;
}

/** Create a normalize app from a plugin tuple. */
export function createApp<const P extends readonly Plugin[]>(...plugins: P) {
  const liftMap = buildLiftMap(plugins);
  const traitMap = buildTraitMap(plugins);
  const kindInputs = buildKindInputs(plugins);
  const kindOutputs = buildKindOutputs(plugins);

  return function app<Expr extends CExpr<unknown>>(expr: Expr): AppResult<RegistryOf<P>, Expr> {
    return elaborate(expr, liftMap, traitMap, kindInputs, kindOutputs) as unknown as AppResult<
      RegistryOf<P>,
      Expr
    >;
  };
}

/** Std-plugin app for koan normalize behavior. */
export const app = createApp(...stdPlugins);
/** Std-plugin lift map. */
export const LIFT_MAP = buildLiftMap(stdPlugins);
/** Std-plugin trait map. */
export const TRAIT_MAP = buildTraitMap(stdPlugins);
/** Std-plugin kind-input map. */
export const KIND_INPUTS = buildKindInputs(stdPlugins);
