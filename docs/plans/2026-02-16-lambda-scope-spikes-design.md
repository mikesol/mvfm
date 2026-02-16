# Lambda Scope Spikes Design Findings

## Context
Issue #195 asks whether lambda application can become immutable and lexically correct (param identity-based), replacing clone + inject mutation.

## Spike Implementations
The following three designs were spiked in test-only runtime prototypes:

- `A: recurse_scoped effect`
  - Evaluator adds an internal scoped recursion effect carrying temporary bindings.
  - Plugin handlers apply lambdas by yielding `recurse_scoped`.
- `B: core/apply_lambda node`
  - Lambda application becomes an explicit core AST node.
  - Plugins emit/apply that node; evaluator handles node semantics.
- `C: env-aware contract`
  - Interpreter contract is env-explicit (`eval(node, env)` model).
  - Lambda application extends env directly.

Code references:
- `packages/core/tests/interpreters/lambda-scope-spikes-a-b.ts`
- `packages/core/tests/interpreters/lambda-scope-spikes-c.ts`
- `packages/core/tests/interpreters/lambda-scope-spikes.test.ts`

## Correctness Results
All three spikes passed the same regression scenarios:

1. Lexical shadowing with same param name but different param identities
2. Repeated lambda invocation over shared body with stable-subnode cache reuse
3. Error catch-lambda binding semantics

Test command and result:
- `pnpm --filter @mvfm/core test -- tests/interpreters/lambda-scope-spikes.test.ts`
- Passed (`9/9` spike tests)

## Comparison

### A: recurse_scoped effect
- Correctness: Strong
- Elegance: Good, but introduces a new evaluator-level effect kind
- Plugin churn: Moderate (only lambda-application callsites)
- DX impact: Low to moderate; adds one new internal yield pattern
- Risk: Medium (new effect path in fold/trampoline)

### B: core/apply_lambda node
- Correctness: Strong
- Elegance: Medium to high; lambda application is explicit in AST
- Plugin churn: Moderate (callsites construct `core/apply_lambda`)
- DX impact: Moderate; adds a new core node kind and docs surface
- Risk: Medium (core AST surface change)

### C: env-aware contract
- Correctness: Strong
- Elegance: Highest (scope is explicit in interpreter model)
- Plugin churn: High (interpreter contract change across all handlers)
- DX impact: High (every interpreter author sees the new contract)
- Risk: High (broad migration and ecosystem disturbance)

## Recommendation
If priority is architectural elegance + correctness with bounded ecosystem disruption, choose **A (`recurse_scoped`)**.

Rationale:
- Preserves current plugin contract shape (generator handlers) and avoids global contract migration.
- Eliminates clone + mutation at lambda-application sites.
- Achieves lexical correctness with param identity bindings.
- Keeps blast radius mostly inside fold/core + four known lambda callsites.

If the project is willing to accept broad migration cost for maximal conceptual purity, **C** is the cleanest long-term model.

## Proposed Next Step
Build a production-grade A implementation in `packages/core/src/fold.ts` + `packages/core/src/interpreters/core.ts`, migrate `fiber/error/zod` callsites, and add regression tests mirroring this spike harness.
