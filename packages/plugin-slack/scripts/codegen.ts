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

function slugToPascal(slug: string): string {
  return slug
    .split(/[-.]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

function slugToConstSuffix(slug: string): string {
  return slug.replace(/[-.]/, "_").toUpperCase();
}

function camelCase(slug: string): string {
  const parts = slug.split(/[-.]/) ;
  return parts[0] + parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
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
  const respTypes = new Set<string>();
  for (const m of group.methods) {
    respTypes.add(m.responseType);
  }

  lines.push(`import type { CExpr } from "@mvfm/core";`);
  if (respTypes.size > 0) {
    lines.push(`import type {`);
    for (const t of [...respTypes].sort()) {
      lines.push(`  ${t},`);
    }
    lines.push(`} from "@slack/web-api";`);
  }
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
      const optSig = m.optional ? "<A = void>(params?: A)" : "<A>(params: A)";
      lines.push(
        `${indent}${methodName}${optSig}: CExpr<${m.responseType}, "${m.nodeKind}", [A]>;`,
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
  lines.push("export interface SlackMethods {");
  lines.push("  slack: {");

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
      const top = parts[0];
      if (!groupTree.has(top)) {
        groupTree.set(top, { children: new Map() });
      }
      const topNode = groupTree.get(top)!;
      const sub = parts.slice(1).join(".");
      topNode.children.set(sub, { leafType: `SlackMethods${pascal}`, children: new Map() });
    }
  }

  for (const [topGroup, topNode] of [...groupTree.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (topNode.children.size === 0 && topNode.leafType) {
      lines.push(`    ${topGroup}: ${topNode.leafType};`);
    } else {
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
  lines.push(`import type { CExpr } from "@mvfm/core";`);
  lines.push(`import { makeCExpr } from "@mvfm/core";`);

  const pascal = slugToPascal(group.fileSlug);
  lines.push(`import type { SlackMethods${pascal} } from "./types-${group.fileSlug}";`);
  lines.push("");

  // mk cast helper — restores CExpr generic type info
  lines.push("const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(");
  lines.push("  kind: Kind,");
  lines.push("  args: readonly unknown[],");
  lines.push(") => CExpr<O, Kind, Args>;");
  lines.push("");

  lines.push(
    `export function buildSlack${pascal}(): SlackMethods${pascal} {`,
  );
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
      const paramSig = m.optional ? "params?" : "params";
      lines.push(`${indent}${methodName}(${paramSig}) {`);
      lines.push(`${indent}  if (params != null) return mk("${m.nodeKind}", [params]);`);
      lines.push(`${indent}  return mk("${m.nodeKind}", []);`);
      lines.push(`${indent}},`);
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
  lines.push(`import type { SlackMethods } from "./types";`);
  lines.push("");

  for (const g of groups) {
    const pascal = slugToPascal(g.fileSlug);
    lines.push(`import { buildSlack${pascal} } from "./build-methods-${g.fileSlug}";`);
  }
  lines.push("");

  lines.push(
    "export function buildSlackMethods(): SlackMethods {",
  );
  lines.push("  return {");
  lines.push("    slack: {");

  interface GroupTree {
    buildFn?: string;
    children: Map<string, { buildFn: string }>;
  }
  const groupTree = new Map<string, GroupTree>();

  for (const g of groups) {
    const parts = g.group.split(".");
    const pascal = slugToPascal(g.fileSlug);
    const fnName = `buildSlack${pascal}()`;

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

  lines.push(`import type { Interpreter, RuntimeEntry } from "@mvfm/core";`);
  lines.push(`import { resolveStructured } from "@mvfm/core";`);
  lines.push("");

  lines.push(`export const NODE_TO_METHOD_${constSuffix}: Record<string, string> = {`);
  for (const m of group.methods) {
    lines.push(`  "${m.nodeKind}": "${m.apiMethod}",`);
  }
  lines.push("};");
  lines.push("");

  lines.push("interface SlackClientLike {");
  lines.push("  apiCall(method: string, params?: Record<string, unknown>): Promise<unknown>;");
  lines.push("}");
  lines.push("");
  lines.push(
    `export function createSlack${pascal}Interpreter(client: SlackClientLike): Interpreter {`,
  );
  lines.push("  const handlers: Interpreter = {};");
  lines.push("");
  lines.push(`  for (const [kind, method] of Object.entries(NODE_TO_METHOD_${constSuffix})) {`);
  lines.push("    handlers[kind] = async function* (entry: RuntimeEntry) {");
  lines.push("      const params = entry.children.length > 0");
  lines.push("        ? (yield* resolveStructured(entry.children[0])) as Record<string, unknown>");
  lines.push("        : undefined;");
  lines.push("      return await client.apiCall(method, params);");
  lines.push("    };");
  lines.push("  }");
  lines.push("");
  lines.push("  return handlers;");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

function generateInterpreterIndex(groups: GroupData[]): string {
  const lines: string[] = [HEADER];
  lines.push(`import type { Interpreter } from "@mvfm/core";`);
  lines.push("");

  for (const g of groups) {
    const pascal = slugToPascal(g.fileSlug);
    const constSuffix = slugToConstSuffix(g.fileSlug);
    lines.push(
      `import { createSlack${pascal}Interpreter, NODE_TO_METHOD_${constSuffix} } from "./interpreter-${g.fileSlug}";`,
    );
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

  // Create per-group sub-interpreters and merge with spread
  lines.push("  return {");

  for (const g of groups) {
    const pascal = slugToPascal(g.fileSlug);
    lines.push(`    ...createSlack${pascal}Interpreter(client),`);
  }
  lines.push("  };");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
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
