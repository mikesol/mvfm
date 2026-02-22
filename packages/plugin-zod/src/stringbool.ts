import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

interface ZodStringboolNode extends ZodSchemaNodeBase {
  kind: "zod/stringbool";
  truthy?: string[];
  falsy?: string[];
  coerce?: boolean;
}

export class ZodStringboolBuilder extends ZodSchemaBuilder<boolean> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/stringbool", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodStringboolBuilder {
    return new ZodStringboolBuilder(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

export interface StringboolOptions {
  truthy?: string[];
  falsy?: string[];
  coerce?: boolean;
}

/** Build the stringbool namespace factory methods. */
export function stringboolNamespace() {
  return {
    stringbool(opts?: StringboolOptions): ZodStringboolBuilder {
      const extra: Record<string, unknown> = {};
      if (opts?.truthy) extra.truthy = opts.truthy;
      if (opts?.falsy) extra.falsy = opts.falsy;
      if (opts?.coerce !== undefined) extra.coerce = opts.coerce;
      return new ZodStringboolBuilder([], [], undefined, extra);
    },
  };
}

export const stringboolInterpreter: SchemaInterpreterMap = {
  "zod/stringbool": async function* (node: ZodStringboolNode) {
    const opts: Record<string, unknown> = {};
    if (node.truthy) opts.truthy = node.truthy;
    if (node.falsy) opts.falsy = node.falsy;
    if (node.coerce !== undefined) opts.coerce = node.coerce;
    return Object.keys(opts).length > 0 ? z.stringbool(opts) : z.stringbool();
  },
};
