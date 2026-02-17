# Issue 215 Typed Node Interfaces Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add typed node interfaces and `NodeTypeMap` registrations for stripe, pino, fal, and console interpreter kinds, then migrate these interpreters to `typedInterpreter`.

**Architecture:** Keep type declarations colocated in each plugin `interpreter.ts`, matching current plugin-emitted node object shapes. Replace loose `Interpreter` maps with `typedInterpreter<...>()({...})` to enforce handler/node alignment at compile time without changing runtime behavior.

**Tech Stack:** TypeScript, pnpm workspace, Vitest, Biome, @mvfm/core `typedInterpreter` + module augmentation.

---

### Task 1: Stripe typed nodes + typed interpreter

**Files:**
- Modify: `packages/plugin-stripe/src/2025-04-30.basil/interpreter.ts`
- Test: `packages/plugin-stripe/tests/2025-04-30.basil/interpreter.test.ts`

**Step 1: Add failing type expectation context**

Run: `pnpm --filter @mvfm/plugin-stripe run build`
Expected: currently passes with broad `StripeNode`.

**Step 2: Define typed node interfaces + NodeTypeMap augmentation**

Add one interface per stripe kind and register each in:
```ts
declare module "@mvfm/core" {
  interface NodeTypeMap {
    "stripe/create_payment_intent": StripeCreatePaymentIntentNode;
    // ...remaining stripe kinds...
  }
}
```

**Step 3: Convert interpreter to typedInterpreter**

Replace `createStripeInterpreter(...): Interpreter` map literal with:
```ts
return typedInterpreter<
  | "stripe/create_payment_intent"
  | "stripe/retrieve_payment_intent"
  | "stripe/confirm_payment_intent"
  | "stripe/create_customer"
  | "stripe/retrieve_customer"
  | "stripe/update_customer"
  | "stripe/list_customers"
  | "stripe/create_charge"
  | "stripe/retrieve_charge"
  | "stripe/list_charges"
>()({ /* handlers */ });
```

**Step 4: Run targeted build/tests**

Run:
- `pnpm --filter @mvfm/plugin-stripe run build`
- `pnpm --filter @mvfm/plugin-stripe run test`
Expected: pass.

**Step 5: Commit**

```bash
git add packages/plugin-stripe/src/2025-04-30.basil/interpreter.ts
git commit -m "feat(plugin-stripe): type and register stripe node kinds"
```

### Task 2: Pino typed nodes + typed interpreter

**Files:**
- Modify: `packages/plugin-pino/src/10.3.1/interpreter.ts`
- Test: `packages/plugin-pino/tests/10.3.1/interpreter.test.ts`

**Step 1: Add typed interfaces and NodeTypeMap entries**

Define level-specific node interfaces (`trace`/`debug`/`info`/`warn`/`error`/`fatal`) and register each `pino/*` kind in `NodeTypeMap`.

**Step 2: Use typedInterpreter with explicit pino kind union**

Keep the shared handler implementation; narrow parameter type to the pino node union so `level`, `msg`, `mergeObject`, `bindings` stay type-checked.

**Step 3: Validate package**

Run:
- `pnpm --filter @mvfm/plugin-pino run build`
- `pnpm --filter @mvfm/plugin-pino run test`
Expected: pass.

**Step 4: Commit**

```bash
git add packages/plugin-pino/src/10.3.1/interpreter.ts
git commit -m "feat(plugin-pino): type and register pino node kinds"
```

### Task 3: Fal typed nodes + typed interpreter

**Files:**
- Modify: `packages/plugin-fal/src/1.9.1/interpreter.ts`
- Test: `packages/plugin-fal/tests/1.9.1/interpreter.test.ts`

**Step 1: Add typed interfaces and NodeTypeMap entries**

Add six fal node interfaces (`run`, `subscribe`, `queue_submit`, `queue_status`, `queue_result`, `queue_cancel`) and register them in `NodeTypeMap`.

**Step 2: Convert interpreter map to typedInterpreter**

Use explicit fal kind union and keep existing handler behavior unchanged.

**Step 3: Validate package**

Run:
- `pnpm --filter @mvfm/plugin-fal run build`
- `pnpm --filter @mvfm/plugin-fal run test`
Expected: pass.

**Step 4: Commit**

```bash
git add packages/plugin-fal/src/1.9.1/interpreter.ts
git commit -m "feat(plugin-fal): type and register fal node kinds"
```

### Task 4: Console typed nodes + typed interpreter

**Files:**
- Modify: `packages/plugin-console/src/22.0.0/interpreter.ts`
- Test: `packages/plugin-console/tests/22.0.0/interpreter.test.ts`

**Step 1: Add typed interfaces and NodeTypeMap entries**

Add one interface per `console/*` kind listed in issue #215; register all in `NodeTypeMap`.

**Step 2: Convert map to typedInterpreter**

Retain shared handler that derives method from kind, but use typed node union + typed kind union for compile-time enforcement.

**Step 3: Validate package**

Run:
- `pnpm --filter @mvfm/plugin-console run build`
- `pnpm --filter @mvfm/plugin-console run test`
Expected: pass.

**Step 4: Commit**

```bash
git add packages/plugin-console/src/22.0.0/interpreter.ts
git commit -m "feat(plugin-console): type and register console node kinds"
```

### Task 5: Full verification and integration commit

**Files:**
- Modify (if needed): any failing tests in touched plugin test files only

**Step 1: Run required verification suite**

Run:
- `pnpm build`
- `pnpm check`
- `pnpm test`
Expected: all pass.

**Step 2: Prepare final combined commit (if per-task commits were skipped)**

```bash
git add packages/plugin-stripe/src/2025-04-30.basil/interpreter.ts \
        packages/plugin-pino/src/10.3.1/interpreter.ts \
        packages/plugin-fal/src/1.9.1/interpreter.ts \
        packages/plugin-console/src/22.0.0/interpreter.ts \
        docs/plans/2026-02-17-issue-215-typed-node-interfaces-implementation-plan.md
git commit -m "feat: type and register node kinds for stripe pino fal console"
```

**Step 3: Open PR**

Run: `gh pr create`

PR body must include:
- `Closes #215`
- What this does
- Design alignment
- Validation performed with command evidence
