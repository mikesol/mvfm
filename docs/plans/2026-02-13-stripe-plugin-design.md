# Stripe Plugin Design

## Overview

Stripe plugin for mvfm following the postgres reference implementation pattern: AST builder, generator-based interpreter, server handler (wrapping official Stripe SDK), client handler (HTTP proxy), and stripe-mock integration tests.

**Issue:** #39
**API version:** 2025-04-30.basil
**Directory:** `src/plugins/stripe/2025-04-30.basil/`

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Plugin definition + AST builder. Exposes `StripeMethods` on `$` |
| `interpreter.ts` | Generator-based interpreter fragment. Yields `stripe/api_call` effects |
| `handler.server.ts` | Server handler wrapping `StripeClient` interface |
| `handler.client.ts` | Client handler proxying effects through user's backend |
| `client-stripe-sdk.ts` | Adapter wrapping official `stripe` npm package into `StripeClient` |

## API Surface

Three resource types, 10 operations total:

```typescript
interface StripeMethods {
  stripe: {
    paymentIntents: {
      create(params: Expr<CreatePaymentIntentParams> | CreatePaymentIntentParams): Expr<PaymentIntent>;
      retrieve(id: Expr<string> | string): Expr<PaymentIntent>;
      confirm(id: Expr<string> | string, params?: Expr<ConfirmPaymentIntentParams> | ConfirmPaymentIntentParams): Expr<PaymentIntent>;
    };
    customers: {
      create(params: Expr<CreateCustomerParams> | CreateCustomerParams): Expr<Customer>;
      retrieve(id: Expr<string> | string): Expr<Customer>;
      update(id: Expr<string> | string, params: Expr<UpdateCustomerParams> | UpdateCustomerParams): Expr<Customer>;
      list(params?: Expr<ListCustomersParams> | ListCustomersParams): Expr<CustomerList>;
    };
    charges: {
      create(params: Expr<CreateChargeParams> | CreateChargeParams): Expr<Charge>;
      retrieve(id: Expr<string> | string): Expr<Charge>;
      list(params?: Expr<ListChargesParams> | ListChargesParams): Expr<ChargeList>;
    };
  };
}
```

## Node Kinds

All namespaced `stripe/`:

- `stripe/create_payment_intent`
- `stripe/retrieve_payment_intent`
- `stripe/confirm_payment_intent`
- `stripe/create_customer`
- `stripe/retrieve_customer`
- `stripe/update_customer`
- `stripe/list_customers`
- `stripe/create_charge`
- `stripe/retrieve_charge`
- `stripe/list_charges`

## Interpreter Pattern

All 10 operations yield a uniform `stripe/api_call` effect:

```typescript
export const stripeInterpreter: InterpreterFragment = {
  pluginName: "stripe",
  canHandle: (node) => node.kind.startsWith("stripe/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "stripe/create_payment_intent": {
        const params = yield { type: "recurse", child: node.params };
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: "/v1/payment_intents",
          params,
        };
      }
      case "stripe/retrieve_payment_intent": {
        const id = yield { type: "recurse", child: node.id };
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: `/v1/payment_intents/${id}`,
          params: undefined,
        };
      }
      // ... same pattern for all 10 operations
    }
  },
};
```

The interpreter is a const (not a factory) — it has no dependency on the Stripe SDK. All IO goes through yielded effects.

## StripeClient Interface

```typescript
export interface StripeClient {
  request(method: string, path: string, params?: Record<string, unknown>): Promise<unknown>;
}
```

Single method — Stripe's API is uniform request-response. No transactions, cursors, or nested evaluation (unlike postgres). This makes the handler trivially simple.

## Server Handler

Wraps a `StripeClient`, delegates `stripe/api_call` effects:

```typescript
export function serverHandler(client: StripeClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "stripe/api_call") {
      const { method, path, params } = effect;
      const value = await client.request(method, path, params);
      return { value, state };
    }
    throw new Error(`Unhandled effect: ${effect.type}`);
  };
}
```

No `buildEvaluate` complexity — every Stripe operation is a single API call with no nested AST evaluation.

## Client Handler

Identical to postgres client handler — sends effects as JSON to `{baseUrl}/mvfm/execute`:

```typescript
export function clientHandler(options: ClientHandlerOptions): StepHandler<ClientHandlerState> {
  // Same pattern as postgres/3.4.8/handler.client.ts
}
```

## SDK Adapter

Wraps the official `stripe` npm package:

```typescript
import Stripe from "stripe";

export function wrapStripeSdk(stripe: Stripe): StripeClient {
  return {
    async request(method, path, params) {
      // Use stripe.raw API or resource methods
      // Map path + method to the appropriate SDK call
    },
  };
}
```

## Param Types (Subset)

Stripe parameters are deeply nested objects. We model the commonly-used fields, not the full API surface:

```typescript
interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  customer?: string;
  payment_method?: string;
  metadata?: Record<string, string>;
}

interface CreateCustomerParams {
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}

// etc.
```

Users can always pass `Record<string, unknown>` for fields we don't model — the AST just carries whatever they give us.

## Testing Strategy

**stripe-mock** Docker container via testcontainers (mirrors postgres approach):

1. **AST parity tests** — verify node shapes for all 10 operations
2. **Interpreter + server handler** — run against stripe-mock for real HTTP
3. **Composition tests** — stripe + error (API error handling), stripe + fiber (parallel calls)
4. **Round-trip tests** — AST serialization/deserialization

stripe-mock provides a local Stripe API that accepts any valid request shape and returns realistic fixtures. No real API key needed.

## Key Differences from Postgres

| Aspect | Postgres | Stripe |
|--------|----------|--------|
| Effect types | 4 (query, begin, savepoint, cursor) | 1 (api_call) |
| Nested evaluation | Yes (transactions, cursor body) | No |
| Shared cache complexity | High (taint tracking, cursor reuse) | None needed |
| Client interface | 4 methods (query, begin, savepoint, cursor) | 1 method (request) |
| Server handler | ~150 lines with buildEvaluate | ~20 lines |

Stripe is fundamentally simpler because it's request-response with no nested scoping.

## Honest Assessment

What works well:
- Simple CRUD operations (create customer, retrieve payment intent) map 1:1
- Proxy chains capture dependencies (create customer → use customer ID in charge)
- Error handling via error plugin ($.try wrapping API calls)
- Parallel API calls via fiber plugin ($.par)

What's different:
- No webhook handling (out of scope per issue)
- List pagination requires explicit params (no auto-pagination)
- Deeply nested Stripe params are passed as plain objects, not individually proxied

What doesn't work:
- Streaming responses (not applicable to these endpoints)
- Idempotency keys (could be added as a header param on api_call effect later)
