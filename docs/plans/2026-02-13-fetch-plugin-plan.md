# Fetch Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the fetch plugin (WHATWG Fetch API) as an external-service plugin with 5 node kinds, 2 effect types, and full test coverage.

**Architecture:** External-service plugin at `src/plugins/fetch/whatwg/`. Factory function `fetch(config?)` returns `PluginDefinition<FetchMethods>`. Two effect types: `fetch/http_request` for the network call, `fetch/read_body` for parsing response body/metadata. Follows stripe plugin pattern exactly.

**Tech Stack:** TypeScript, vitest, ilo core (PluginDefinition, InterpreterFragment, StepHandler, foldAST, runAST)

---

### Task 1: Plugin Definition (`index.ts`)

**Files:**
- Create: `src/plugins/fetch/whatwg/index.ts`

Write the PluginDefinition with FetchConfig, FetchMethods, and build() function.
5 node kinds: fetch/request, fetch/json, fetch/text, fetch/status, fetch/headers.
`$.fetch(url, init?)` is callable. `$.fetch.json(response)`, `$.fetch.text(response)`, etc.

### Task 2: AST Construction Tests (`index.test.ts`)

**Files:**
- Create: `tests/plugins/fetch/whatwg/index.test.ts`

Test each node kind produces correct AST. Test Expr params, optional init, orphan rejection, cross-operation dependencies.

### Task 3: Interpreter Fragment (`interpreter.ts`)

**Files:**
- Create: `src/plugins/fetch/whatwg/interpreter.ts`

Generator-based interpreter. fetch/request yields fetch/http_request effect. fetch/json, fetch/text, fetch/status, fetch/headers yield fetch/read_body effect with mode.

### Task 4: Interpreter Tests (`interpreter.test.ts`)

**Files:**
- Create: `tests/plugins/fetch/whatwg/interpreter.test.ts`

Mock handler tests verifying correct effects are yielded.

### Task 5: Server Handler + SDK Adapter

**Files:**
- Create: `src/plugins/fetch/whatwg/handler.server.ts`
- Create: `src/plugins/fetch/whatwg/client-fetch.ts`

Server handler handles fetch/http_request and fetch/read_body effects. SDK adapter wraps globalThis.fetch.

### Task 6: Client Handler

**Files:**
- Create: `src/plugins/fetch/whatwg/handler.client.ts`

Standard client handler (same pattern as stripe).

### Task 7: Integration Tests

**Files:**
- Create: `tests/plugins/fetch/whatwg/integration.test.ts`

Real HTTP calls against a local HTTP server (using Node http module, not testcontainers).

### Task 8: Build Validation and Commit

Run `npm run build && npm run check && npm test`. Fix any issues. Commit.
