import type { ASTNode, InterpreterFragment, StepEffect } from "@mvfm/core";
import { injectLambdaParam } from "@mvfm/core";
import { z } from "zod";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Convert an ErrorConfig (string or ASTNode) to a Zod-compatible error function.
 * String errors become a function that returns the string for all issues.
 * ASTNode errors would need interpreter context to evaluate — stored as descriptive string.
 */
function toZodError(error: ErrorConfig | undefined): ((iss: unknown) => string) | undefined {
  if (error === undefined) return undefined;
  if (typeof error === "string") return () => error;
  // ASTNode error config — would need interpreter context to evaluate.
  return () => `[dynamic error: ${JSON.stringify(error)}]`;
}

/**
 * Build check-level error option for Zod check methods.
 * Returns `{ error: fn }` if error is present, otherwise empty object.
 */
function checkErrorOpt(check: CheckDescriptor): { error?: (iss: unknown) => string } {
  const fn = toZodError(check.error as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

/**
 * Apply check descriptors to a Zod string schema.
 * Each check kind maps to the corresponding Zod method.
 * Validations produce z.ZodString; transforms produce z.ZodPipe.
 */
function applyStringChecks(schema: z.ZodString, checks: CheckDescriptor[]): z.ZodType {
  let s: z.ZodType = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      // Length checks
      case "min_length":
        s = (s as z.ZodString).min(check.value as number, errOpt);
        break;
      case "max_length":
        s = (s as z.ZodString).max(check.value as number, errOpt);
        break;
      case "length":
        s = (s as z.ZodString).length(check.value as number, errOpt);
        break;
      // Pattern
      case "regex":
        s = (s as z.ZodString).regex(
          new RegExp(check.pattern as string, (check.flags as string) ?? ""),
          errOpt,
        );
        break;
      // Substring checks
      case "starts_with":
        s = (s as z.ZodString).startsWith(check.value as string, errOpt);
        break;
      case "ends_with":
        s = (s as z.ZodString).endsWith(check.value as string, errOpt);
        break;
      case "includes":
        s = (s as z.ZodString).includes(check.value as string, errOpt);
        break;
      // Case checks
      case "uppercase":
        s = (s as z.ZodString).regex(/^[^a-z]*$/, errOpt);
        break;
      case "lowercase":
        s = (s as z.ZodString).regex(/^[^A-Z]*$/, errOpt);
        break;
      // Transforms
      case "trim":
        s = (s as z.ZodString).trim();
        break;
      case "to_lower_case":
        s = (s as z.ZodString).toLowerCase();
        break;
      case "to_upper_case":
        s = (s as z.ZodString).toUpperCase();
        break;
      case "normalize":
        s = (s as z.ZodString).normalize(check.form as string);
        break;
      default:
        throw new Error(`Zod interpreter: unknown string check "${check.kind}"`);
    }
  }
  return s;
}

/**
 * Apply check descriptors to a Zod number schema.
 * Each check kind maps to the corresponding Zod method.
 */
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

/**
 * Build variant-specific number checks from the variant field.
 * Returns check descriptors that constrain the number to the variant range.
 */
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
      // JS can't represent full int64, use safe integer range
      return [{ kind: "int" }, { kind: "safe" }];
    case "uint32":
      return [{ kind: "int" }, { kind: "gte", value: 0 }, { kind: "lte", value: 4294967295 }];
    case "uint64":
      // JS can't represent full uint64, use safe integer range with gte(0)
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

/**
 * Build a Zod schema from a schema AST node (generator version).
 * Yields recurse effects for value-carrying wrappers (default, prefault, catch).
 * Simple schema types and non-value wrappers are handled synchronously.
 */
function* buildSchemaGen(node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
  switch (node.kind) {
    case "zod/string": {
      const checks = (node.checks as CheckDescriptor[]) ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const base = errorFn ? z.string({ error: errorFn }) : z.string();
      return applyStringChecks(base, checks) as z.ZodType;
    }

    case "zod/number": {
      const variant = node.variant as string | undefined;
      const explicitChecks = (node.checks as CheckDescriptor[]) ?? [];
      const vChecks = variantChecks(variant);
      const allChecks = [...vChecks, ...explicitChecks];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const base = errorFn ? z.number({ error: errorFn }) : z.number();
      return applyNumberChecks(base, allChecks);
    }

    case "zod/nan": {
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      return errorFn ? z.nan({ error: errorFn }) : z.nan();
    }

    // Simple wrappers (no value field)
    case "zod/optional":
      return (yield* buildSchemaGen(node.inner as ASTNode)).optional();
    case "zod/nullable":
      return (yield* buildSchemaGen(node.inner as ASTNode)).nullable();
    case "zod/nullish":
      return (yield* buildSchemaGen(node.inner as ASTNode)).nullish();
    case "zod/nonoptional":
      return (yield* buildSchemaGen(node.inner as ASTNode) as any).nonoptional();
    case "zod/readonly":
      return (yield* buildSchemaGen(node.inner as ASTNode)).readonly();
    case "zod/branded":
      return (yield* buildSchemaGen(node.inner as ASTNode)).brand(node.brand as string);

    // Value-carrying wrappers — evaluate the value AST node via recurse
    case "zod/default": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return inner.default(value);
    }
    case "zod/prefault": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return (inner as any).prefault(value);
    }
    case "zod/catch": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return inner.catch(value);
    }

    // Additional schema types will be added by colocated interpreter issues
    default:
      throw new Error(`Zod interpreter: unknown schema kind "${node.kind}"`);
  }
}

/**
 * Build parse-level error option from the parseError field on validation nodes.
 * In Zod v4, parse-level errors must be functions.
 */
function parseErrorOpt(node: ASTNode): { error?: (iss: unknown) => string } {
  const fn = toZodError(node.parseError as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

/**
 * Extract refinements from a schema AST node.
 * Refinements live on the base schema node, not on wrappers.
 */
function extractRefinements(schemaNode: ASTNode): RefinementDescriptor[] {
  return (schemaNode.refinements as RefinementDescriptor[] | undefined) ?? [];
}

/**
 * Apply refinement descriptors to a validated value via the generator pipeline.
 * Each refinement's lambda body is cloned, injected with the current value,
 * and evaluated through the interpreter via recurse effects.
 *
 * - `refine` / `check`: predicate must return truthy, else throw
 * - `overwrite`: result replaces the current value
 * - `super_refine`: evaluated for side effects (e.g. adding issues)
 */
function* applyRefinements(
  value: unknown,
  refinements: RefinementDescriptor[],
): Generator<StepEffect, unknown, unknown> {
  let current = value;
  for (const ref of refinements) {
    const lambda = ref.fn as unknown as { param: { name: string }; body: ASTNode };
    const bodyClone = structuredClone(lambda.body);
    injectLambdaParam(bodyClone, lambda.param.name, current);
    const result = yield { type: "recurse", child: bodyClone };

    switch (ref.kind) {
      case "refine":
      case "check":
        if (!result) {
          throw new Error(typeof ref.error === "string" ? ref.error : "Refinement failed");
        }
        break;
      case "overwrite":
        current = result;
        break;
      case "super_refine":
        // Evaluated for side effects; return value ignored
        break;
    }
  }
  return current;
}

/**
 * Interpreter fragment for `zod/` node kinds.
 *
 * Handles parsing operation nodes by recursing into schema + input,
 * reconstructing the Zod schema from AST, and executing validation.
 *
 * Schema nodes (zod/string, etc.) are handled by `buildSchemaGen` which
 * constructs actual Zod schemas from AST descriptors, yielding recurse
 * effects for value-carrying wrappers.
 */
export const zodInterpreter: InterpreterFragment = {
  pluginName: "zod",
  canHandle: (node) => node.kind.startsWith("zod/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "zod/parse": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        let value = schema.parse(input, parseErrorOpt(node));
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(result.data, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return result;
      }
      case "zod/parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        let value = schema.parse(input, parseErrorOpt(node));
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(result.data, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return result;
      }
      default:
        throw new Error(`Zod interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
