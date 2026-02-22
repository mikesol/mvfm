import { ZodSchemaBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

export class ZodNumberBuilder extends ZodSchemaBuilder<number> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
    kind: "zod/number" | "zod/nan" = "zod/number",
  ) {
    super(kind, checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodNumberBuilder {
    return new ZodNumberBuilder(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
      this._kind as "zod/number" | "zod/nan",
    );
  }

  gt(value: number, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this._addCheck("gt", { value }, opts);
  }

  gte(value: number, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this._addCheck("gte", { value }, opts);
  }

  min(value: number, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this.gte(value, opts);
  }

  lt(value: number, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this._addCheck("lt", { value }, opts);
  }

  lte(value: number, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this._addCheck("lte", { value }, opts);
  }

  max(value: number, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this.lte(value, opts);
  }

  positive(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this._addCheck("positive", {}, opts);
  }

  nonnegative(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this._addCheck("nonnegative", {}, opts);
  }

  negative(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this._addCheck("negative", {}, opts);
  }

  nonpositive(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this._addCheck("nonpositive", {}, opts);
  }

  multipleOf(
    step: number,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodNumberBuilder {
    return this._addCheck("multiple_of", { value: step }, opts);
  }

  step(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodNumberBuilder {
    return this.multipleOf(value, opts);
  }

  int(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this._addCheck("int", {}, opts);
  }

  finite(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this._addCheck("finite", {}, opts);
  }

  safe(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodNumberBuilder {
    return this._addCheck("safe", {}, opts);
  }
}

/** Build the number namespace factory methods. */
export function numberNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder([], [], parseError(errorOrOpts));
    },
    int(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder([], [], parseError(errorOrOpts), { variant: "int" });
    },
    int32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder([], [], parseError(errorOrOpts), { variant: "int32" });
    },
    int64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder([], [], parseError(errorOrOpts), { variant: "int64" });
    },
    uint32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder([], [], parseError(errorOrOpts), { variant: "uint32" });
    },
    uint64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder([], [], parseError(errorOrOpts), { variant: "uint64" });
    },
    float32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder([], [], parseError(errorOrOpts), { variant: "float32" });
    },
    float64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder([], [], parseError(errorOrOpts), { variant: "float64" });
    },
    nan(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder([], [], parseError(errorOrOpts), {}, "zod/nan");
    },
  };
}

export { numberInterpreter } from "./number-interpreter";
