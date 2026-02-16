import type { PluginContext, TypedNode } from "@mvfm/core";
import { ZodSchemaBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

export class ZodNumberBuilder extends ZodSchemaBuilder<number> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
    kind: "zod/number" | "zod/nan" = "zod/number",
  ) {
    super(ctx, kind, checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodNumberBuilder {
    return new ZodNumberBuilder(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
      this._kind as "zod/number" | "zod/nan",
    );
  }

  gt(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this._addCheck("gt", { value }, opts);
  }

  gte(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this._addCheck("gte", { value }, opts);
  }

  min(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this.gte(value, opts);
  }

  lt(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this._addCheck("lt", { value }, opts);
  }

  lte(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this._addCheck("lte", { value }, opts);
  }

  max(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this.lte(value, opts);
  }

  positive(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("positive", {}, opts);
  }

  nonnegative(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("nonnegative", {}, opts);
  }

  negative(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("negative", {}, opts);
  }

  nonpositive(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("nonpositive", {}, opts);
  }

  multipleOf(
    step: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this._addCheck("multiple_of", { value: step }, opts);
  }

  step(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this.multipleOf(value, opts);
  }

  int(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("int", {}, opts);
  }

  finite(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("finite", {}, opts);
  }

  safe(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("safe", {}, opts);
  }
}

export const numberNodeKinds: string[] = ["zod/number", "zod/nan"];

export interface ZodNumberNamespace {
  number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  int(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  int32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  int64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  uint32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  uint64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  float32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  float64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  nan(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
}

export function numberNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodNumberNamespace {
  return {
    number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts));
    },
    int(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int" });
    },
    int32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int32" });
    },
    int64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int64" });
    },
    uint32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "uint32" });
    },
    uint64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "uint64" });
    },
    float32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "float32" });
    },
    float64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "float64" });
    },
    nan(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), {}, "zod/nan");
    },
  };
}

export { numberInterpreter } from "./number-interpreter";
