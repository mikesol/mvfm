import type { z } from "zod";
import {
  mapComparableChecks,
  mapLengthChecks,
  mapSizeChecks,
  mapStringChecks,
} from "./from-zod-checks";
import { readSchemaDef, warnOrThrow } from "./from-zod-utils";
import type { SchemaASTNode, WrapperASTNode } from "./types";

type ZodNode = SchemaASTNode | WrapperASTNode;

export type ConvertState = {
  strict: boolean;
  warnings: string[];
  lazyIds: WeakMap<object, string>;
  activeLazy: Set<object>;
  nextLazyId: number;
};

const fail = (state: ConvertState, path: string, message: string): void =>
  warnOrThrow(state.strict, state.warnings, path, message);

function convert(schema: unknown, state: ConvertState, path: string): ZodNode {
  const def = readSchemaDef(schema);
  const type = String(def.type);

  if (type === "lazy") {
    const key = schema as object;
    const lazyId = state.lazyIds.get(key) ?? `fromzod_lazy_${state.nextLazyId++}`;
    state.lazyIds.set(key, lazyId);
    if (state.activeLazy.has(key)) return { kind: "zod/lazy_ref", lazyId } as unknown as ZodNode;
    state.activeLazy.add(key);
    const target = convert((def.getter as () => unknown)(), state, `${path}.lazy`);
    state.activeLazy.delete(key);
    return { kind: "zod/lazy", lazyId, target, checks: [], refinements: [] } as SchemaASTNode;
  }

  if (["optional", "nullable", "nonoptional", "readonly"].includes(type)) {
    return {
      kind: `zod/${type}`,
      inner: convert(def.innerType, state, `${path}.${type}`),
    } as WrapperASTNode;
  }
  if (type === "default" || type === "prefault") {
    const value = typeof def.defaultValue === "function" ? def.defaultValue() : def.defaultValue;
    return {
      kind: `zod/${type}`,
      inner: convert(def.innerType, state, `${path}.${type}`),
      value,
    } as WrapperASTNode;
  }
  if (type === "catch") {
    const value = typeof def.catchValue === "function" ? def.catchValue() : def.catchValue;
    return {
      kind: "zod/catch",
      inner: convert(def.innerType, state, `${path}.catch`),
      value,
    } as WrapperASTNode;
  }

  if (type === "pipe") {
    const inDef = readSchemaDef(def.in);
    const outDef = readSchemaDef(def.out);
    if (outDef.type === "transform") {
      fail(state, path, "cannot convert transform closure");
      return convert(def.in, state, `${path}.transform_dropped`);
    }
    if (inDef.type === "transform") {
      fail(state, path, "cannot convert preprocess closure");
      return convert(def.out, state, `${path}.preprocess_dropped`);
    }
    return {
      kind: "zod/pipe",
      inner: convert(def.in, state, `${path}.pipe_in`),
      target: convert(def.out, state, `${path}.pipe_out`),
    } as WrapperASTNode;
  }

  if (type === "string") {
    const mapped = mapStringChecks((def.checks as unknown[]) ?? [], (message) =>
      fail(state, path, message),
    );
    return {
      kind: "zod/string",
      checks: mapped.checks,
      refinements: [],
      ...(mapped.format ? { format: mapped.format } : {}),
      ...(def.coerce ? { coerce: true } : {}),
      ...(typeof def.error === "string" ? { error: def.error } : {}),
    } as SchemaASTNode;
  }
  if (type === "number") {
    return {
      kind: "zod/number",
      checks: mapComparableChecks((def.checks as unknown[]) ?? [], false, (message) =>
        fail(state, path, message),
      ),
      refinements: [],
      ...(def.coerce ? { coerce: true } : {}),
      ...(typeof def.error === "string" ? { error: def.error } : {}),
    } as SchemaASTNode;
  }
  if (type === "bigint") {
    return {
      kind: "zod/bigint",
      checks: mapComparableChecks((def.checks as unknown[]) ?? [], true, (message) =>
        fail(state, path, message),
      ),
      refinements: [],
      ...(typeof def.error === "string" ? { error: def.error } : {}),
    } as SchemaASTNode;
  }
  if (type === "date") {
    return {
      kind: "zod/date",
      checks: mapComparableChecks((def.checks as unknown[]) ?? [], false, (message) =>
        fail(state, path, message),
      ).flatMap((c) => {
        if (c.kind === "gte")
          return [
            { kind: "min", value: new Date(c.value as string | number | Date).toISOString() },
          ];
        if (c.kind === "lte")
          return [
            { kind: "max", value: new Date(c.value as string | number | Date).toISOString() },
          ];
        fail(state, path, `unsupported exclusive date check "${c.kind}"`);
        return [];
      }),
      refinements: [],
      ...(typeof def.error === "string" ? { error: def.error } : {}),
    } as SchemaASTNode;
  }
  if (type === "boolean")
    return { kind: "zod/boolean", checks: [], refinements: [] } as SchemaASTNode;
  if (type === "null") return { kind: "zod/null", checks: [], refinements: [] } as SchemaASTNode;
  if (type === "undefined")
    return { kind: "zod/undefined", checks: [], refinements: [] } as SchemaASTNode;
  if (type === "void") return { kind: "zod/void", checks: [], refinements: [] } as SchemaASTNode;
  if (type === "symbol")
    return { kind: "zod/symbol", checks: [], refinements: [] } as SchemaASTNode;
  if (type === "any") return { kind: "zod/any", checks: [], refinements: [] } as SchemaASTNode;
  if (type === "unknown")
    return { kind: "zod/unknown", checks: [], refinements: [] } as SchemaASTNode;
  if (type === "never") return { kind: "zod/never", checks: [], refinements: [] } as SchemaASTNode;
  if (type === "nan") return { kind: "zod/nan", checks: [], refinements: [] } as SchemaASTNode;
  if (type === "literal") {
    const values = (def.values as unknown[]) ?? [];
    return {
      kind: "zod/literal",
      checks: [],
      refinements: [],
      value: values.length <= 1 ? values[0] : values,
    } as SchemaASTNode;
  }
  if (type === "enum") {
    const entries = (def.entries as Record<string, unknown>) ?? {};
    const values = Object.values(entries);
    const plain =
      values.every((v) => typeof v === "string") &&
      Object.entries(entries).every(([k, v]) => k === v);
    return (plain
      ? { kind: "zod/enum", checks: [], refinements: [], values }
      : {
          kind: "zod/native_enum",
          checks: [],
          refinements: [],
          entries,
        }) as unknown as SchemaASTNode;
  }
  if (type === "object") {
    const rawShape =
      typeof def.shape === "function"
        ? (def.shape as () => Record<string, unknown>)()
        : ((def.shape as Record<string, unknown>) ?? {});
    const shape: Record<string, ZodNode> = {};
    for (const [key, value] of Object.entries(rawShape)) {
      shape[key] = convert(value, state, `${path}.${key}`);
    }
    const out: {
      kind: string;
      checks: [];
      refinements: [];
      shape: Record<string, ZodNode>;
      mode: string;
      catchall?: ZodNode;
    } = {
      kind: "zod/object",
      checks: [],
      refinements: [],
      shape,
      mode: "strip",
    };
    if (def.catchall) {
      const cType = String(readSchemaDef(def.catchall).type);
      if (cType === "never") out.mode = "strict";
      else if (cType === "unknown") out.mode = "loose";
      else out.catchall = convert(def.catchall, state, `${path}.catchall`);
    }
    return out as unknown as SchemaASTNode;
  }
  if (type === "array") {
    return {
      kind: "zod/array",
      checks: mapLengthChecks((def.checks as unknown[]) ?? [], (message) =>
        fail(state, path, message),
      ),
      refinements: [],
      element: convert(def.element, state, `${path}.element`),
    } as SchemaASTNode;
  }
  if (type === "tuple") {
    return {
      kind: "zod/tuple",
      checks: [],
      refinements: [],
      items: ((def.items as unknown[]) ?? []).map((item, idx) =>
        convert(item, state, `${path}.items[${idx}]`),
      ),
      ...(def.rest ? { rest: convert(def.rest, state, `${path}.rest`) } : {}),
    } as SchemaASTNode;
  }
  if (type === "record") {
    return {
      kind: "zod/record",
      checks: [],
      refinements: [],
      key: convert(def.keyType, state, `${path}.keyType`),
      value: convert(def.valueType, state, `${path}.valueType`),
      mode: def.mode === "loose" ? "loose" : "strict",
    } as SchemaASTNode;
  }
  if (type === "map") {
    return {
      kind: "zod/map",
      checks: [],
      refinements: [],
      key: convert(def.keyType, state, `${path}.keyType`),
      value: convert(def.valueType, state, `${path}.valueType`),
    } as SchemaASTNode;
  }
  if (type === "set") {
    return {
      kind: "zod/set",
      checks: mapSizeChecks((def.checks as unknown[]) ?? [], (message) =>
        fail(state, path, message),
      ),
      refinements: [],
      value: convert(def.valueType, state, `${path}.valueType`),
    } as SchemaASTNode;
  }
  if (type === "intersection") {
    return {
      kind: "zod/intersection",
      checks: [],
      refinements: [],
      left: convert(def.left, state, `${path}.left`),
      right: convert(def.right, state, `${path}.right`),
    } as SchemaASTNode;
  }
  if (type === "union") {
    const options = ((def.options as unknown[]) ?? []).map((option, idx) =>
      convert(option, state, `${path}.options[${idx}]`),
    );
    if (typeof def.discriminator === "string") {
      return {
        kind: "zod/discriminated_union",
        checks: [],
        refinements: [],
        discriminator: def.discriminator,
        options,
      } as SchemaASTNode;
    }
    return {
      kind: "zod/union",
      checks: [],
      refinements: [],
      options,
    } as SchemaASTNode;
  }
  if (type === "promise") {
    return {
      kind: "zod/promise",
      inner: convert(def.innerType, state, `${path}.promise`),
    } as WrapperASTNode;
  }
  if (type === "custom") {
    fail(state, path, "cannot convert custom closure schema");
    return { kind: "zod/any", checks: [], refinements: [] } as SchemaASTNode;
  }

  fail(state, path, `unsupported zod type "${type}"`);
  return { kind: "zod/any", checks: [], refinements: [] } as SchemaASTNode;
}

export const convertZodSchemaToNode = <T>(schema: z.ZodType<T>, state: ConvertState): ZodNode =>
  convert(schema, state, "$.zod.from");
