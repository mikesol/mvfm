# Twilio Plugin: Fixture-Backed Integration Tests

**Issue**: #87
**Date**: 2026-02-18

## Problem

Twilio integration tests use `createMockClient()` with hardcoded responses. No input validation, no contract drift detection, no realistic response shapes.

## Design

### Two-Mode Fixture Client

A `FixtureClient` implementing `TwilioClient` operates in two modes:

1. **Record mode** (`TWILIO_FIXTURE_MODE=record`): Proxies requests to a Prism mock server (started from Twilio's OpenAPI spec), captures request/response pairs, writes them to a committed JSON file.

2. **Replay mode** (default): Loads committed fixtures, serves responses, fails hard if a request's normalized key doesn't match any recorded fixture.

### Fixture Format

One JSON file: `tests/5.5.1/fixtures/integration.fixtures.json`

```json
[
  {
    "key": "POST|/2010-04-01/Accounts/{sid}/Messages.json|{\"Body\":\"Ahoy!\",\"From\":\"+15551234567\",\"To\":\"+15559876543\"}",
    "request": {
      "method": "POST",
      "path": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages.json",
      "params": { "To": "+15559876543", "From": "+15551234567", "Body": "Ahoy!" }
    },
    "response": { "sid": null, "status": "queued", "direction": "outbound-api" }
  }
]
```

### Key Generation

`method | path | JSON.stringify(sortedParams)` — deterministic, catches any param change.

### Contract Drift Detection

In replay mode, if no fixture matches the normalized key, the test fails with a message showing the full request details and available fixture keys.

### Recording Flow

```
npm run record:twilio-fixtures
  -> starts Prism on port 4010 (twilio_api_v2010.json OpenAPI spec)
  -> runs integration tests with TWILIO_FIXTURE_MODE=record
  -> FixtureClient proxies to Prism at http://127.0.0.1:4010
  -> writes captured pairs to fixtures JSON
  -> stops Prism
```

### Files

| File | Purpose |
|---|---|
| `tests/5.5.1/fixture-client.ts` | `FixtureClient` class (record + replay) |
| `tests/5.5.1/fixtures/integration.fixtures.json` | Committed fixture data |
| `tests/5.5.1/integration.test.ts` | Updated to use `FixtureClient` |
| `scripts/record-twilio-fixtures.ts` | Prism orchestration script |

### Test Changes

The `run()` helper swaps `createMockClient()` for `FixtureClient.forReplay(fixturesPath)`. Test logic stays identical — same AST construction, same assertions. Responses come from Prism-recorded fixtures instead of hardcoded stubs.
