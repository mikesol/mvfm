// registry.ts — Operation registry types and factory functions
import type { CExpr, Interpreter, KindSpec, RuntimeEntry } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import type { StripeClient } from "./interpreter";

// ---- liftArg (moved here for shared use) ----

/** Recursively lifts a plain value into a CExpr tree. */
export function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return makeCExpr("stripe/array", value.map(liftArg));
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("stripe/record", pairs);
  }
  return value;
}

const mk = makeCExpr as <O, K extends string, A extends readonly unknown[]>(kind: K, args: readonly unknown[]) => CExpr<O, K, A>;

// ---- Operation definition types ----

/** Argument pattern for an operation. */
export type ArgPattern =
  | "params"        // create(params)
  | "id"            // retrieve(id)
  | "id,params"     // update(id, params)
  | "id,params?"    // action(id, params?)
  | "params?"       // list(params?)
  | "del"           // del(id) — uses DELETE
  | ""              // singleton retrieve()
  | "singleton,params" // singleton update(params)
  | "id,childId"        // nested retrieve(parentId, childId)
  | "id,childId,params" // nested update(parentId, childId, params)
  | "id,childId,del"    // nested del(parentId, childId)
  | "id,nestedParams?"  // nested list(parentId, params?)
  | "id,nestedParams"   // nested create(parentId, params)
  ;

/** Single operation definition. */
export interface OpDef {
  kind: string;
  httpMethod: "GET" | "POST" | "DELETE";
  path: string;
  argPattern: ArgPattern;
}

/** Resource definition: a named group of operations. */
export interface ResourceDef {
  [method: string]: OpDef;
}

// ---- Factory: constructors ----

/** Builds a constructor function from an OpDef. */
function makeCtor(op: OpDef): Function {
  switch (op.argPattern) {
    case "params":
      return (params: unknown) => mk(op.kind, [liftArg(params)]);
    case "id":
      return (id: unknown) => mk(op.kind, [id]);
    case "id,params":
      return (id: unknown, params: unknown) => mk(op.kind, [id, liftArg(params)]);
    case "id,params?":
      return (id: unknown, ...rest: unknown[]) => mk(op.kind, [id, ...rest.map(liftArg)]);
    case "params?":
      return (...rest: unknown[]) => mk(op.kind, rest.map(liftArg));
    case "del":
      return (id: unknown) => mk(op.kind, [id]);
    case "":
      return () => mk(op.kind, []);
    case "singleton,params":
      return (params: unknown) => mk(op.kind, [liftArg(params)]);
    case "id,childId":
      return (parentId: unknown, childId: unknown) => mk(op.kind, [parentId, childId]);
    case "id,childId,params":
      return (parentId: unknown, childId: unknown, params: unknown) => mk(op.kind, [parentId, childId, liftArg(params)]);
    case "id,childId,del":
      return (parentId: unknown, childId: unknown) => mk(op.kind, [parentId, childId]);
    case "id,nestedParams?":
      return (parentId: unknown, ...rest: unknown[]) => mk(op.kind, [parentId, ...rest.map(liftArg)]);
    case "id,nestedParams":
      return (parentId: unknown, params: unknown) => mk(op.kind, [parentId, liftArg(params)]);
  }
}

/** Builds constructor methods for a resource. */
export function makeCtors(def: ResourceDef): Record<string, Function> {
  const ctors: Record<string, Function> = {};
  for (const [method, op] of Object.entries(def)) {
    ctors[method] = makeCtor(op);
  }
  return ctors;
}

// ---- Factory: kind specs ----

function kindSpecForPattern(pattern: ArgPattern): KindSpec<unknown[], unknown> {
  switch (pattern) {
    case "params":
    case "id":
    case "del":
    case "singleton,params":
      return { inputs: [undefined] as [unknown], output: undefined as unknown } as KindSpec<[unknown], unknown>;
    case "id,params":
    case "id,childId":
    case "id,childId,del":
    case "id,nestedParams":
      return { inputs: [undefined, undefined] as [unknown, unknown], output: undefined as unknown } as KindSpec<[unknown, unknown], unknown>;
    case "id,childId,params":
      return { inputs: [undefined, undefined, undefined] as [unknown, unknown, unknown], output: undefined as unknown } as KindSpec<[unknown, unknown, unknown], unknown>;
    case "id,params?":
    case "params?":
    case "id,nestedParams?":
    case "":
      return { inputs: [] as unknown[], output: undefined as unknown } as KindSpec<unknown[], unknown>;
  }
}

/** Builds kind specs from a resource definition. */
export function makeKindSpecs(def: ResourceDef): Record<string, KindSpec<unknown[], unknown>> {
  const kinds: Record<string, KindSpec<unknown[], unknown>> = {};
  for (const op of Object.values(def)) {
    kinds[op.kind] = kindSpecForPattern(op.argPattern);
  }
  return kinds;
}

// ---- Factory: interpreter handlers ----

function makeHandler(op: OpDef, client: StripeClient): (entry: RuntimeEntry) => AsyncGenerator<number, unknown, unknown> {
  switch (op.argPattern) {
    case "params":
    case "singleton,params":
      return async function* (_entry: RuntimeEntry) {
        const params = yield 0;
        return await client.request(op.httpMethod, op.path, params as Record<string, unknown>);
      };
    case "id":
      return async function* (_entry: RuntimeEntry) {
        const id = yield 0;
        return await client.request(op.httpMethod, op.path.replace("{0}", String(id)));
      };
    case "del":
      return async function* (_entry: RuntimeEntry) {
        const id = yield 0;
        return await client.request("DELETE", op.path.replace("{0}", String(id)));
      };
    case "id,params":
      return async function* (_entry: RuntimeEntry) {
        const id = yield 0;
        const params = yield 1;
        return await client.request(op.httpMethod, op.path.replace("{0}", String(id)), params as Record<string, unknown>);
      };
    case "id,params?":
      return async function* (entry: RuntimeEntry) {
        const id = yield 0;
        const params = entry.children.length > 1 ? ((yield 1) as Record<string, unknown>) : undefined;
        return await client.request(op.httpMethod, op.path.replace("{0}", String(id)), params);
      };
    case "params?":
      return async function* (entry: RuntimeEntry) {
        const params = entry.children.length > 0 ? ((yield 0) as Record<string, unknown>) : undefined;
        return await client.request(op.httpMethod, op.path, params);
      };
    case "":
      return async function* (_entry: RuntimeEntry) {
        return await client.request(op.httpMethod, op.path);
      };
    case "id,childId":
      return async function* (_entry: RuntimeEntry) {
        const parentId = yield 0;
        const childId = yield 1;
        return await client.request(op.httpMethod, op.path.replace("{0}", String(parentId)).replace("{1}", String(childId)));
      };
    case "id,childId,params":
      return async function* (_entry: RuntimeEntry) {
        const parentId = yield 0;
        const childId = yield 1;
        const params = yield 2;
        return await client.request(op.httpMethod, op.path.replace("{0}", String(parentId)).replace("{1}", String(childId)), params as Record<string, unknown>);
      };
    case "id,childId,del":
      return async function* (_entry: RuntimeEntry) {
        const parentId = yield 0;
        const childId = yield 1;
        return await client.request("DELETE", op.path.replace("{0}", String(parentId)).replace("{1}", String(childId)));
      };
    case "id,nestedParams?":
      return async function* (entry: RuntimeEntry) {
        const parentId = yield 0;
        const params = entry.children.length > 1 ? ((yield 1) as Record<string, unknown>) : undefined;
        return await client.request(op.httpMethod, op.path.replace("{0}", String(parentId)), params);
      };
    case "id,nestedParams":
      return async function* (_entry: RuntimeEntry) {
        const parentId = yield 0;
        const params = yield 1;
        return await client.request(op.httpMethod, op.path.replace("{0}", String(parentId)), params as Record<string, unknown>);
      };
  }
}

/** Builds interpreter handlers from a resource definition. */
export function makeHandlers(def: ResourceDef, client: StripeClient): Interpreter {
  const handlers: Interpreter = {};
  for (const op of Object.values(def)) {
    handlers[op.kind] = makeHandler(op, client);
  }
  return handlers;
}

// ---- Structural kinds (record/array) — always included ----

export const structuralKinds: Record<string, KindSpec<unknown[], unknown>> = {
  "stripe/record": { inputs: [] as unknown[], output: {} as Record<string, unknown> } as KindSpec<unknown[], Record<string, unknown>>,
  "stripe/array": { inputs: [] as unknown[], output: [] as unknown[] } as KindSpec<unknown[], unknown[]>,
};

export function structuralHandlers(client: StripeClient): Interpreter {
  return {
    "stripe/record": async function* (entry: RuntimeEntry) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < entry.children.length; i += 2) {
        const key = (yield i) as string;
        const value = yield i + 1;
        result[key] = value;
      }
      return result;
    },
    "stripe/array": async function* (entry: RuntimeEntry) {
      const result: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        result.push(yield i);
      }
      return result;
    },
  };
}
