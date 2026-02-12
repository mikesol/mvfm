import type { ASTNode, Expr, PluginContext, PluginDefinition, TraitImpl } from "../core";

export interface EqMethods {
  eq(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  eq(a: Expr<string> | string, b: Expr<string> | string): Expr<boolean>;
  eq(a: Expr<boolean> | boolean, b: Expr<boolean> | boolean): Expr<boolean>;
}

/**
 * Infer the runtime type of an AST node by inspecting its structure.
 *
 * 1. Literals — typeof value
 * 2. Plugin nodes — match node kind prefix against trait declarations
 * 3. Input fields — walk the input schema
 */
export function inferType(
  node: ASTNode,
  impls: TraitImpl[],
  schema?: Record<string, unknown>,
): string | null {
  // 1. Literals
  if (node.kind === "core/literal") {
    if (node.value === null) return "null";
    return typeof node.value; // "string", "number", "boolean"
  }

  // 2. Plugin nodes — match against registered trait types
  for (const impl of impls) {
    const pluginPrefix = impl.nodeKind.split("/")[0];
    if (node.kind.startsWith(`${pluginPrefix}/`)) return impl.type;
  }

  // 3. Input fields — walk schema
  if (node.kind === "core/prop_access") {
    return resolveSchemaType(node, schema);
  }

  return null;
}

/**
 * Walk a core/prop_access chain back to core/input and resolve
 * the type from the input schema.
 */
export function resolveSchemaType(node: ASTNode, schema?: Record<string, unknown>): string | null {
  if (!schema) return null;

  // Build access path: $.input.address.city → ["address", "city"]
  const path: string[] = [];
  let current = node;
  while (current.kind === "core/prop_access") {
    path.unshift(current.property as string);
    current = current.object as ASTNode;
  }
  if (current.kind !== "core/input") return null;

  // Walk schema along the path
  let schemaNode: unknown = schema;
  for (const key of path) {
    if (typeof schemaNode === "object" && schemaNode !== null && key in schemaNode) {
      schemaNode = (schemaNode as Record<string, unknown>)[key];
    } else {
      return null;
    }
  }

  // Resolve terminal value to type string
  if (typeof schemaNode === "string") return schemaNode;
  if (typeof schemaNode === "object" && schemaNode !== null && "__tag" in schemaNode) {
    return (schemaNode as { __tag: string }).__tag;
  }
  return null;
}

export const eq: PluginDefinition<EqMethods> = {
  name: "eq",
  nodeKinds: [], // delegates to num/eq, str/eq, etc.
  build(ctx: PluginContext): EqMethods {
    const impls = ctx.plugins.filter((p) => p.traits?.eq).map((p) => p.traits!.eq!);

    return {
      eq(a: any, b: any): Expr<boolean> {
        const aNode = ctx.lift(a).__node;
        const bNode = ctx.lift(b).__node;
        const type =
          inferType(aNode, impls, ctx.inputSchema) ?? inferType(bNode, impls, ctx.inputSchema);
        if (!type) {
          throw new Error("Cannot infer type for eq — both arguments are untyped");
        }
        const impl = impls.find((i) => i.type === type);
        if (!impl) {
          throw new Error(`No eq implementation for type: ${type}`);
        }
        return ctx.expr<boolean>({
          kind: impl.nodeKind,
          left: aNode,
          right: bNode,
        });
      },
    } as EqMethods;
  },
};
