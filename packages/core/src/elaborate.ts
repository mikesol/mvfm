/** Elaborate — runtime normalization from CExpr to NExpr adjacency maps. */

import type { CExpr, RuntimeEntry } from "./expr";
import { isCExpr, makeNExpr } from "./expr";
import { incrementId } from "./increment";
import type { Plugin, RegistryOf } from "./plugin";
import { buildKindInputs, buildLiftMap, buildStructuralShapes, buildTraitMap } from "./plugin";
import type { KindSpec } from "./registry";
import { stdPlugins } from "./std-plugins";

// Re-export type-level types for consumers
export type {
  AppResult,
  DeepResolve,
  NeverGuard,
  SNodeEntry,
  UnionToTuple,
} from "./elaborate-types";

// ─── Precomputed runtime maps from stdPlugins ───────────────────────

/** Lift map from stdPlugins: maps TS type names to literal node kinds. */
export const LIFT_MAP: Record<string, string> = buildLiftMap(stdPlugins);

/** Trait map from stdPlugins: maps trait names to type-to-kind mappings. */
export const TRAIT_MAP: Record<string, Record<string, string>> = buildTraitMap(stdPlugins);

/** Kind-inputs map from stdPlugins: maps kind names to input type arrays. */
export const KIND_INPUTS: Record<string, string[]> = buildKindInputs(stdPlugins);

// ─── Runtime elaboration ────────────────────────────────────────────

function buildKindOutputs(plugins: readonly Plugin[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of plugins) {
    for (const [kind, spec] of Object.entries(p.kinds)) {
      m[kind] = typeof (spec as KindSpec<any, any>).output;
    }
  }
  return m;
}

function elaborate(
  expr: CExpr<unknown>,
  liftMap: Record<string, string>,
  traitMap: Record<string, Record<string, string>>,
  kindInputs: Record<string, string[]>,
  kindOutputs: Record<string, string>,
  structuralShapes: Record<string, unknown>,
): { rootId: string; entries: Record<string, RuntimeEntry>; counter: string } {
  const entries: Record<string, RuntimeEntry> = {};
  let counter = "a";
  const visitCache = new Map<unknown, [string, string]>();

  function visitAccess(arg: any): string {
    if (arg.__kind === "core/access") {
      const parentId = visitAccess(arg.__args[0]);
      const nodeId = counter;
      counter = incrementId(counter);
      entries[nodeId] = { kind: "core/access", children: [parentId], out: arg.__args[1] };
      return nodeId;
    }
    return visit(arg)[0];
  }

  function visitStructural(value: unknown, shape: unknown): unknown {
    if (isCExpr(value)) {
      const cexpr = value as CExpr<unknown>;
      if (cexpr.__kind === "core/access") return visitAccess(cexpr);
      return visit(value)[0];
    }
    // Dynamic shape: walk value's own structure
    if (shape === "*") {
      if (Array.isArray(value)) {
        return value.map((v) => visitStructural(v, "*"));
      }
      if (typeof value === "object" && value !== null) {
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(value)) {
          result[key] = visitStructural((value as Record<string, unknown>)[key], "*");
        }
        return result;
      }
      const typeTag = typeof value;
      const lk = liftMap[typeTag];
      if (!lk) throw new Error(`Cannot lift ${typeTag}`);
      const nid = counter;
      counter = incrementId(counter);
      entries[nid] = { kind: lk, children: [], out: value };
      return nid;
    }
    if (Array.isArray(shape) && Array.isArray(value)) {
      return value.map((v, i) => visitStructural(v, shape[i]));
    }
    if (typeof shape === "object" && shape !== null && !Array.isArray(shape)) {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(shape as object)) {
        result[key] = visitStructural(
          (value as Record<string, unknown>)[key],
          (shape as Record<string, unknown>)[key],
        );
      }
      return result;
    }
    const typeTag = typeof value;
    const liftKind = liftMap[typeTag];
    if (!liftKind) throw new Error(`Cannot lift ${typeTag}`);
    if (shape !== typeTag) throw new Error(`Expected ${shape}, got ${typeTag}`);
    const nodeId = counter;
    counter = incrementId(counter);
    entries[nodeId] = { kind: liftKind, children: [], out: value };
    return nodeId;
  }

  function visit(arg: unknown, expected?: string): [string, string] {
    if (isCExpr(arg)) {
      const cached = visitCache.get(arg);
      if (cached) return cached;
      const cexpr = arg as CExpr<unknown>;
      let kind = cexpr.__kind;
      const args = cexpr.__args;

      const cache = (result: [string, string]) => {
        visitCache.set(arg, result);
        return result;
      };

      if (kind === "core/access") {
        return cache([visitAccess(cexpr), expected ?? "object"]);
      }

      if (kind in traitMap) {
        const childResults = args.map((a) => visit(a));
        // Resolve trait using first non-"object"/"unknown" type, fallback to first
        let childType = childResults[0][1];
        if ((childType === "object" || childType === "unknown") && childResults.length > 1) {
          const alt = childResults[1][1];
          if (alt !== "object" && alt !== "unknown") childType = alt;
        }
        let resolved = traitMap[kind]?.[childType];
        // Fallback: for "object"/"unknown" types, try to pick any available implementation
        if (!resolved && (childType === "object" || childType === "unknown")) {
          const available = Object.values(traitMap[kind] ?? {});
          if (available.length > 0) resolved = available[0];
        }
        if (!resolved) {
          throw new Error(`No trait "${kind}" instance for type "${childType}"`);
        }
        kind = resolved;
        const childIds = childResults.map(([id]) => id);
        const nodeId = counter;
        counter = incrementId(counter);
        // Type mismatch check for binary traits (skip when either arg is object/unknown)
        if (
          childResults.length > 1 &&
          childResults[0][1] !== "object" &&
          childResults[0][1] !== "unknown" &&
          childResults[1][1] !== "object" &&
          childResults[1][1] !== "unknown" &&
          childResults[1][1] !== childResults[0][1]
        ) {
          throw new Error(
            `Trait "${cexpr.__kind}": args have different types (${childResults[0][1]} vs ${childResults[1][1]})`,
          );
        }
        entries[nodeId] = { kind, children: childIds, out: undefined };
        return cache([nodeId, kindOutputs[kind] ?? "unknown"]);
      }

      // Structural kind — walk args with shape descriptor
      if (kind in structuralShapes) {
        const childRef = visitStructural(args[0], structuralShapes[kind]);
        const nodeId = counter;
        counter = incrementId(counter);
        entries[nodeId] = { kind, children: [childRef] as any, out: undefined };
        return cache([nodeId, kindOutputs[kind] ?? "object"]);
      }

      const expectedInputs = kindInputs[kind];
      const childIds: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const exp = expectedInputs ? expectedInputs[i] : undefined;
        const [childId, childType] = visit(args[i], exp);
        if (exp && childType !== exp && childType !== "unknown" && childType !== "object") {
          throw new Error(`${kind}: expected ${exp} for arg ${i}, got ${childType}`);
        }
        childIds.push(childId);
      }
      const nodeId = counter;
      counter = incrementId(counter);
      entries[nodeId] = { kind, children: childIds, out: undefined };
      return cache([nodeId, kindOutputs[kind] ?? "unknown"]);
    }

    const typeTag = typeof arg;
    const liftKind = liftMap[typeTag];
    if (!liftKind) throw new Error(`Cannot lift value of type "${typeTag}"`);
    if (expected && typeTag !== expected) {
      throw new Error(`Expected ${expected}, got ${typeTag} (value: ${String(arg)})`);
    }
    const nodeId = counter;
    counter = incrementId(counter);
    entries[nodeId] = { kind: liftKind, children: [], out: arg };
    return [nodeId, typeTag];
  }

  const [rootId] = visit(expr);
  return { rootId, entries, counter };
}

// ─── Public API ─────────────────────────────────────────────────────

/** Create a typed app function from a custom set of plugins. */
export function createApp<const P extends readonly Plugin[]>(...plugins: P) {
  const lm = buildLiftMap(plugins);
  const tm = buildTraitMap(plugins);
  const ki = buildKindInputs(plugins);
  const ko = buildKindOutputs(plugins);
  const ss = buildStructuralShapes(plugins);
  return <Expr extends CExpr<any, string, readonly unknown[]>>(
    expr: Expr,
  ): import("./elaborate-types").AppResult<RegistryOf<P>, Expr> => {
    const { rootId, entries, counter } = elaborate(expr, lm, tm, ki, ko, ss);
    return makeNExpr(rootId, entries, counter) as any;
  };
}

/** Elaborate a CExpr into a normalized NExpr using the standard registry. */
export function app<
  Expr extends CExpr<any, string, readonly unknown[]>,
  Reg = import("./registry").StdRegistry,
>(expr: Expr): import("./elaborate-types").AppResult<Reg, Expr> {
  const ko = buildKindOutputs(stdPlugins);
  const { rootId, entries, counter } = elaborate(expr, LIFT_MAP, TRAIT_MAP, KIND_INPUTS, ko, {});
  return makeNExpr(rootId, entries, counter) as any;
}
