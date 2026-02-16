# Default Plugin Interpreters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add default ready-to-spread interpreter exports for 10 plugins, with immediate env-var validation for env-dependent defaults.

**Architecture:** Keep all existing `createXInterpreter` factories unchanged and add new `*Interpreter` constants built from obvious runtime defaults. For env-bound SDKs, validate required env vars during module initialization and throw explicit errors when missing. Re-export all new constants from each plugin public `src/index.ts` and update API reports.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, API Extractor.

---

### Task 1: Console and Fetch defaults (no env validation)

**Files:**
- Modify: `packages/plugin-console/src/22.0.0/interpreter.ts`
- Modify: `packages/plugin-console/src/22.0.0/interpreter.ts` imports
- Modify: `packages/plugin-console/src/index.ts`
- Test: `packages/plugin-console/tests/22.0.0/interpreter.test.ts`
- Modify: `packages/plugin-fetch/src/whatwg/interpreter.ts`
- Modify: `packages/plugin-fetch/src/whatwg/interpreter.ts` imports
- Modify: `packages/plugin-fetch/src/index.ts`
- Test: `packages/plugin-fetch/tests/whatwg/interpreter.test.ts`

**Step 1: Write failing tests for new exports**

```ts
import { consoleInterpreter } from "../../src/index";
import { fetchInterpreter } from "../../src/index";

expect(consoleInterpreter["console/log"]).toBeTypeOf("function");
expect(fetchInterpreter["fetch/request"]).toBeTypeOf("function");
```

**Step 2: Run targeted tests to verify failure**

Run: `pnpm --filter @mvfm/plugin-console test -- --run tests/22.0.0/interpreter.test.ts`
Expected: FAIL (missing export)

Run: `pnpm --filter @mvfm/plugin-fetch test -- --run tests/whatwg/interpreter.test.ts`
Expected: FAIL (missing export)

**Step 3: Implement minimal defaults**

```ts
export const consoleInterpreter = createConsoleInterpreter(wrapConsole(globalThis.console));
export const fetchInterpreter = createFetchInterpreter(wrapFetch(globalThis.fetch));
```

**Step 4: Re-export from package index files**

```ts
export { createConsoleInterpreter, consoleInterpreter } from "./22.0.0/interpreter";
export { createFetchInterpreter, fetchInterpreter } from "./whatwg/interpreter";
```

**Step 5: Run targeted tests to verify pass**

Run:
- `pnpm --filter @mvfm/plugin-console test -- --run tests/22.0.0/interpreter.test.ts`
- `pnpm --filter @mvfm/plugin-fetch test -- --run tests/whatwg/interpreter.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/plugin-console/src/22.0.0/interpreter.ts packages/plugin-console/src/index.ts packages/plugin-console/tests/22.0.0/interpreter.test.ts packages/plugin-fetch/src/whatwg/interpreter.ts packages/plugin-fetch/src/index.ts packages/plugin-fetch/tests/whatwg/interpreter.test.ts
git commit -m "feat(plugins): add default console and fetch interpreters"
```

### Task 2: Pino/OpenAI/Anthropic defaults

**Files:**
- Modify: `packages/plugin-pino/src/10.3.1/interpreter.ts`
- Modify: `packages/plugin-pino/src/index.ts`
- Test: `packages/plugin-pino/tests/10.3.1/interpreter.test.ts`
- Modify: `packages/plugin-openai/src/6.21.0/interpreter.ts`
- Modify: `packages/plugin-openai/src/index.ts`
- Test: `packages/plugin-openai/tests/6.21.0/interpreter.test.ts`
- Modify: `packages/plugin-anthropic/src/0.74.0/interpreter.ts`
- Modify: `packages/plugin-anthropic/src/index.ts`
- Test: `packages/plugin-anthropic/tests/0.74.0/interpreter.test.ts`

**Step 1: Write failing tests for exported defaults**

```ts
expect(pinoInterpreter["pino/info"]).toBeTypeOf("function");
expect(openaiInterpreter["openai/create_chat_completion"]).toBeTypeOf("function");
expect(anthropicInterpreter["anthropic/create_message"]).toBeTypeOf("function");
```

**Step 2: Run targeted tests to verify failure**

Run:
- `pnpm --filter @mvfm/plugin-pino test -- --run tests/10.3.1/interpreter.test.ts`
- `pnpm --filter @mvfm/plugin-openai test -- --run tests/6.21.0/interpreter.test.ts`
- `pnpm --filter @mvfm/plugin-anthropic test -- --run tests/0.74.0/interpreter.test.ts`
Expected: FAIL (missing exports)

**Step 3: Implement defaults and re-exports**

```ts
export const pinoInterpreter = createPinoInterpreter(wrapPino(pino()));
export const openaiInterpreter = createOpenAIInterpreter(wrapOpenAISdk(new OpenAI()));
export const anthropicInterpreter = createAnthropicInterpreter(wrapAnthropicSdk(new Anthropic()));
```

**Step 4: Add public exports in `src/index.ts`**

```ts
export { createPinoInterpreter, pinoInterpreter } from "./10.3.1/interpreter";
export { createOpenAIInterpreter, openaiInterpreter } from "./6.21.0/interpreter";
export { createAnthropicInterpreter, anthropicInterpreter } from "./0.74.0/interpreter";
```

**Step 5: Run targeted tests to verify pass**

Run the three commands from Step 2.
Expected: PASS

**Step 6: Commit**

```bash
git add packages/plugin-pino/src/10.3.1/interpreter.ts packages/plugin-pino/src/index.ts packages/plugin-pino/tests/10.3.1/interpreter.test.ts packages/plugin-openai/src/6.21.0/interpreter.ts packages/plugin-openai/src/index.ts packages/plugin-openai/tests/6.21.0/interpreter.test.ts packages/plugin-anthropic/src/0.74.0/interpreter.ts packages/plugin-anthropic/src/index.ts packages/plugin-anthropic/tests/0.74.0/interpreter.test.ts
git commit -m "feat(plugins): add default pino, openai, and anthropic interpreters"
```

### Task 3: Env-validated defaults for Stripe/Slack/Twilio/Resend/Fal

**Files:**
- Modify: `packages/plugin-stripe/src/2025-04-30.basil/interpreter.ts`
- Modify: `packages/plugin-stripe/src/index.ts`
- Test: `packages/plugin-stripe/tests/2025-04-30.basil/interpreter.test.ts`
- Modify: `packages/plugin-slack/src/7.14.0/interpreter.ts`
- Modify: `packages/plugin-slack/src/index.ts`
- Test: `packages/plugin-slack/tests/7.14.0/interpreter.test.ts`
- Modify: `packages/plugin-twilio/src/5.5.1/interpreter.ts`
- Modify: `packages/plugin-twilio/src/index.ts`
- Test: `packages/plugin-twilio/tests/5.5.1/interpreter.test.ts`
- Modify: `packages/plugin-resend/src/6.9.2/interpreter.ts`
- Modify: `packages/plugin-resend/src/index.ts`
- Test: `packages/plugin-resend/tests/6.9.2/interpreter.test.ts`
- Modify: `packages/plugin-fal/src/1.9.1/interpreter.ts`
- Modify: `packages/plugin-fal/src/index.ts`
- Test: `packages/plugin-fal/tests/1.9.1/interpreter.test.ts`

**Step 1: Add failing env validation tests**

```ts
vi.stubEnv("STRIPE_API_KEY", "");
await expect(import("../../src/index")).rejects.toThrow(/STRIPE_API_KEY/);
```

Repeat with:
- `SLACK_BOT_TOKEN`
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`
- `RESEND_API_KEY`
- `FAL_KEY`

Also add success-path assertion with env var(s) present and default export shape available.

**Step 2: Run targeted tests to verify failure**

Run:
- `pnpm --filter @mvfm/plugin-stripe test -- --run tests/2025-04-30.basil/interpreter.test.ts`
- `pnpm --filter @mvfm/plugin-slack test -- --run tests/7.14.0/interpreter.test.ts`
- `pnpm --filter @mvfm/plugin-twilio test -- --run tests/5.5.1/interpreter.test.ts`
- `pnpm --filter @mvfm/plugin-resend test -- --run tests/6.9.2/interpreter.test.ts`
- `pnpm --filter @mvfm/plugin-fal test -- --run tests/1.9.1/interpreter.test.ts`
Expected: FAIL before implementation

**Step 3: Add env helpers in each interpreter module**

```ts
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`@mvfm/plugin-stripe: missing ${name}. Set ${name} or use createStripeInterpreter(...)`);
  }
  return value;
}
```

Use plugin-specific messages and factory names.

**Step 4: Implement default constants**

```ts
export const stripeInterpreter = createStripeInterpreter(
  wrapStripeSdk(new Stripe(requiredEnv("STRIPE_API_KEY"))),
);
```

Do equivalent for `slackInterpreter`, `twilioInterpreter`, `resendInterpreter`, and `falInterpreter` using each plugin’s SDK wrapper.

**Step 5: Re-export from package indices**

```ts
export { createStripeInterpreter, stripeInterpreter } from "./2025-04-30.basil/interpreter";
```

Do equivalent for slack, twilio, resend, fal.

**Step 6: Run targeted tests to verify pass**

Run the five commands from Step 2.
Expected: PASS

**Step 7: Commit**

```bash
git add packages/plugin-stripe/src/2025-04-30.basil/interpreter.ts packages/plugin-stripe/src/index.ts packages/plugin-stripe/tests/2025-04-30.basil/interpreter.test.ts packages/plugin-slack/src/7.14.0/interpreter.ts packages/plugin-slack/src/index.ts packages/plugin-slack/tests/7.14.0/interpreter.test.ts packages/plugin-twilio/src/5.5.1/interpreter.ts packages/plugin-twilio/src/index.ts packages/plugin-twilio/tests/5.5.1/interpreter.test.ts packages/plugin-resend/src/6.9.2/interpreter.ts packages/plugin-resend/src/index.ts packages/plugin-resend/tests/6.9.2/interpreter.test.ts packages/plugin-fal/src/1.9.1/interpreter.ts packages/plugin-fal/src/index.ts packages/plugin-fal/tests/1.9.1/interpreter.test.ts
git commit -m "feat(plugins): add env-validated default sdk interpreters"
```

### Task 4: API report updates and workspace verification

**Files:**
- Modify: `packages/plugin-console/etc/plugin-console.api.md`
- Modify: `packages/plugin-console/etc/plugin-console.api.json`
- Modify: `packages/plugin-fetch/etc/plugin-fetch.api.md`
- Modify: `packages/plugin-fetch/etc/plugin-fetch.api.json`
- Modify: `packages/plugin-pino/etc/plugin-pino.api.md`
- Modify: `packages/plugin-pino/etc/plugin-pino.api.json`
- Modify: `packages/plugin-openai/etc/plugin-openai.api.md`
- Modify: `packages/plugin-openai/etc/plugin-openai.api.json`
- Modify: `packages/plugin-anthropic/etc/plugin-anthropic.api.md`
- Modify: `packages/plugin-anthropic/etc/plugin-anthropic.api.json`
- Modify: `packages/plugin-stripe/etc/plugin-stripe.api.md`
- Modify: `packages/plugin-stripe/etc/plugin-stripe.api.json`
- Modify: `packages/plugin-slack/etc/plugin-slack.api.md`
- Modify: `packages/plugin-slack/etc/plugin-slack.api.json`
- Modify: `packages/plugin-twilio/etc/plugin-twilio.api.md`
- Modify: `packages/plugin-twilio/etc/plugin-twilio.api.json`
- Modify: `packages/plugin-resend/etc/plugin-resend.api.md`
- Modify: `packages/plugin-resend/etc/plugin-resend.api.json`
- Modify: `packages/plugin-fal/etc/plugin-fal.api.md`
- Modify: `packages/plugin-fal/etc/plugin-fal.api.json`

**Step 1: Regenerate API reports**

Run: `pnpm -r --filter @mvfm/plugin-{console,fetch,pino,openai,anthropic,stripe,slack,twilio,resend,fal} run check`
Expected: API report files updated for new exports

**Step 2: Run required repo verification commands**

Run:
- `pnpm run build`
- `pnpm run check`
- `pnpm run test`
Expected: all pass (or document pre-existing failures with evidence)

**Step 3: Commit verification updates**

```bash
git add packages/plugin-*/etc/*.api.md packages/plugin-*/etc/*.api.json
git commit -m "chore(plugins): update api reports for default interpreter exports"
```

### Task 5: PR preparation

**Files:**
- Modify: `docs/plans/2026-02-16-default-plugin-interpreters-implementation-plan.md` (if execution notes are added)

**Step 1: Summarize validation evidence for PR body**

Collect exact command outputs for:
- `pnpm run build`
- `pnpm run check`
- `pnpm run test`

**Step 2: Draft PR body**

Include:
- `Closes #203`
- What this does (2-3 sentences)
- Design alignment (VISION §1 DX)
- Validation performed with command evidence

**Step 3: Commit any final doc touch-ups**

```bash
git add docs/plans/2026-02-16-default-plugin-interpreters-implementation-plan.md
git commit -m "docs: finalize issue-203 implementation plan notes"
```
