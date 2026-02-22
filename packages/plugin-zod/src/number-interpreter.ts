import { z } from "zod";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { checkErrorOpt, toZodError } from "./interpreter-utils";
import type { CheckDescriptor, ErrorConfig, ZodSchemaNodeBase } from "./types";

interface ZodNumberNode extends ZodSchemaNodeBase {
  kind: "zod/number";
  variant?: string;
  coerce?: boolean;
}

interface ZodNanNode extends ZodSchemaNodeBase {
  kind: "zod/nan";
}

function applyNumberChecks(schema: z.ZodNumber, checks: CheckDescriptor[]): z.ZodNumber {
  let s = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "gt":
        s = s.gt(check.value as number, errOpt);
        break;
      case "gte":
        s = s.gte(check.value as number, errOpt);
        break;
      case "lt":
        s = s.lt(check.value as number, errOpt);
        break;
      case "lte":
        s = s.lte(check.value as number, errOpt);
        break;
      case "positive":
        s = s.positive(errOpt);
        break;
      case "nonnegative":
        s = s.nonnegative(errOpt);
        break;
      case "negative":
        s = s.negative(errOpt);
        break;
      case "nonpositive":
        s = s.nonpositive(errOpt);
        break;
      case "multiple_of":
        s = s.multipleOf(check.value as number, errOpt);
        break;
      case "int":
        s = s.int(errOpt);
        break;
      case "finite":
        s = s.finite(errOpt);
        break;
      case "safe":
        s = s.safe(errOpt);
        break;
      default:
        throw new Error(`Zod interpreter: unknown number check "${check.kind}"`);
    }
  }
  return s;
}

function variantChecks(variant: string | undefined): CheckDescriptor[] {
  switch (variant) {
    case "int":
      return [{ kind: "int" }, { kind: "safe" }];
    case "int32":
      return [
        { kind: "int" },
        { kind: "gte", value: -2147483648 },
        { kind: "lte", value: 2147483647 },
      ];
    case "int64":
      return [{ kind: "int" }, { kind: "safe" }];
    case "uint32":
      return [{ kind: "int" }, { kind: "gte", value: 0 }, { kind: "lte", value: 4294967295 }];
    case "uint64":
      return [{ kind: "int" }, { kind: "gte", value: 0 }, { kind: "safe" }];
    case "float32":
      return [
        { kind: "finite" },
        { kind: "gte", value: -3.4028235e38 },
        { kind: "lte", value: 3.4028235e38 },
      ];
    case "float64":
      return [{ kind: "finite" }];
    default:
      return [];
  }
}

export const numberInterpreter: SchemaInterpreterMap = {
  "zod/number": async function* (node: ZodNumberNode): AsyncGenerator<unknown, z.ZodType, unknown> {
    const variant = node.variant as string | undefined;
    const explicitChecks = (node.checks as CheckDescriptor[]) ?? [];
    const allChecks = [...variantChecks(variant), ...explicitChecks];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const ctor = node.coerce === true ? z.coerce.number : z.number;
    const base = errorFn ? ctor({ error: errorFn }) : ctor();
    return applyNumberChecks(base as z.ZodNumber, allChecks);
  },
  "zod/nan": async function* (node: ZodNanNode): AsyncGenerator<unknown, z.ZodType, unknown> {
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    return errorFn ? z.nan({ error: errorFn }) : z.nan();
  },
};
