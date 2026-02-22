/**
 * Orchestrator that generates documentation examples for all Slack plugin
 * node kinds. Parses Slack SDK response types at build time to produce
 * deterministic mock data for interactive playgrounds.
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { faker } from "@faker-js/faker";
import { NODE_TO_METHOD } from "@mvfm/plugin-slack";
import type { ExampleEntry, NamespaceIndex, NodeExample } from "../types.js";
import { generateCodeString } from "./code-templates.js";
import { generateResponse } from "./mock-generator.js";
import { parseResponseFile } from "./type-parser.js";

const SLACK_PLUGINS = ["@mvfm/plugin-slack"];

/**
 * Compute a simple numeric hash from a string (sum of char codes).
 * Used to seed faker for deterministic per-method output.
 */
function simpleHash(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash += s.charCodeAt(i);
  }
  return hash;
}

/**
 * Derive the response type filename from a Slack API method name.
 * e.g. `"chat.postMessage"` -> `"ChatPostMessageResponse.d.ts"`
 */
function responseFileName(apiMethod: string): string {
  return (
    apiMethod
      .split(".")
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join("") + "Response.d.ts"
  );
}

/**
 * Derive the response type name from a Slack API method name.
 * e.g. `"chat.postMessage"` -> `"ChatPostMessageResponse"`
 */
function responseTypeName(apiMethod: string): string {
  return (
    apiMethod
      .split(".")
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join("") + "Response"
  );
}

/**
 * Derive the dot-path accessor from a node kind.
 * e.g. `"slack/chat_postMessage"` -> `"chat.postMessage"`
 */
function nodeKindToAccessor(nodeKind: string): string {
  return nodeKind.replace("slack/", "").replace(/_/g, ".");
}

/**
 * Resolve the path to the `@slack/web-api` response types directory.
 * Uses `createRequire` rooted at the `@mvfm/plugin-slack` package,
 * which has `@slack/web-api` as a dependency.
 */
function resolveResponseDir(): string {
  const require = createRequire(import.meta.url);
  const slackPkgPath = require.resolve("@slack/web-api/package.json");
  return join(dirname(slackPkgPath), "dist", "types", "response");
}

/** Build the namespace landing page for the slack plugin. */
function buildNamespaceIndex(): NamespaceIndex {
  return {
    content: [
      "<p>The <strong>Slack plugin</strong> provides type-safe access to the ",
      '<a href="https://api.slack.com/methods">Slack Web API</a>. ',
      "Every API method is available as a node kind, with full TypeScript ",
      "types for arguments and responses.</p>",
      "<p>Methods are accessed via the <code>$.slack</code> namespace using ",
      "dot notation that mirrors the official API (e.g. ",
      "<code>$.slack.chat.postMessage()</code>).</p>",
      "<p>The plugin ships with 271 methods covering all of the Slack Web API ",
      "surface area.</p>",
    ].join(""),
  };
}

/**
 * Generate all Slack documentation examples from the SDK source types.
 *
 * @returns A record mapping node kinds (and the `"slack"` namespace key) to
 *   their corresponding example entries.
 */
export function generateSlackExamples(): Record<string, ExampleEntry> {
  const examples: Record<string, ExampleEntry> = {};
  const responseDir = resolveResponseDir();

  // Add namespace landing page
  examples["slack"] = buildNamespaceIndex();

  for (const [nodeKind, apiMethod] of Object.entries(NODE_TO_METHOD)) {
    const accessor = nodeKindToAccessor(nodeKind);
    const fileName = responseFileName(apiMethod);
    const typeName = responseTypeName(apiMethod);
    const filePath = join(responseDir, fileName);

    // Seed faker deterministically per node kind
    faker.seed(simpleHash(nodeKind));

    let mockData: unknown;
    if (existsSync(filePath)) {
      try {
        const model = parseResponseFile(filePath);
        mockData = generateResponse(typeName, model);
      } catch {
        // Fall back to generic response if parsing fails
        mockData = { ok: true };
      }
    } else {
      // Some methods use generic WebAPICallResult with no dedicated type file
      mockData = { ok: true };
    }

    const code = generateCodeString(accessor, nodeKind, true);
    const description = `Call the Slack ${apiMethod} API method`;
    const mockInterpreter = `({ "${nodeKind}": async function* () { return (${JSON.stringify(mockData)}); } })`;

    const example: NodeExample = {
      description,
      code,
      plugins: SLACK_PLUGINS,
      mockInterpreter,
    };

    examples[nodeKind] = example;
  }

  return examples;
}
