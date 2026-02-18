/**
 * Spike: Extract all Slack Web API method signatures from @slack/web-api's methods.ts
 *
 * Parses the Methods class, walks nested object literals, and extracts:
 * - API method string (e.g. "chat.postMessage")
 * - Arguments type name (e.g. "ChatPostMessageArguments")
 * - Response type name (e.g. "ChatPostMessageResponse")
 * - Whether args are optional (bindApiCallWithOptionalArgument)
 * - DSL nesting path (e.g. ["chat", "postMessage"])
 *
 * Usage: npx tsx scripts/spike-slack-codegen.ts [path-to-methods.ts]
 */

import * as ts from "typescript";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

interface MethodEntry {
  /** Slack API method string, e.g. "chat.postMessage" */
  apiMethod: string;
  /** TypeScript Arguments type name, e.g. "ChatPostMessageArguments" */
  argsType: string;
  /** TypeScript Response type name, e.g. "ChatPostMessageResponse" */
  responseType: string;
  /** Whether the method uses bindApiCallWithOptionalArgument */
  optional: boolean;
  /** Nesting path in the DSL, e.g. ["chat", "postMessage"] */
  path: string[];
  /** What the node kind would be in mvfm, e.g. "slack/chat_postMessage" */
  nodeKind: string;
  /** Binding function used */
  bindFn: string;
}

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

  const BIND_FNS = new Set(["bindApiCall", "bindApiCallWithOptionalArgument", "bindFilesUploadV2"]);

  function pathToNodeKind(path: string[]): string {
    if (path.length === 0) return "slack/unknown";
    // Top-level group becomes prefix, rest joined with underscore
    // e.g. ["chat", "postMessage"] -> "slack/chat_postMessage"
    // e.g. ["admin", "apps", "approve"] -> "slack/admin_apps_approve"
    return `slack/${path.join("_")}`;
  }

  function walkObjectLiteral(obj: ts.ObjectLiteralExpression, path: string[]): void {
    for (const prop of obj.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = prop.name?.getText(sourceFile);
      if (!name) continue;

      const currentPath = [...path, name];
      const init = prop.initializer;

      // Case 1: nested object literal → recurse
      if (ts.isObjectLiteralExpression(init)) {
        walkObjectLiteral(init, currentPath);
        continue;
      }

      // Case 2: bindApiCall(...) or bindApiCallWithOptionalArgument(...)
      if (ts.isCallExpression(init)) {
        const fnName = getBindFnName(init.expression);
        if (fnName && BIND_FNS.has(fnName)) {
          const argsType = getTypeArgText(init, 0);
          const responseType = getTypeArgText(init, 1);

          // Extract the API method string from the second argument
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
            bindFn: fnName,
          });
        }
      }
    }
  }

  // Find the Methods class
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

// --- Main ---

const sdkMethodsPath = process.argv[2] || "/tmp/slack-sdk/packages/web-api/src/methods.ts";
const resolvedPath = resolve(sdkMethodsPath);

console.log(`Parsing: ${resolvedPath}\n`);
const methods = extractMethods(resolvedPath);

// Summary stats
const groups = new Map<string, number>();
for (const m of methods) {
  const group = m.path[0];
  groups.set(group, (groups.get(group) ?? 0) + 1);
}

console.log(`Total methods extracted: ${methods.length}`);
console.log(`\nBy top-level group:`);
for (const [group, count] of [...groups.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${group}: ${count}`);
}

console.log(`\nOptional args: ${methods.filter((m) => m.optional).length}`);
console.log(`Required args: ${methods.filter((m) => !m.optional).length}`);
console.log(`Special (filesUploadV2): ${methods.filter((m) => m.bindFn === "bindFilesUploadV2").length}`);

// Show a sample
console.log(`\nSample entries (first 5):`);
for (const m of methods.slice(0, 5)) {
  console.log(`  ${m.apiMethod} → ${m.nodeKind}`);
  console.log(`    args: ${m.argsType}, response: ${m.responseType}, optional: ${m.optional}`);
}

// Compare with current plugin
const currentKinds = [
  "slack/chat_postMessage", "slack/chat_update", "slack/chat_delete",
  "slack/chat_postEphemeral", "slack/chat_scheduleMessage", "slack/chat_getPermalink",
  "slack/conversations_list", "slack/conversations_info", "slack/conversations_create",
  "slack/conversations_invite", "slack/conversations_history", "slack/conversations_members",
  "slack/conversations_open", "slack/conversations_replies",
  "slack/users_info", "slack/users_list", "slack/users_lookupByEmail", "slack/users_conversations",
  "slack/reactions_add", "slack/reactions_get", "slack/reactions_list", "slack/reactions_remove",
  "slack/files_list", "slack/files_info", "slack/files_delete",
];

const extractedKinds = new Set(methods.map((m) => m.nodeKind));
const missing = methods.filter((m) => !currentKinds.includes(m.nodeKind));
const inCurrentButNotExtracted = currentKinds.filter((k) => !extractedKinds.has(k));

console.log(`\nCurrent plugin has ${currentKinds.length} methods`);
console.log(`SDK has ${methods.length} methods`);
console.log(`Missing from current plugin: ${missing.length}`);
if (inCurrentButNotExtracted.length > 0) {
  console.log(`In current plugin but not in SDK (stale?): ${inCurrentButNotExtracted.length}`);
  for (const k of inCurrentButNotExtracted) console.log(`  ${k}`);
}

// Write full manifest
const outputPath = resolve(import.meta.dirname ?? ".", "slack-api-manifest.json");
writeFileSync(outputPath, JSON.stringify(methods, null, 2));
console.log(`\nFull manifest written to: ${outputPath}`);
