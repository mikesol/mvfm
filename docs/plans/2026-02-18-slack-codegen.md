# Slack Plugin Codegen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hand-written 25-method Slack plugin with a codegen pipeline that mechanically derives all ~271 methods (excluding `filesUploadV2`) from the `@slack/web-api` SDK source, then validate with 2-3 fixture-based integration tests.

**Architecture:** Add `node-slack-sdk` as a git submodule under `packages/plugin-slack/`. A codegen script parses the SDK's `methods.ts` via the TypeScript compiler API, extracts every `bindApiCall`/`bindApiCallWithOptionalArgument` call, and generates four source files: `node-kinds.ts`, `types.ts`, `build-methods.ts`, `interpreter.ts`. The generated files replace the hand-written ones. Fixture tests (2-3 methods) prove the pipeline works end-to-end.

**Tech Stack:** TypeScript compiler API (already in devDeps), git submodules, vitest

---

### Task 1: Add node-slack-sdk as a git submodule

**Files:**
- Create: `packages/plugin-slack/vendor/node-slack-sdk` (submodule)
- Modify: `.gitmodules` (auto-created by git)

**Step 1: Add the submodule pinned to the commit we spiked against**

Run:
```bash
cd packages/plugin-slack
git submodule add https://github.com/slackapi/node-slack-sdk.git vendor/node-slack-sdk
cd vendor/node-slack-sdk
git checkout e84fa7dde40db464082382661e6a64716eba3507
cd ../..
```

**Step 2: Verify the submodule is pinned**

Run: `git submodule status`
Expected: Shows the pinned commit hash for `packages/plugin-slack/vendor/node-slack-sdk`

**Step 3: Commit**

```bash
git add .gitmodules packages/plugin-slack/vendor/node-slack-sdk
git commit -m "chore(slack): add node-slack-sdk as vendored submodule for codegen"
```

---

### Task 2: Write the codegen script

**Files:**
- Create: `packages/plugin-slack/scripts/codegen.ts`

The script reads `vendor/node-slack-sdk/packages/web-api/src/methods.ts`, extracts all method entries, and writes four generated files. This task only writes the script and verifies it produces a correct JSON manifest — the actual file generation templates come in Tasks 3-6.

**Step 1: Create the codegen script with extraction logic**

The script must:
1. Parse `methods.ts` using `ts.createSourceFile`
2. Find the `Methods` class
3. Walk each `public readonly` property's object literal recursively
4. At each `bindApiCall`/`bindApiCallWithOptionalArgument` call, extract: API method string, args type name, response type name, optional flag, nesting path
5. Skip `bindFilesUploadV2` entries
6. Produce a `MethodEntry[]` array
7. For now, write the manifest to stdout as JSON

```typescript
/**
 * Codegen: generate Slack plugin source files from @slack/web-api SDK.
 *
 * Usage: npx tsx packages/plugin-slack/scripts/codegen.ts
 *
 * Reads vendor/node-slack-sdk/packages/web-api/src/methods.ts,
 * extracts all API method signatures, and generates:
 *   src/7.14.0/generated/node-kinds.ts
 *   src/7.14.0/generated/types.ts
 *   src/7.14.0/generated/build-methods.ts
 *   src/7.14.0/generated/interpreter.ts
 */

import * as ts from "typescript";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const SDK_METHODS = resolve(
  PLUGIN_ROOT,
  "vendor/node-slack-sdk/packages/web-api/src/methods.ts",
);
const GEN_DIR = resolve(PLUGIN_ROOT, "src/7.14.0/generated");

export interface MethodEntry {
  apiMethod: string;
  argsType: string;
  responseType: string;
  optional: boolean;
  path: string[];
  nodeKind: string;
}

export function extractMethods(filePath: string): MethodEntry[] {
  const source = readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const results: MethodEntry[] = [];

  function getTypeArgText(
    node: ts.CallExpression,
    index: number,
  ): string {
    if (!node.typeArguments || node.typeArguments.length <= index)
      return "unknown";
    return node.typeArguments[index].getText(sourceFile);
  }

  function getBindFnName(expr: ts.Expression): string | null {
    if (ts.isIdentifier(expr)) return expr.text;
    return null;
  }

  const BIND_FNS = new Set([
    "bindApiCall",
    "bindApiCallWithOptionalArgument",
  ]);

  function pathToNodeKind(path: string[]): string {
    return `slack/${path.join("_")}`;
  }

  function walkObjectLiteral(
    obj: ts.ObjectLiteralExpression,
    path: string[],
  ): void {
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
        if (fnName && BIND_FNS.has(fnName)) {
          const argsType = getTypeArgText(init, 0);
          const responseType = getTypeArgText(init, 1);
          let apiMethod = "";
          if (
            init.arguments.length >= 2 &&
            ts.isStringLiteral(init.arguments[1])
          ) {
            apiMethod = init.arguments[1].text;
          }
          results.push({
            apiMethod,
            argsType,
            responseType,
            optional:
              fnName === "bindApiCallWithOptionalArgument",
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

// --- Generators (Tasks 3-6 fill these in) ---

function generateNodeKinds(methods: MethodEntry[]): string {
  const kinds = methods.map((m) => `  "${m.nodeKind}",`).join("\n");
  return [
    "// AUTO-GENERATED by scripts/codegen.ts — do not edit",
    "",
    "export const SLACK_NODE_KINDS = [",
    kinds,
    "] as const;",
    "",
  ].join("\n");
}

function generateTypes(methods: MethodEntry[]): string {
  const argsImports = [...new Set(methods.map((m) => m.argsType))]
    .sort()
    .map((t) => `  ${t},`)
    .join("\n");
  const responseImports = [
    ...new Set(methods.map((m) => m.responseType)),
  ]
    .sort()
    .map((t) => `  ${t},`)
    .join("\n");

  // Build the nested SlackMethods interface
  function buildMethodsInterface(
    methods: MethodEntry[],
  ): string {
    // Group by path structure
    interface MethodTree {
      [key: string]: MethodTree | MethodEntry;
    }
    const tree: MethodTree = {};
    for (const m of methods) {
      let node = tree;
      for (let i = 0; i < m.path.length - 1; i++) {
        const seg = m.path[i];
        if (!(seg in node)) node[seg] = {};
        node = node[seg] as MethodTree;
      }
      node[m.path[m.path.length - 1]] = m;
    }

    function renderTree(
      t: MethodTree,
      indent: string,
    ): string {
      const lines: string[] = [];
      for (const key of Object.keys(t).sort()) {
        const val = t[key];
        if ("apiMethod" in val) {
          const m = val as MethodEntry;
          const paramType = `SlackParams<${m.argsType}>`;
          const retType = `Expr<${m.responseType}>`;
          if (m.optional) {
            lines.push(
              `${indent}${key}(params?: ${paramType}): ${retType};`,
            );
          } else {
            lines.push(
              `${indent}${key}(params: ${paramType}): ${retType};`,
            );
          }
        } else {
          lines.push(`${indent}${key}: {`);
          lines.push(renderTree(val as MethodTree, indent + "  "));
          lines.push(`${indent}};`);
        }
      }
      return lines.join("\n");
    }

    return renderTree(tree, "    ");
  }

  const methodsBody = buildMethodsInterface(methods);

  return [
    "// AUTO-GENERATED by scripts/codegen.ts — do not edit",
    "",
    'import type { Expr } from "@mvfm/core";',
    "import type {",
    argsImports,
    responseImports,
    '} from "@slack/web-api";',
    "",
    "type Primitive = string | number | boolean | null | undefined;",
    "",
    "type Exprify<T> = T extends Primitive",
    "  ? T | Expr<T>",
    "  : T extends Array<infer U>",
    "    ? Array<Exprify<U>> | Expr<T>",
    "    : T extends object",
    '      ? { [K in keyof T]: Exprify<T[K]> } | Expr<T>',
    "      : T | Expr<T>;",
    "",
    'type SlackParams<T> = Exprify<Omit<T, "token">>;',
    "",
    "/** Slack operations added to the DSL context by the slack plugin. */",
    "export interface SlackMethods {",
    "  /** Slack API operations, namespaced under `$.slack`. */",
    "  slack: {",
    methodsBody,
    "  };",
    "}",
    "",
    "/**",
    " * Configuration for the slack plugin.",
    " *",
    " * Requires a bot or user token (`xoxb-...` or `xoxp-...`).",
    " */",
    "export interface SlackConfig {",
    "  /** Slack bot or user token (e.g. `xoxb-...` or `xoxp-...`). */",
    "  token: string;",
    "}",
    "",
  ].join("\n");
}

function generateBuildMethods(methods: MethodEntry[]): string {
  // Group into a tree, then generate nested object literal code
  interface MethodTree {
    [key: string]: MethodTree | MethodEntry;
  }
  const tree: MethodTree = {};
  for (const m of methods) {
    let node = tree;
    for (let i = 0; i < m.path.length - 1; i++) {
      const seg = m.path[i];
      if (!(seg in node)) node[seg] = {};
      node = node[seg] as MethodTree;
    }
    node[m.path[m.path.length - 1]] = m;
  }

  function renderTree(t: MethodTree, indent: string): string {
    const lines: string[] = [];
    for (const key of Object.keys(t).sort()) {
      const val = t[key];
      if ("apiMethod" in val) {
        const m = val as MethodEntry;
        if (m.optional) {
          lines.push(`${indent}${key}(params?) {`);
          lines.push(
            `${indent}  return ctx.expr({`,
          );
          lines.push(
            `${indent}    kind: "${m.nodeKind}",`,
          );
          lines.push(
            `${indent}    params: params != null ? resolveParams(params) : null,`,
          );
          lines.push(`${indent}    config,`);
          lines.push(`${indent}  });`);
          lines.push(`${indent}},`);
        } else {
          lines.push(`${indent}${key}(params) {`);
          lines.push(
            `${indent}  return ctx.expr({`,
          );
          lines.push(
            `${indent}    kind: "${m.nodeKind}",`,
          );
          lines.push(
            `${indent}    params: resolveParams(params),`,
          );
          lines.push(`${indent}    config,`);
          lines.push(`${indent}  });`);
          lines.push(`${indent}},`);
        }
      } else {
        lines.push(`${indent}${key}: {`);
        lines.push(renderTree(val as MethodTree, indent + "  "));
        lines.push(`${indent}},`);
      }
    }
    return lines.join("\n");
  }

  const body = renderTree(tree, "        ");

  return [
    "// AUTO-GENERATED by scripts/codegen.ts — do not edit",
    "",
    'import type { PluginContext } from "@mvfm/core";',
    'import type { SlackConfig, SlackMethods } from "./types";',
    "",
    "export function buildSlackMethods(",
    "  ctx: PluginContext,",
    "  config: SlackConfig,",
    "): SlackMethods {",
    "  const resolveParams = (params: unknown) =>",
    "    ctx.lift(params).__node;",
    "",
    "  return {",
    "    slack: {",
    body,
    "    },",
    "  };",
    "}",
    "",
  ].join("\n");
}

function generateInterpreter(methods: MethodEntry[]): string {
  const nodeToMethod = methods
    .map((m) => `  "${m.nodeKind}": "${m.apiMethod}",`)
    .join("\n");

  // Build per-kind node interfaces and defineInterpreter entries
  function kindToInterfaceName(kind: string): string {
    // "slack/chat_postMessage" -> "SlackChatPostMessageNode"
    const parts = kind
      .replace("slack/", "")
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
    return `Slack${parts.join("")}Node`;
  }

  const kindType =
    "(typeof SLACK_NODE_KINDS)[number]";

  const nodeInterfaces = methods
    .map((m) => {
      const name = kindToInterfaceName(m.nodeKind);
      return `interface ${name} extends SlackNode<"${m.nodeKind}"> {}`;
    })
    .join("\n");

  const moduleAugmentation = methods
    .map((m) => {
      const name = kindToInterfaceName(m.nodeKind);
      return `    "${m.nodeKind}": ${name};`;
    })
    .join("\n");

  const interpreterEntries = methods
    .map((m) => {
      const name = kindToInterfaceName(m.nodeKind);
      return `    "${m.nodeKind}": async function* (node: ${name}) {\n      return yield* handler(node);\n    },`;
    })
    .join("\n");

  return [
    "// AUTO-GENERATED by scripts/codegen.ts — do not edit",
    "",
    'import type { Interpreter, TypedNode } from "@mvfm/core";',
    'import { defineInterpreter, eval_ } from "@mvfm/core";',
    'import { SLACK_NODE_KINDS } from "./node-kinds";',
    "",
    "/** Abstract Slack client interface consumed by the slack interpreter. */",
    "export interface SlackClient {",
    "  /** Execute a Slack API request and return the parsed response. */",
    "  apiCall(",
    "    method: string,",
    "    params?: Record<string, unknown>,",
    "  ): Promise<unknown>;",
    "}",
    "",
    "const NODE_TO_METHOD: Record<string, string> = {",
    nodeToMethod,
    "};",
    "",
    `type SlackKind = ${kindType};`,
    "",
    "interface SlackNode<K extends SlackKind = SlackKind>",
    "  extends TypedNode<unknown> {",
    "  kind: K;",
    "  params?: TypedNode<Record<string, unknown>> | null;",
    "  config: { token: string };",
    "}",
    "",
    nodeInterfaces,
    "",
    'declare module "@mvfm/core" {',
    "  interface NodeTypeMap {",
    moduleAugmentation,
    "  }",
    "}",
    "",
    "/**",
    " * Creates an interpreter for all `slack/*` node kinds.",
    " *",
    " * @param client - The SlackClient to execute against.",
    " * @returns An Interpreter handling all slack node kinds.",
    " */",
    "export function createSlackInterpreter(",
    "  client: SlackClient,",
    "): Interpreter {",
    "  const handler = async function* (node: SlackNode) {",
    "    const method = NODE_TO_METHOD[node.kind];",
    "    if (!method)",
    '      throw new Error(',
    '        `Slack interpreter: unknown node kind "${node.kind}"`,',
    "      );",
    "    const params =",
    "      node.params != null",
    "        ? yield* eval_(node.params)",
    "        : undefined;",
    "    return await client.apiCall(method, params);",
    "  };",
    "",
    "  return defineInterpreter<SlackKind>()({",
    interpreterEntries,
    "  });",
    "}",
    "",
  ].join("\n");
}

// --- Main ---

function main(): void {
  console.log(`Reading SDK methods from: ${SDK_METHODS}`);
  const methods = extractMethods(SDK_METHODS);
  console.log(`Extracted ${methods.length} methods`);

  mkdirSync(GEN_DIR, { recursive: true });

  const nodeKinds = generateNodeKinds(methods);
  writeFileSync(resolve(GEN_DIR, "node-kinds.ts"), nodeKinds);
  console.log("  wrote node-kinds.ts");

  const types = generateTypes(methods);
  writeFileSync(resolve(GEN_DIR, "types.ts"), types);
  console.log("  wrote types.ts");

  const buildMethods = generateBuildMethods(methods);
  writeFileSync(resolve(GEN_DIR, "build-methods.ts"), buildMethods);
  console.log("  wrote build-methods.ts");

  const interpreter = generateInterpreter(methods);
  writeFileSync(resolve(GEN_DIR, "interpreter.ts"), interpreter);
  console.log("  wrote interpreter.ts");

  console.log(`\nDone! Generated files in ${GEN_DIR}`);
}

main();
```

**Step 2: Run it and verify extraction count**

Run: `npx tsx packages/plugin-slack/scripts/codegen.ts`
Expected: `Extracted 271 methods` (272 minus 1 filesUploadV2)

**Step 3: Commit**

```bash
git add packages/plugin-slack/scripts/codegen.ts
git commit -m "feat(slack): add codegen script to generate plugin from SDK source"
```

---

### Task 3: Run codegen and rewire the plugin to use generated files

**Files:**
- Create: `packages/plugin-slack/src/7.14.0/generated/` (4 files, by running codegen)
- Modify: `packages/plugin-slack/src/7.14.0/index.ts` — import from `./generated/` instead of local files
- Modify: `packages/plugin-slack/src/index.ts` — update re-exports
- Delete: `packages/plugin-slack/src/7.14.0/node-kinds.ts` (replaced by generated)
- Delete: `packages/plugin-slack/src/7.14.0/types.ts` (replaced by generated)
- Delete: `packages/plugin-slack/src/7.14.0/build-methods.ts` (replaced by generated)

Keep `interpreter.ts` (the hand-written one) for now as a reference but the generated `interpreter.ts` in `generated/` will be the new source. The hand-written `client-slack-web-api.ts`, `handler.server.ts`, `handler.client.ts` are NOT generated and stay as-is.

**Step 1: Run codegen**

Run: `npx tsx packages/plugin-slack/scripts/codegen.ts`

**Step 2: Rewire `src/7.14.0/index.ts`**

Replace imports to point at `./generated/` for node-kinds, types, build-methods, and interpreter:

```typescript
import { definePlugin } from "@mvfm/core";
import { buildSlackMethods } from "./generated/build-methods";
import { createSlackInterpreter } from "./generated/interpreter";
import { SLACK_NODE_KINDS } from "./generated/node-kinds";
import type { SlackConfig } from "./generated/types";

export type { SlackConfig, SlackMethods } from "./generated/types";

export function slack(config: SlackConfig) {
  return definePlugin({
    name: "slack",
    nodeKinds: [...SLACK_NODE_KINDS],
    defaultInterpreter: () => slackInterpreter,
    build(ctx) {
      return buildSlackMethods(ctx, config);
    },
  });
}
```

Note: `slackInterpreter` (the lazy env-based default) lives in the old `interpreter.ts`. It depends on `createSlackInterpreter`. We need to either move it into `index.ts` or keep a thin wrapper. Simplest: move the lazy interpreter + `wrapSlackWebClient` import into `index.ts` since they're not generated.

Concretely, `src/7.14.0/index.ts` becomes:

```typescript
import { definePlugin } from "@mvfm/core";
import type { Interpreter } from "@mvfm/core";
import { buildSlackMethods } from "./generated/build-methods";
import { createSlackInterpreter } from "./generated/interpreter";
import { SLACK_NODE_KINDS } from "./generated/node-kinds";
import type { SlackConfig } from "./generated/types";
import { wrapSlackWebClient } from "./client-slack-web-api";
import type { SlackClient } from "./generated/interpreter";

export type { SlackConfig, SlackMethods } from "./generated/types";
export type { SlackClient } from "./generated/interpreter";
export { createSlackInterpreter } from "./generated/interpreter";
export { SLACK_NODE_KINDS } from "./generated/node-kinds";

function requiredEnv(name: "SLACK_BOT_TOKEN"): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  const value = env?.[name];
  if (!value) {
    throw new Error(
      `@mvfm/plugin-slack: missing ${name}. Set ${name} or use createSlackInterpreter(...)`,
    );
  }
  return value;
}

const dynamicImport = new Function("m", "return import(m)") as (
  moduleName: string,
) => Promise<any>;

function lazyInterpreter(factory: () => Interpreter): Interpreter {
  let cached: Interpreter | undefined;
  const get = () => (cached ??= factory());
  return new Proxy({} as Interpreter, {
    get(_target, property) {
      return get()[property as keyof Interpreter];
    },
    has(_target, property) {
      return property in get();
    },
    ownKeys() {
      return Reflect.ownKeys(get());
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Object.getOwnPropertyDescriptor(get(), property);
      return descriptor
        ? descriptor
        : { configurable: true, enumerable: true, writable: false, value: undefined };
    },
  });
}

export const slackInterpreter: Interpreter = lazyInterpreter(() =>
  createSlackInterpreter(
    (() => {
      let clientPromise: Promise<SlackClient> | undefined;
      const getClient = async (): Promise<SlackClient> => {
        if (!clientPromise) {
          const token = requiredEnv("SLACK_BOT_TOKEN");
          clientPromise = dynamicImport("@slack/web-api").then((mod) => {
            return wrapSlackWebClient(new mod.WebClient(token));
          });
        }
        return clientPromise;
      };
      return {
        async apiCall(method: string, params?: Record<string, unknown>) {
          const client = await getClient();
          return client.apiCall(method, params);
        },
      } satisfies SlackClient;
    })(),
  ),
);

export function slack(config: SlackConfig) {
  return definePlugin({
    name: "slack",
    nodeKinds: [...SLACK_NODE_KINDS],
    defaultInterpreter: () => slackInterpreter,
    build(ctx) {
      return buildSlackMethods(ctx, config);
    },
  });
}
```

**Step 3: Update `src/index.ts` re-exports**

```typescript
export type { SlackConfig, SlackMethods } from "./7.14.0";
export { slack } from "./7.14.0";
export { wrapSlackWebClient } from "./7.14.0/client-slack-web-api";
export type { ClientHandlerOptions } from "./7.14.0/handler.client";
export { clientInterpreter } from "./7.14.0/handler.client";
export { serverEvaluate, serverInterpreter } from "./7.14.0/handler.server";
export type { SlackClient } from "./7.14.0";
export { createSlackInterpreter, slackInterpreter } from "./7.14.0";
```

**Step 4: Delete the old hand-written files that are now generated**

```bash
rm packages/plugin-slack/src/7.14.0/node-kinds.ts
rm packages/plugin-slack/src/7.14.0/types.ts
rm packages/plugin-slack/src/7.14.0/build-methods.ts
rm packages/plugin-slack/src/7.14.0/interpreter.ts
```

**Step 5: Update handler.server.ts imports**

The `handler.server.ts` imports from `./interpreter` — update to `./generated/interpreter`:

```typescript
import { createSlackInterpreter, type SlackClient } from "./generated/interpreter";
```

**Step 6: Build and type-check**

Run: `npm run build -w packages/plugin-slack`
Expected: Clean build. This is the real validation — 271 generated methods all type-check against the SDK's own types.

**Step 7: Commit**

```bash
git add -A packages/plugin-slack/src/
git commit -m "feat(slack): replace hand-written plugin with codegen from SDK source"
```

---

### Task 4: Fix existing tests to work with generated code

**Files:**
- Modify: `packages/plugin-slack/tests/7.14.0/slack.shared.ts`
- Modify: `packages/plugin-slack/tests/7.14.0/interpreter.test.ts`
- Modify: `packages/plugin-slack/tests/7.14.0/chat-conversations.test.ts`
- Modify: `packages/plugin-slack/tests/7.14.0/users-reactions-files.test.ts`
- Modify: `packages/plugin-slack/tests/7.14.0/integration.test.ts`

**Step 1: Update import paths in test files**

All test files that import from `../../src/7.14.0/interpreter` need to change to `../../src/7.14.0/generated/interpreter`. Files importing from `../../src/7.14.0` (the index) should still work if the re-exports are correct.

Grep for old import paths and update:
- `../../src/7.14.0/interpreter` → `../../src/7.14.0/generated/interpreter`

**Step 2: Run tests**

Run: `npm test -w packages/plugin-slack`
Expected: All existing tests pass

**Step 3: Commit**

```bash
git add packages/plugin-slack/tests/
git commit -m "test(slack): update imports for generated code"
```

---

### Task 5: Add fixture-based integration tests (2-3 methods)

**Files:**
- Create: `packages/plugin-slack/tests/7.14.0/fixture-client.ts`
- Create: `packages/plugin-slack/tests/7.14.0/fixtures/` (directory)
- Create: `packages/plugin-slack/tests/7.14.0/record-fixtures.ts`
- Create: `packages/plugin-slack/tests/7.14.0/fixture-integration.test.ts`

**Step 1: Create the fixture client**

Much simpler than Anthropic's since Slack uses `apiCall(method, params)` — no HTTP routing needed:

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SlackClient } from "../../src/7.14.0/generated/interpreter";

export interface Fixture {
  request: { method: string; params?: Record<string, unknown> };
  response: unknown;
}

function sortedStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

export function createFixtureClient(fixturesDir: string): SlackClient {
  const cache = new Map<string, Fixture>();

  function loadFixture(method: string): Fixture {
    const cached = cache.get(method);
    if (cached) return cached;
    // method "chat.postMessage" -> filename "chat_postMessage.json"
    const filename = method.replace(/\./g, "_") + ".json";
    const filePath = join(fixturesDir, filename);
    const raw = readFileSync(filePath, "utf-8");
    const fixture = JSON.parse(raw) as Fixture;
    cache.set(method, fixture);
    return fixture;
  }

  return {
    async apiCall(method: string, params?: Record<string, unknown>) {
      const fixture = loadFixture(method);
      if (fixture.request.params !== undefined) {
        const expected = sortedStringify(fixture.request.params);
        const actual = sortedStringify(params);
        if (expected !== actual) {
          throw new Error(
            `Contract drift for "${method}".\n` +
              `Expected: ${expected}\n` +
              `Actual:   ${actual}`,
          );
        }
      }
      return fixture.response;
    },
  };
}
```

**Step 2: Create the record-fixtures script**

This calls 2-3 real Slack API methods and saves the request/response pairs. Pick read-only methods that won't mutate workspace state:

1. `auth.test` — identity check, always safe
2. `conversations.list` — list channels, read-only
3. `users.list` — list users, read-only (optional, if token has scope)

```typescript
/**
 * Record Slack API fixtures from real API.
 *
 * Usage: npx tsx tests/7.14.0/record-fixtures.ts
 *
 * Reads SLACK_BOT_TOKEN from monorepo root .env file.
 * NOT run in CI — only when fixtures need refreshing.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Fixture } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, "../../../..");
const FIXTURES_DIR = resolve(__dirname, "fixtures");

function loadToken(): string {
  const envPath = resolve(MONOREPO_ROOT, ".env");
  const contents = readFileSync(envPath, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eqIdx = trimmed.indexOf("=");
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key === "SLACK_BOT_TOKEN") return value;
  }
  throw new Error(`SLACK_BOT_TOKEN not found in ${envPath}`);
}

function save(name: string, fixture: Fixture): void {
  const filePath = resolve(FIXTURES_DIR, `${name}.json`);
  writeFileSync(filePath, JSON.stringify(fixture, null, 2) + "\n");
  console.log(`  saved ${name}.json`);
}

async function main(): Promise<void> {
  const token = loadToken();
  const { WebClient } = await import("@slack/web-api");
  const web = new WebClient(token);

  mkdirSync(FIXTURES_DIR, { recursive: true });
  console.log("Recording Slack API fixtures...\n");

  // 1. auth.test
  console.log("[auth.test]");
  const authParams = {};
  const authResponse = await web.apiCall("auth.test", authParams);
  save("auth_test", {
    request: { method: "auth.test" },
    response: authResponse,
  });

  // 2. conversations.list
  console.log("[conversations.list]");
  const convParams = { limit: 5 };
  const convResponse = await web.apiCall("conversations.list", convParams);
  save("conversations_list", {
    request: { method: "conversations.list", params: convParams },
    response: convResponse,
  });

  // 3. users.list
  console.log("[users.list]");
  const usersParams = { limit: 5 };
  const usersResponse = await web.apiCall("users.list", usersParams);
  save("users_list", {
    request: { method: "users.list", params: usersParams },
    response: usersResponse,
  });

  console.log("\nDone! Fixtures saved to tests/7.14.0/fixtures/");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

**Step 3: Record fixtures (requires user to provide token)**

Run: `npx tsx packages/plugin-slack/tests/7.14.0/record-fixtures.ts`
Expected: 3 JSON files created in `tests/7.14.0/fixtures/`

**Step 4: Write fixture integration test**

```typescript
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Program } from "@mvfm/core";
import { coreInterpreter, foldAST, injectInput, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { slack } from "../../src/7.14.0";
import { createSlackInterpreter } from "../../src/7.14.0/generated/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const app = mvfm(num, str, slack({ token: "xoxb-fixture" }));

async function run(prog: Program) {
  const injected = injectInput(prog, {});
  const combined = {
    ...createSlackInterpreter(fixtureClient),
    ...coreInterpreter,
  };
  return await foldAST(combined, injected);
}

describe("slack fixture integration", () => {
  it("auth.test returns user identity", async () => {
    const prog = app(($) => $.slack.auth.test());
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(result.user_id).toBeDefined();
    expect(result.team_id).toBeDefined();
  });

  it("conversations.list returns channels", async () => {
    const prog = app(($) =>
      $.slack.conversations.list({ limit: 5 }),
    );
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.channels)).toBe(true);
  });

  it("users.list returns members", async () => {
    const prog = app(($) => $.slack.users.list({ limit: 5 }));
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.members)).toBe(true);
  });
});
```

**Step 5: Run fixture tests**

Run: `npm test -w packages/plugin-slack`
Expected: All tests pass (existing + new fixture tests)

**Step 6: Commit**

```bash
git add packages/plugin-slack/tests/7.14.0/fixture-client.ts
git add packages/plugin-slack/tests/7.14.0/record-fixtures.ts
git add packages/plugin-slack/tests/7.14.0/fixture-integration.test.ts
git add packages/plugin-slack/tests/7.14.0/fixtures/
git commit -m "test(slack): add fixture-based integration tests for codegen validation"
```

---

### Task 6: Clean up spike artifacts

**Files:**
- Delete: `scripts/spike-slack-codegen.ts`
- Delete: `scripts/slack-api-manifest.json`

**Step 1: Remove spike files**

```bash
rm scripts/spike-slack-codegen.ts scripts/slack-api-manifest.json
```

**Step 2: Commit**

```bash
git add -A scripts/
git commit -m "chore: remove slack codegen spike artifacts"
```

---

### Task 7: Final validation

**Step 1: Full build + check + test from monorepo root**

Run: `npm run build && npm run check && npm test`
Expected: Clean across all packages

**Step 2: Verify generated file line counts**

The generated files may exceed 300 lines (271 methods × boilerplate). If any generated file exceeds 300 lines, that's expected for auto-generated code — add a `// biome-ignore` or split the generation into multiple files per top-level group (e.g., `interpreter-admin.ts`, `interpreter-chat.ts`). Discuss with user if this is a concern.

Run: `wc -l packages/plugin-slack/src/7.14.0/generated/*.ts`
