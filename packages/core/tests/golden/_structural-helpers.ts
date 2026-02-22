/**
 * TEST FIXTURE BUILDERS for structural elaboration patterns.
 *
 * These are NOT testing core's elaborate.ts — they build adjacency
 * maps for test fixtures. Core's app() handles the standard
 * CExpr→NExpr pipeline (positional children only). Structural
 * elaboration (records/tuples → named-map children) is plugin-level
 * logic from koan 04a/04b, not part of core's elaboration.
 *
 * What IS validated through core:
 * - fold() correctly handles string-yielding handlers (structural
 *   nodes yield string IDs to resolve named children)
 * - This is tested in structural-accessors.test.ts section 3
 *
 * What is NOT validated against core:
 * - structuralApp() — local reimplementation of koan 04a's appS
 * - accessorApp() — local reimplementation of koan 04b's accessor
 * These exist to BUILD test fixtures, not to validate core behavior.
 */
import {
  type CExpr,
  incrementId,
  isCExpr,
  LIFT_MAP,
  makeCExpr,
  type RuntimeEntry,
} from "../../src/index";

// ─── Types ───────────────────────────────────────────────────────────
export type SEntry = { kind: string; children: unknown; out: unknown };

// ─── Structural appS (from 04a) ─────────────────────────────────────
const SKIND: Record<string, string[] | "structural"> = {
  "num/literal": [],
  "num/add": ["number", "number"],
  "num/mul": ["number", "number"],
  "geom/point": "structural",
  "geom/line": "structural",
  "data/pair": "structural",
};
const SHAPES: Record<string, unknown> = {
  "geom/point": { x: "number", y: "number" },
  "geom/line": {
    start: { x: "number", y: "number" },
    end: { x: "number", y: "number" },
  },
  "data/pair": ["number", "number"],
};

export function structuralApp(expr: CExpr<unknown>): {
  __id: string;
  __adj: Record<string, SEntry>;
} {
  const entries: Record<string, SEntry> = {};
  let ctr = "a";
  const alloc = () => {
    const id = ctr;
    ctr = incrementId(ctr);
    return id;
  };
  function vStruct(val: unknown, shape: unknown): unknown {
    if (isCExpr(val)) return vExpr(val)[0];
    if (Array.isArray(shape) && Array.isArray(val)) return val.map((v, i) => vStruct(v, shape[i]));
    if (typeof shape === "object" && shape !== null && !Array.isArray(shape)) {
      const r: Record<string, unknown> = {};
      for (const k of Object.keys(shape as object))
        r[k] = vStruct((val as any)[k], (shape as any)[k]);
      return r;
    }
    const tt = typeof val;
    const lk = LIFT_MAP[tt];
    if (!lk) throw new Error(`Cannot lift ${tt}`);
    if (shape !== tt) throw new Error(`Expected ${shape}, got ${tt}`);
    const id = alloc();
    entries[id] = { kind: lk, children: [], out: val };
    return id;
  }
  function vExpr(arg: unknown): [string, string] {
    if (!isCExpr(arg)) throw new Error("visit expects CExpr");
    const { __kind: kind, __args: args } = arg as CExpr<unknown>;
    if (SKIND[kind] === "structural") {
      const cr = vStruct(args[0], SHAPES[kind]);
      const id = alloc();
      entries[id] = { kind, children: [cr], out: undefined };
      return [id, "object"];
    }
    const ch: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (isCExpr(args[i])) {
        ch.push(vExpr(args[i])[0]);
      } else {
        const lk = LIFT_MAP[typeof args[i]];
        if (!lk) throw new Error(`Cannot lift ${typeof args[i]}`);
        const id = alloc();
        entries[id] = { kind: lk, children: [], out: args[i] };
        ch.push(id);
      }
    }
    const id = alloc();
    entries[id] = { kind, children: ch, out: undefined };
    return [id, kind.startsWith("num/") ? "number" : "object"];
  }
  const [rootId] = vExpr(expr);
  return { __id: rootId, __adj: entries };
}

// ─── Constructors ────────────────────────────────────────────────────
export function point(a: { x: unknown; y: unknown }) {
  return makeCExpr("geom/point", [a]) as CExpr<unknown>;
}
export function line(a: { start: unknown; end: unknown }) {
  return makeCExpr("geom/line", [a]) as CExpr<unknown>;
}
export function pair(a: unknown, b: unknown) {
  return makeCExpr("data/pair", [[a, b]]) as CExpr<unknown>;
}

// ─── Accessor proxy (from 04b) ──────────────────────────────────────
const CREF = Symbol("cref");
export function makeCExprProxy(kind: string, args: unknown[]): any {
  const raw = { [CREF]: true as const, __kind: kind, __args: args };
  const proxy: any = new Proxy(raw, {
    get(t, prop) {
      if (prop === CREF || prop === "__kind" || prop === "__args" || typeof prop === "symbol")
        return (t as any)[prop];
      return makeCExprProxy("core/access", [proxy, prop]);
    },
  });
  return proxy;
}
export function deepThing() {
  return makeCExprProxy("test/deep", []);
}

function isCRef(x: unknown): boolean {
  return typeof x === "object" && x !== null && CREF in x;
}
export function accessorApp(expr: any): {
  __rootId: string;
  __adj: Record<string, RuntimeEntry>;
} {
  const entries: Record<string, RuntimeEntry> = {};
  let ctr = "a";
  const alloc = () => {
    const id = ctr;
    ctr = incrementId(ctr);
    return id;
  };
  function vAccess(arg: any): string {
    if (arg.__kind === "core/access") {
      const pid = vAccess(arg.__args[0]);
      const id = alloc();
      entries[id] = { kind: "core/access", children: [pid], out: arg.__args[1] };
      return id;
    }
    return vNode(arg);
  }
  function vNode(arg: any): string {
    if (arg.__kind === "core/access") return vAccess(arg);
    const ch: string[] = [];
    for (const child of arg.__args) {
      if (isCRef(child)) {
        ch.push((child as any).__kind === "core/access" ? vAccess(child) : vNode(child));
      } else {
        const lk = LIFT_MAP[typeof child];
        if (!lk) throw new Error(`Cannot lift ${typeof child}`);
        const id = alloc();
        entries[id] = { kind: lk, children: [], out: child };
        ch.push(id);
      }
    }
    const id = alloc();
    entries[id] = { kind: arg.__kind, children: ch, out: undefined };
    return id;
  }
  return { __rootId: vNode(expr), __adj: entries };
}

// ─── Helpers ─────────────────────────────────────────────────────────
export function adjOf(p: any): Record<string, SEntry> {
  return p.__adj;
}
export function rootOf(p: any): SEntry {
  return adjOf(p)[(p as any).__id ?? (p as any).__rootId];
}
