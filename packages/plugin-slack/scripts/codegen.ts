/**
 * Codegen: Parse @slack/web-api's methods.ts and generate typed plugin files.
 *
 * Reads the vendored SDK source, extracts all bindApiCall / bindApiCallWithOptionalArgument
 * entries (skipping bindFilesUploadV2), and writes generated files under src/7.14.0/generated/.
 *
 * Usage: npx tsx packages/plugin-slack/scripts/codegen.ts
 */

import * as ts from "typescript";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { resolve, join } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MethodEntry {
  apiMethod: string;
  argsType: string;
  responseType: string;
  optional: boolean;
  path: string[];
  nodeKind: string;
}

interface GroupData {
  group: string;
  /** Filesystem-safe identifier for the group (e.g. "admin-apps") */
  fileSlug: string;
  methods: MethodEntry[];
}

// ---------------------------------------------------------------------------
// Extraction (adapted from spike script)
// ---------------------------------------------------------------------------

function extractMethods(filePath: string): MethodEntry[] {
  const source = readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const results: MethodEntry[] = [];

  function getTypeArgText(node: ts.CallExpression, index: number): string {
    if (!node.typeArguments || node.typeArguments.length <= index) return "unknown";
    return node.typeArguments[index].getText(sourceFile);
  }

  function getBindFnName(expr: ts.Expression): string | null {
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
    return null;
  }

  const ALLOWED_FNS = new Set(["bindApiCall", "bindApiCallWithOptionalArgument"]);

  function pathToNodeKind(path: string[]): string {
    return `slack/${path.join("_")}`;
  }

  function walkObjectLiteral(obj: ts.ObjectLiteralExpression, path: string[]): void {
    for (const prop of obj.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = prop.name?.getText(sourceFile);
      if (!name) continue;
      const currentPath = [...path, name];
      const init = prop.initializer;

      if (ts.isObjectLiteralExpression(init)) {
        walkObjectLiteral(init, currentPath);
        continue;
      }

      if (ts.isCallExpression(init)) {
        const fnName = getBindFnName(init.expression);
        if (fnName && ALLOWED_FNS.has(fnName)) {
          const argsType = getTypeArgText(init, 0);
          const responseType = getTypeArgText(init, 1);
          let apiMethod = "";
          if (init.arguments.length >= 2 && ts.isStringLiteral(init.arguments[1])) {
            apiMethod = init.arguments[1].text;
          }
          results.push({
            apiMethod,
            argsType,
            responseType,
            optional: fnName === "bindApiCallWithOptionalArgument",
            path: currentPath,
            nodeKind: pathToNodeKind(currentPath),
          });
        }
      }
    }
  }

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isClassDeclaration(node)) return;
    if (node.name?.text !== "Methods") return;
    for (const member of node.members) {
      if (!ts.isPropertyDeclaration(member)) continue;
      const propName = member.name?.getText(sourceFile);
      if (!propName) continue;
      const init = member.initializer;
      if (!init || !ts.isObjectLiteralExpression(init)) continue;
      walkObjectLiteral(init, [propName]);
    }
  });

  return results;
}

// ---------------------------------------------------------------------------
// Grouping — split large groups into sub-groups
// ---------------------------------------------------------------------------

/** Max methods per group file to stay under 300 lines */
const MAX_METHODS_PER_GROUP = 40;

function groupByTopLevel(methods: MethodEntry[]): GroupData[] {
  const map = new Map<string, MethodEntry[]>();
  for (const m of methods) {
    const group = m.path[0];
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(m);
  }

  const result: GroupData[] = [];
  for (const [group, groupMethods] of [...map.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (groupMethods.length <= MAX_METHODS_PER_GROUP) {
      result.push({ group, fileSlug: group, methods: groupMethods });
    } else {
      // Sub-split by second path element
      const subMap = new Map<string, MethodEntry[]>();
      for (const m of groupMethods) {
        const subGroup = m.path.length >= 2 ? m.path[1] : "_root";
        if (!subMap.has(subGroup)) subMap.set(subGroup, []);
        subMap.get(subGroup)!.push(m);
      }
      for (const [sub, subMethods] of [...subMap.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const slug = sub === "_root" ? group : `${group}-${sub}`;
        result.push({
          group: sub === "_root" ? group : `${group}.${sub}`,
          fileSlug: slug,
          methods: subMethods,
        });
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEADER = "// AUTO-GENERATED by scripts/codegen.ts — do not edit\n";

function kindToInterfaceName(kind: string): string {
  const parts = kind.replace("slack/", "").split("_");
  const pascal = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return `Slack${pascal}Node`;
}

function slugToPascal(slug: string): string {
  return slug
    .split(/[-.]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

function slugToConstSuffix(slug: string): string {
  return slug.replace(/[-.]/, "_").toUpperCase();
}

function writeFile(outDir: string, filename: string, content: string): void {
  const path = join(outDir, filename);
  writeFileSync(path, content);
  const lines = content.split("\n").length;
  const status = lines > 300 ? `OVER LIMIT (${lines})` : `ok (${lines})`;
  console.log(`  ${filename}: ${status}`);
}

// ---------------------------------------------------------------------------
// Tree builder for nested method structures
// ---------------------------------------------------------------------------

interface TreeNode {
  methods: MethodEntry[];
  children: Map<string, TreeNode>;
}

function makeTree(): TreeNode {
  return { methods: [], children: new Map() };
}

function buildTree(methods: MethodEntry[], pathOffset: number): TreeNode {
  const root = makeTree();
  for (const m of methods) {
    const subPath = m.path.slice(pathOffset);
    let node = root;
    for (let i = 0; i < subPath.length - 1; i++) {
      if (!node.children.has(subPath[i])) {
        node.children.set(subPath[i], makeTree());
      }
      node = node.children.get(subPath[i])!;
    }
    node.methods.push(m);
  }
  return root;
}

/**
 * Determine the right path offset for tree building.
 * For a group like "admin.apps", methods have paths like ["admin", "apps", "approve"],
 * so offset=2 to skip both "admin" and "apps". For simple groups like "chat", offset=1.
 */
function getPathOffset(group: GroupData): number {
  return group.group.split(".").length;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

function generateNodeKindsGroup(group: GroupData): string {
  const constName = `SLACK_NODE_KINDS_${slugToConstSuffix(group.fileSlug)}`;
  const lines: string[] = [HEADER];
  lines.push(`export const ${constName} = [`);
  for (const m of group.methods) {
    lines.push(`  "${m.nodeKind}",`);
  }
  lines.push("] as const;");
  lines.push("");
  return lines.join("\n");
}

function generateNodeKindsIndex(groups: GroupData[]): string {
  const lines: string[] = [HEADER];
  for (const g of groups) {
    const constName = `SLACK_NODE_KINDS_${slugToConstSuffix(g.fileSlug)}`;
    lines.push(`import { ${constName} } from "./node-kinds-${g.fileSlug}";`);
  }
  lines.push("");
  lines.push("export const SLACK_NODE_KINDS = [");
  for (const g of groups) {
    lines.push(`  ...SLACK_NODE_KINDS_${slugToConstSuffix(g.fileSlug)},`);
  }
  lines.push("] as const;");
  lines.push("");
  return lines.join("\n");
}

function generateTypesGroup(group: GroupData): string {
  const lines: string[] = [HEADER];
  const argTypes = new Set<string>();
  const respTypes = new Set<string>();
  for (const m of group.methods) {
    argTypes.add(m.argsType);
    respTypes.add(m.responseType);
  }

  lines.push(`import type { Expr } from "@mvfm/core";`);
  lines.push(`import type {`);
  for (const t of [...argTypes, ...respTypes].sort()) {
    lines.push(`  ${t},`);
  }
  lines.push(`} from "@slack/web-api";`);
  lines.push(`import type { SlackParams } from "./types";`);
  lines.push("");

  const pascal = slugToPascal(group.fileSlug);
  lines.push(`export interface SlackMethods${pascal} {`);

  const offset = getPathOffset(group);
  const root = buildTree(group.methods, offset);

  function renderTree(node: TreeNode, indent: string): void {
    for (const [childName, childNode] of [...node.children.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(`${indent}${childName}: {`);
      renderTree(childNode, indent + "  ");
      lines.push(`${indent}};`);
    }
    for (const m of node.methods) {
      const methodName = m.path[m.path.length - 1];
      const optMark = m.optional ? "?" : "";
      lines.push(
        `${indent}${methodName}(params${optMark}: SlackParams<${m.argsType}>): Expr<${m.responseType}>;`,
      );
    }
  }

  renderTree(root, "  ");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function generateTypesIndex(groups: GroupData[]): string {
  const lines: string[] = [HEADER];
  lines.push(`import type { Expr } from "@mvfm/core";`);
  lines.push("");
  lines.push("type Primitive = string | number | boolean | null | undefined;");
  lines.push("");
  lines.push("export type Exprify<T> = T extends Primitive");
  lines.push("  ? T | Expr<T>");
  lines.push("  : T extends Array<infer U>");
  lines.push("    ? Array<Exprify<U>> | Expr<T>");
  lines.push("    : T extends object");
  lines.push('      ? { [K in keyof T]: Exprify<T[K]> } | Expr<T>');
  lines.push("      : T | Expr<T>;");
  lines.push("");
  lines.push('export type SlackParams<T> = Exprify<Omit<T, "token">>;');
  lines.push("");

  for (const g of groups) {
    const pascal = slugToPascal(g.fileSlug);
    lines.push(`import type { SlackMethods${pascal} } from "./types-${g.fileSlug}";`);
  }
  lines.push("");

  for (const g of groups) {
    const pascal = slugToPascal(g.fileSlug);
    lines.push(`export type { SlackMethods${pascal} } from "./types-${g.fileSlug}";`);
  }
  lines.push("");

  lines.push("export interface SlackConfig {");
  lines.push("  token: string;");
  lines.push("}");
  lines.push("");

  // Build the SlackMethods interface with proper nesting
  // Groups like "admin.apps" need to nest under admin.apps
  lines.push("export interface SlackMethods {");
  lines.push("  slack: {");

  // Build a tree of top-level -> sub-level groups
  interface GroupTree {
    leafType?: string;
    children: Map<string, GroupTree>;
  }
  const groupTree = new Map<string, GroupTree>();

  for (const g of groups) {
    const parts = g.group.split(".");
    const pascal = slugToPascal(g.fileSlug);

    if (parts.length === 1) {
      if (!groupTree.has(parts[0])) {
        groupTree.set(parts[0], { children: new Map() });
      }
      groupTree.get(parts[0])!.leafType = `SlackMethods${pascal}`;
    } else {
      // e.g. "admin.apps" -> top="admin", sub="apps"
      const top = parts[0];
      if (!groupTree.has(top)) {
        groupTree.set(top, { children: new Map() });
      }
      const topNode = groupTree.get(top)!;
      // For now we only have 2 levels of sub-groups
      const sub = parts.slice(1).join(".");
      topNode.children.set(sub, { leafType: `SlackMethods${pascal}`, children: new Map() });
    }
  }

  for (const [topGroup, topNode] of [...groupTree.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (topNode.children.size === 0 && topNode.leafType) {
      // Simple group
      lines.push(`    ${topGroup}: ${topNode.leafType};`);
    } else {
      // Group with sub-groups
      lines.push(`    ${topGroup}: ${topNode.leafType ? `${topNode.leafType} & ` : ""}{`);
      for (const [sub, subNode] of [...topNode.children.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        lines.push(`      ${sub}: ${subNode.leafType};`);
      }
      lines.push("    };");
    }
  }

  lines.push("  };");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function generateBuildMethodsGroup(group: GroupData): string {
  const lines: string[] = [HEADER];
  lines.push(`import type { PluginContext } from "@mvfm/core";`);
  lines.push(`import type { SlackConfig } from "./types";`);

  const pascal = slugToPascal(group.fileSlug);
  lines.push(`import type { SlackMethods${pascal} } from "./types-${group.fileSlug}";`);
  lines.push("");

  lines.push(
    `export function buildSlack${pascal}(ctx: PluginContext, config: SlackConfig): SlackMethods${pascal} {`,
  );
  lines.push("  const resolveParams = (params: unknown) => ctx.lift(params).__node;");
  lines.push("");
  lines.push("  return {");

  const offset = getPathOffset(group);
  const root = buildTree(group.methods, offset);

  function renderTree(node: TreeNode, indent: string): void {
    for (const [childName, childNode] of [...node.children.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(`${indent}${childName}: {`);
      renderTree(childNode, indent + "  ");
      lines.push(`${indent}},`);
    }
    for (const m of node.methods) {
      const methodName = m.path[m.path.length - 1];
      if (m.optional) {
        lines.push(`${indent}${methodName}(params?) {`);
        lines.push(
          `${indent}  return ctx.expr({ kind: "${m.nodeKind}", params: params != null ? resolveParams(params) : null, config });`,
        );
        lines.push(`${indent}},`);
      } else {
        lines.push(`${indent}${methodName}(params) {`);
        lines.push(
          `${indent}  return ctx.expr({ kind: "${m.nodeKind}", params: resolveParams(params), config });`,
        );
        lines.push(`${indent}},`);
      }
    }
  }

  renderTree(root, "    ");
  lines.push("  };");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function generateBuildMethodsIndex(groups: GroupData[]): string {
  const lines: string[] = [HEADER];
  lines.push(`import type { PluginContext } from "@mvfm/core";`);
  lines.push(`import type { SlackConfig, SlackMethods } from "./types";`);
  lines.push("");

  for (const g of groups) {
    const pascal = slugToPascal(g.fileSlug);
    lines.push(`import { buildSlack${pascal} } from "./build-methods-${g.fileSlug}";`);
  }
  lines.push("");

  lines.push(
    "export function buildSlackMethods(ctx: PluginContext, config: SlackConfig): SlackMethods {",
  );
  lines.push("  return {");
  lines.push("    slack: {");

  // Same tree structure as types index
  interface GroupTree {
    buildFn?: string;
    children: Map<string, { buildFn: string }>;
  }
  const groupTree = new Map<string, GroupTree>();

  for (const g of groups) {
    const parts = g.group.split(".");
    const pascal = slugToPascal(g.fileSlug);
    const fnName = `buildSlack${pascal}(ctx, config)`;

    if (parts.length === 1) {
      if (!groupTree.has(parts[0])) {
        groupTree.set(parts[0], { children: new Map() });
      }
      groupTree.get(parts[0])!.buildFn = fnName;
    } else {
      const top = parts[0];
      if (!groupTree.has(top)) {
        groupTree.set(top, { children: new Map() });
      }
      const sub = parts.slice(1).join(".");
      groupTree.get(top)!.children.set(sub, { buildFn: fnName });
    }
  }

  for (const [topGroup, topNode] of [...groupTree.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (topNode.children.size === 0 && topNode.buildFn) {
      lines.push(`      ${topGroup}: ${topNode.buildFn},`);
    } else {
      // Merge the base build fn with sub-group build fns
      const spreads: string[] = [];
      if (topNode.buildFn) {
        spreads.push(`...${topNode.buildFn}`);
      }
      lines.push(`      ${topGroup}: {`);
      if (topNode.buildFn) {
        lines.push(`        ...${topNode.buildFn},`);
      }
      for (const [sub, subNode] of [...topNode.children.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        lines.push(`        ${sub}: ${subNode.buildFn},`);
      }
      lines.push("      },");
    }
  }

  lines.push("    },");
  lines.push("  };");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function generateInterpreterGroup(group: GroupData): string {
  const lines: string[] = [HEADER];
  const constSuffix = slugToConstSuffix(group.fileSlug);
  const pascal = slugToPascal(group.fileSlug);

  lines.push(`import type { Interpreter, TypedNode } from "@mvfm/core";`);
  lines.push(`import { defineInterpreter, eval_ } from "@mvfm/core";`);
  lines.push(
    `import type { SLACK_NODE_KINDS_${constSuffix} } from "./node-kinds-${group.fileSlug}";`
  );
  lines.push("");

  lines.push(`type Slack${pascal}Kind = (typeof SLACK_NODE_KINDS_${constSuffix})[number];`);
  lines.push("");

  lines.push(
    `interface Slack${pascal}BaseNode<K extends Slack${pascal}Kind = Slack${pascal}Kind> extends TypedNode<unknown> {`,
  );
  lines.push("  kind: K;");
  lines.push("  params?: TypedNode<Record<string, unknown>> | null;");
  lines.push("  config: { token: string };");
  lines.push("}");
  lines.push("");

  for (const m of group.methods) {
    const ifaceName = kindToInterfaceName(m.nodeKind);
    lines.push(
      `export interface ${ifaceName} extends Slack${pascal}BaseNode<"${m.nodeKind}"> {}`,
    );
  }
  lines.push("");

  lines.push(`export const NODE_TO_METHOD_${constSuffix}: Record<string, string> = {`);
  for (const m of group.methods) {
    lines.push(`  "${m.nodeKind}": "${m.apiMethod}",`);
  }
  lines.push("};");
  lines.push("");

  lines.push('declare module "@mvfm/core" {');
  lines.push("  interface NodeTypeMap {");
  for (const m of group.methods) {
    const ifaceName = kindToInterfaceName(m.nodeKind);
    lines.push(`    "${m.nodeKind}": ${ifaceName};`);
  }
  lines.push("  }");
  lines.push("}");
  lines.push("");

  // Export a function that creates this group's sub-interpreter
  lines.push("interface SlackClientLike {");
  lines.push("  apiCall(method: string, params?: Record<string, unknown>): Promise<unknown>;");
  lines.push("}");
  lines.push("");
  lines.push(
    `export function createSlack${pascal}Interpreter(client: SlackClientLike): Interpreter {`,
  );
  lines.push(`  const handler = async function* (node: Slack${pascal}BaseNode) {`);
  lines.push(`    const method = NODE_TO_METHOD_${constSuffix}[node.kind];`);
  lines.push(
    `    if (!method) throw new Error(\`Slack interpreter: unknown node kind "\${node.kind}"\`);`,
  );
  lines.push(
    "    const params = node.params != null ? yield* eval_(node.params) : undefined;",
  );
  lines.push("    return await client.apiCall(method, params);");
  lines.push("  };");
  lines.push("");
  lines.push(`  return defineInterpreter<Slack${pascal}Kind>()({`);
  for (const m of group.methods) {
    const ifaceName = kindToInterfaceName(m.nodeKind);
    lines.push(
      `    "${m.nodeKind}": async function* (node: ${ifaceName}) { return yield* handler(node); },`,
    );
  }
  lines.push("  });");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

function generateInterpreterIndex(groups: GroupData[]): string {
  const lines: string[] = [HEADER];
  lines.push(`import type { Interpreter } from "@mvfm/core";`);
  lines.push(`import { mergeInterpreters } from "@mvfm/core";`);
  lines.push("");

  for (const g of groups) {
    const pascal = slugToPascal(g.fileSlug);
    const constSuffix = slugToConstSuffix(g.fileSlug);
    lines.push(
      `import { createSlack${pascal}Interpreter, NODE_TO_METHOD_${constSuffix} } from "./interpreter-${g.fileSlug}";`,
    );
  }
  lines.push("");

  // Re-export all group interpreter modules for node interfaces
  for (const g of groups) {
    lines.push(`export * from "./interpreter-${g.fileSlug}";`);
  }
  lines.push("");

  // Combined NODE_TO_METHOD
  lines.push("export const NODE_TO_METHOD: Record<string, string> = {");
  for (const g of groups) {
    lines.push(`  ...NODE_TO_METHOD_${slugToConstSuffix(g.fileSlug)},`);
  }
  lines.push("};");
  lines.push("");

  lines.push("export interface SlackClient {");
  lines.push(
    "  apiCall(method: string, params?: Record<string, unknown>): Promise<unknown>;",
  );
  lines.push("}");
  lines.push("");

  lines.push("export function createSlackInterpreter(client: SlackClient): Interpreter {");

  // Create per-group sub-interpreters
  for (const g of groups) {
    const pascal = slugToPascal(g.fileSlug);
    const varName = camelCase(g.fileSlug);
    lines.push(`  const ${varName} = createSlack${pascal}Interpreter(client);`);
  }
  lines.push("");

  // Merge all sub-interpreters using reduce-style chaining
  // To keep lines short, accumulate in a variable
  lines.push(`  let result: Interpreter = ${camelCase(groups[0].fileSlug)};`);
  for (let i = 1; i < groups.length; i++) {
    lines.push(`  result = mergeInterpreters(result, ${camelCase(groups[i].fileSlug)});`);
  }
  lines.push("  return result;");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function camelCase(slug: string): string {
  const parts = slug.split(/[-.]/) ;
  return parts[0] + parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const pluginRoot = resolve(import.meta.dirname ?? ".", "..");
const sdkPath = resolve(
  pluginRoot,
  "vendor/node-slack-sdk/packages/web-api/src/methods.ts",
);
const outDir = resolve(pluginRoot, "src/7.14.0/generated");

console.log(`Parsing: ${sdkPath}`);
const allMethods = extractMethods(sdkPath);
console.log(`Extracted ${allMethods.length} methods (excluding filesUploadV2)`);

const groups = groupByTopLevel(allMethods);
console.log(
  `Groups (${groups.length}): ${groups.map((g) => `${g.fileSlug}(${g.methods.length})`).join(", ")}`,
);

// Clean and create output dir
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true });
}
mkdirSync(outDir, { recursive: true });

console.log(`\nGenerating files in ${outDir}:`);

let hasOverLimit = false;

function writeAndCheck(dir: string, filename: string, content: string): void {
  const path = join(dir, filename);
  writeFileSync(path, content);
  const lines = content.split("\n").length;
  const status = lines > 300 ? `OVER LIMIT (${lines})` : `ok (${lines})`;
  if (lines > 300) hasOverLimit = true;
  console.log(`  ${filename}: ${status}`);
}

// 1. Node kinds
for (const g of groups) {
  writeAndCheck(outDir, `node-kinds-${g.fileSlug}.ts`, generateNodeKindsGroup(g));
}
writeAndCheck(outDir, "node-kinds.ts", generateNodeKindsIndex(groups));

// 2. Types
for (const g of groups) {
  writeAndCheck(outDir, `types-${g.fileSlug}.ts`, generateTypesGroup(g));
}
writeAndCheck(outDir, "types.ts", generateTypesIndex(groups));

// 3. Build methods
for (const g of groups) {
  writeAndCheck(outDir, `build-methods-${g.fileSlug}.ts`, generateBuildMethodsGroup(g));
}
writeAndCheck(outDir, "build-methods.ts", generateBuildMethodsIndex(groups));

// 4. Interpreter
for (const g of groups) {
  writeAndCheck(outDir, `interpreter-${g.fileSlug}.ts`, generateInterpreterGroup(g));
}
writeAndCheck(outDir, "interpreter.ts", generateInterpreterIndex(groups));

// 5. Index re-export
const indexLines: string[] = [HEADER];
indexLines.push(`export { SLACK_NODE_KINDS } from "./node-kinds";`);
indexLines.push(`export type { SlackConfig, SlackMethods } from "./types";`);
indexLines.push(`export { buildSlackMethods } from "./build-methods";`);
indexLines.push(`export { createSlackInterpreter } from "./interpreter";`);
indexLines.push(`export type { SlackClient } from "./interpreter";`);
indexLines.push(`export { NODE_TO_METHOD } from "./interpreter";`);
indexLines.push("");
writeAndCheck(outDir, "index.ts", indexLines.join("\n"));

if (hasOverLimit) {
  console.error("\nERROR: Some files exceed 300 lines!");
  process.exit(1);
}

console.log("\nDone! All files under 300 lines.");
