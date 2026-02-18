# Design: Fal Plugin Integration Tests with Fixture Recording/Replay

**Issue:** #78
**Date:** 2026-02-18

## Problem

Fal plugin lacks integration tests with realistic responses. Live fal calls are too expensive/flaky for every commit, so we need a fixture recording/replay mechanism.

## Decisions

- **Endpoint:** `fal-ai/fast-sdxl` — cheap (~$0.01/call), fast (2-5s), stable API
- **Intercept layer:** FalClient interface — clean, no HTTP mocking, works at our abstraction level
- **Record trigger:** `FAL_RECORD=1` env var within the same test file (no separate script)

## Architecture

A recording/replaying FalClient proxy wraps the real SDK client:
- **Replay mode** (default): reads fixtures from disk, matches by `(method, endpointId, normalizedInput)`
- **Record mode** (`FAL_RECORD=1`): delegates to real client, saves responses to disk

### Files

| File | Purpose | ~Lines |
|------|---------|--------|
| `tests/1.9.1/fixture-client.ts` | Recording/replaying FalClient wrapper | ~100 |
| `tests/1.9.1/fixtures/*.json` | Committed fixture snapshots | N/A |
| `tests/1.9.1/integration.test.ts` | Rewritten to use fixture client | ~150 |

## Fixture Format

Each fixture file is a JSON array of request/response pairs:

```json
[
  {
    "method": "run",
    "endpointId": "fal-ai/fast-sdxl",
    "input": { "input": { "prompt": "a cat" } },
    "response": { "data": { "images": [...], "seed": 12345 }, "requestId": "abc123" }
  }
]
```

### Matching

Key: `method + endpointId + JSON.stringify(sortedInput)`.

During replay, if a request doesn't match any fixture entry, the test **throws immediately** with a message showing expected vs actual input. This catches contract drift per issue requirements.

## Test Scenarios

1. **`fal.run`** — Direct execution with `fal-ai/fast-sdxl`, verify response has `data.images` and `requestId`
2. **`fal.subscribe`** — Queue-based execution, same endpoint, verify same result shape
3. **`fal.queue.submit` → `queue.status` → `queue.result`** — Full queue lifecycle chain
4. **`fal.queue.cancel`** — Submit then cancel

Each test goes through the full mvfm pipeline: `mvfm → app → prog → injectInput → serverEvaluate → result`.

## Record Flow

When `FAL_RECORD=1` is set:
1. Test reads `FAL_API_KEY` from env (or `.env` file)
2. Creates a real fal SDK client with credentials
3. Wraps it in the recording proxy
4. Runs all tests — proxy forwards to real API and captures responses
5. After all tests, writes fixtures to `tests/1.9.1/fixtures/*.json`
6. Developer commits the updated fixtures

## Out of Scope

- Running live fal calls on every CI commit
- Auto-refreshing fixtures in normal test runs
