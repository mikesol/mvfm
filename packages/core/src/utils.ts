// ============================================================
// MVFM — Utility functions
// ============================================================

let _nodeIdCounter = 0;

/** Generate a unique node ID for reachability tracking. */
export function nextNodeId(): number {
  return ++_nodeIdCounter;
}

/**
 * Simple hash function (not cryptographic).
 * Strips `__id` and `recId` fields before hashing so
 * identical programs produce identical hashes.
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Internal/structural nodes that don't represent user-visible
 * effects and shouldn't trigger orphan warnings.
 */
export function isInternalNode(node: any): boolean {
  return (
    node.kind === "core/input" ||
    node.kind === "core/literal" ||
    node.kind === "core/lambda_param" ||
    node.kind.startsWith("st/")
  );
}

/**
 * Walk an AST subtree and inject a runtime value into matching
 * `core/lambda_param` nodes.
 *
 * This is the standard mechanism for evaluating lambda expressions
 * at runtime: clone the lambda body, inject the argument value into
 * the param nodes, then recurse through the interpreter to evaluate
 * the body.
 *
 * @param node - AST subtree to walk (typically a cloned lambda body)
 * @param name - The param name to match against `core/lambda_param` nodes
 * @param value - The runtime value to inject
 */
export function injectLambdaParam(node: any, name: string, value: unknown): void {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) injectLambdaParam(item, name, value);
    return;
  }
  if (node.kind === "core/lambda_param" && node.name === name) {
    node.__value = value;
  }
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      injectLambdaParam(v, name, value);
    }
  }
}
