# Resend: Fixture-Backed Tests + Docs Examples

**Issues**: #83 (fixture tests), #248 (docs examples)
**Date**: 2026-02-18
**Strategy**: Mirror Twilio plugin approach exactly

## Context

The Resend plugin has 7 node kinds (`send_email`, `get_email`, `send_batch`, `create_contact`, `get_contact`, `list_contacts`, `remove_contact`). Integration tests currently use a local `node:http` mock server. No docs examples exist.

## Design

### 1. Fixture Client (`tests/6.9.2/fixture-client.ts`)

Implements `ResendClient` interface with two modes.

**Route table** maps method + regex → operation name:

| Method | Path pattern | Operation |
|--------|-------------|-----------|
| POST | `/emails` (exact) | `send_email` |
| GET | `/emails/{id}` | `get_email` |
| POST | `/emails/batch` | `send_batch` |
| POST | `/contacts` (exact) | `create_contact` |
| GET | `/contacts/{id}` | `get_contact` |
| GET | `/contacts` (exact) | `list_contacts` |
| DELETE | `/contacts/{id}` | `remove_contact` |

**Replay mode** (`createFixtureClient(fixturesDir)`):
- Loads fixture JSON from disk at construction time
- Matches incoming `request(method, path, params)` via `resolveOperation()`
- Compares params via `sortedStringify()` — throws on drift
- Returns stored response

**Recording mode** (`createRecordingClient(baseUrl, fixturesDir)`):
- Proxies requests to Prism via `fetch`
- Captures request/response pairs
- Saves per-operation JSON on `.save()`

### 2. Recording Script (`scripts/record-fixtures.ts`)

1. Starts Prism: `npx @stoplight/prism-cli mock -p 4010 https://raw.githubusercontent.com/resend/resend-openapi/main/resend.yaml`
2. Creates recording client → `http://localhost:4010`
3. Executes 7 operations with hardcoded test data
4. Saves fixture files
5. Stops Prism

### 3. Fixture Files (`tests/6.9.2/fixtures/`)

7 JSON files: `send_email.json`, `get_email.json`, `send_batch.json`, `create_contact.json`, `get_contact.json`, `list_contacts.json`, `remove_contact.json`.

Each: `{ request: { method, path, params? }, response: { ... } }`

### 4. Integration Tests (`tests/6.9.2/integration.test.ts`)

Replace `node:http` mock server with `createFixtureClient(fixturesDir)`. Same test structure, fixture-backed execution.

### 5. Fixture Client Tests (`tests/6.9.2/fixture-client.test.ts`)

Validate `resolveOperation()` route matching and `sortedStringify()` normalization.

### 6. Docs Examples (`packages/docs/src/examples/resend.ts`)

7 examples (one per node kind) following `app → prog → foldAST` with `crystalBallResendInterpreter`. Uses `plugins: ["@mvfm/plugin-resend"]`.

### 7. Playground Wiring

- `playground-scope.ts`: Add `crystalBallResendInterpreter` using a crystal ball client
- `examples/index.ts`: Import and register resend examples
- `scripts/check-docs-coverage.ts`: Add resend plugin to coverage check
