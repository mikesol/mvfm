# Typed Messaging Node Registration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add typed node interfaces and `NodeTypeMap` registrations for slack, resend, and twilio plugin node kinds, and enforce them via `typedInterpreter`.

**Architecture:** Keep typed node interfaces colocated with plugin interpreter modules for now, matching existing plugin patterns from core/redis/postgres migrations. Each plugin interpreter will define node interfaces, augment `@mvfm/core` `NodeTypeMap`, and use `typedInterpreter` over the full kind union. Compile-time tests will assert the new kinds are strongly typed.

**Tech Stack:** TypeScript, pnpm workspace, `@mvfm/core` `typedInterpreter`, declaration merging.

---

### Task 1: Add typed slack nodes and NodeTypeMap augmentation

**Files:**
- Modify: `packages/plugin-slack/src/7.14.0/interpreter.ts`
- Test: `packages/plugin-slack/tests/7.14.0/interpreter.test.ts`

**Step 1: Write the failing test**

Add or extend a compile-time assertion test in Slack tests that requires typed handler signatures for at least one Slack kind through `typedInterpreter`.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mvfm/plugin-slack test`
Expected: FAIL on missing type registration / type mismatch expectation.

**Step 3: Write minimal implementation**

In `interpreter.ts`, define typed interfaces for all Slack listed kinds, add `declare module "@mvfm/core" { interface NodeTypeMap { ... } }`, and switch interpreter construction to `typedInterpreter<SlackKinds>()({...})`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @mvfm/plugin-slack test`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/plugin-slack/src/7.14.0/interpreter.ts packages/plugin-slack/tests/7.14.0/interpreter.test.ts
git commit -m "feat(slack): type node kinds and register NodeTypeMap"
```

### Task 2: Add typed resend nodes and NodeTypeMap augmentation

**Files:**
- Modify: `packages/plugin-resend/src/6.9.2/interpreter.ts`
- Test: `packages/plugin-resend/tests/6.9.2/interpreter.test.ts`

**Step 1: Write the failing test**

Add or extend compile-time assertions to require typed handler signatures for Resend kinds.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mvfm/plugin-resend test`
Expected: FAIL before implementation.

**Step 3: Write minimal implementation**

Add typed node interfaces for listed Resend kinds, augment `NodeTypeMap`, and use `typedInterpreter<ResendKinds>()({...})`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @mvfm/plugin-resend test`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/plugin-resend/src/6.9.2/interpreter.ts packages/plugin-resend/tests/6.9.2/interpreter.test.ts
git commit -m "feat(resend): type node kinds and register NodeTypeMap"
```

### Task 3: Add typed twilio nodes and NodeTypeMap augmentation

**Files:**
- Modify: `packages/plugin-twilio/src/5.5.1/interpreter.ts`
- Test: `packages/plugin-twilio/tests/5.5.1/interpreter.test.ts`

**Step 1: Write the failing test**

Add or extend compile-time assertions for typed Twilio handler signatures.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mvfm/plugin-twilio test`
Expected: FAIL before implementation.

**Step 3: Write minimal implementation**

Add typed node interfaces for listed Twilio kinds, augment `NodeTypeMap`, and use `typedInterpreter<TwilioKinds>()({...})`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @mvfm/plugin-twilio test`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/plugin-twilio/src/5.5.1/interpreter.ts packages/plugin-twilio/tests/5.5.1/interpreter.test.ts
git commit -m "feat(twilio): type node kinds and register NodeTypeMap"
```

### Task 4: Global verification and file-size guard

**Files:**
- Modify if needed: any interpreter file exceeding limit

**Step 1: Run targeted checks**

Run: `pnpm --filter @mvfm/plugin-slack test && pnpm --filter @mvfm/plugin-resend test && pnpm --filter @mvfm/plugin-twilio test`
Expected: PASS.

**Step 2: Run repo verification required by project**

Run: `pnpm run build && pnpm run check && pnpm run test`
Expected: PASS.

**Step 3: Enforce file-size rule**

Run: `wc -l packages/plugin-slack/src/7.14.0/interpreter.ts packages/plugin-resend/src/6.9.2/interpreter.ts packages/plugin-twilio/src/5.5.1/interpreter.ts`
Expected: each file <= 300 lines.

**Step 4: Commit final adjustments**

```bash
git add -A
git commit -m "test: enforce typed interpreter coverage for messaging plugins"
```
