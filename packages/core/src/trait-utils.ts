import type { TraitImpl } from "./core";

/**
 * Infers the runtime type of an AST node by checking it against registered
 * trait implementations.
 *
 * @param node - The AST node to type-check.
 * @param impls - Trait implementations to match against.
 * @param schema - Optional input schema for resolving property access types.
 * @returns The type string (e.g. `"number"`, `"string"`) or `null` if unresolvable.
 */
export function inferType(
  node: any,
  impls: TraitImpl[],
  schema?: Record<string, unknown>,
): string | null {
  if (node.kind === "core/literal") {
    if (node.value === null) return "null";
    return typeof node.value;
  }
  for (const impl of impls) {
    const firstNodeKind = Object.values(impl.nodeKinds)[0];
    if (!firstNodeKind) continue;
    const pluginPrefix = firstNodeKind.split("/")[0];
    if (node.kind.startsWith(`${pluginPrefix}/`)) return impl.type;
  }
  if (node.kind === "core/prop_access") {
    return resolveSchemaType(node, schema);
  }
  return null;
}

/**
 * Resolves the schema type of a property access chain rooted at `core/input`.
 *
 * Walks backwards through nested `core/prop_access` nodes to reconstruct the
 * access path, then looks it up in the schema.
 *
 * @param node - A `core/prop_access` AST node.
 * @param schema - The program's input schema.
 * @returns The schema type string or `null` if the path doesn't resolve.
 */
export function resolveSchemaType(node: any, schema?: Record<string, unknown>): string | null {
  if (!schema) return null;
  const path: string[] = [];
  let current = node;
  while (current.kind === "core/prop_access") {
    path.unshift(current.property as string);
    current = current.object;
  }
  if (current.kind !== "core/input") return null;
  let schemaNode: unknown = schema;
  for (const key of path) {
    if (typeof schemaNode === "object" && schemaNode !== null && key in schemaNode) {
      schemaNode = (schemaNode as Record<string, unknown>)[key];
    } else {
      return null;
    }
  }
  if (typeof schemaNode === "string") return schemaNode;
  if (typeof schemaNode === "object" && schemaNode !== null && "__tag" in schemaNode) {
    return (schemaNode as { __tag: string }).__tag;
  }
  return null;
}
