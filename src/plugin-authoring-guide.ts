// ============================================================
// HOW TO WRITE A ILO PLUGIN
// ============================================================
//
// This file is both documentation and a working example.
// A plugin is a PluginDefinition<T> where T describes
// what it adds to $.
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "./core";

// ---- Step 1: Define your type interface -------------------
//
// This is what $ gains when your plugin is included.
// Keep it flat or nest under a namespace — your call.

// NOTE: A full, production-quality Stripe plugin now exists at
// src/plugins/stripe/2025-04-30.basil/. This example below is
// simplified for illustration. See the real plugin for the complete
// pattern including generator interpreter, server/client handlers,
// and SDK adapter.

export interface StripeMethods {
  stripe: {
    charge(
      amount: Expr<number> | number,
      currency: Expr<string> | string,
      customerId: Expr<string> | string,
    ): Expr<{ id: string; status: string }>;
    refund(chargeId: Expr<string> | string): Expr<{ id: string; status: string }>;
    getCustomer(id: Expr<string> | string): Expr<Record<string, unknown>>;
  };
}

// ---- Step 2: Define your plugin ---------------------------
//
// Three things:
//   name       — unique string, used as namespace prefix
//   nodeKinds  — all AST node kinds you'll emit
//   build(ctx) — returns the methods that go on $
//
// The PluginContext gives you:
//   ctx.expr<T>(node)  — wrap an AST node as Expr<T>
//   ctx.lift(value)    — auto-lift raw JS to Expr
//   ctx.isExpr(value)  — check if already an Expr
//   ctx.emit(node)     — add a statement-level node
//   ctx.statements     — the current statement list

export function stripe(config: { publishableKey?: string }): PluginDefinition<StripeMethods> {
  // Config is captured in the closure — it'll be baked
  // into the AST nodes so the interpreter knows how
  // to execute them.

  return {
    name: "stripe",
    nodeKinds: ["stripe/charge", "stripe/refund", "stripe/getCustomer"],

    build(ctx: PluginContext): StripeMethods {
      return {
        stripe: {
          charge(amount, currency, customerId) {
            // ctx.lift() handles the "is this already an Expr
            // or a raw value?" question for you.
            return ctx.expr({
              kind: "stripe/charge",
              amount: ctx.lift(amount).__node,
              currency: ctx.lift(currency).__node,
              customerId: ctx.lift(customerId).__node,
              config,
            });
          },

          refund(chargeId) {
            return ctx.expr({
              kind: "stripe/refund",
              chargeId: ctx.lift(chargeId).__node,
              config,
            });
          },

          getCustomer(id) {
            return ctx.expr({
              kind: "stripe/getCustomer",
              customerId: ctx.lift(id).__node,
              config,
            });
          },
        },
      };
    },
  };
}

// ---- Step 3: (Optional) Write an interpreter fragment -----
//
// If you want your plugin to be executable (not just
// AST-producing), provide an interpreter fragment.
//
// Interpreter fragments use generators. Yield a "recurse" effect
// to evaluate a child node; yield other effects for IO (handled
// externally by foldAST/runAST).

import type { ASTNode, InterpreterFragment, StepEffect } from "./core";

export function stripeInterpreter(_secretKey: string): InterpreterFragment {
  return {
    pluginName: "stripe",
    canHandle: (node) => node.kind.startsWith("stripe/"),
    *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
      switch (node.kind) {
        case "stripe/charge": {
          // Yield recurse effects to evaluate sub-expressions first.
          const amount = yield { type: "recurse", child: node.amount as ASTNode };
          const currency = yield { type: "recurse", child: node.currency as ASTNode };
          const customerId = yield { type: "recurse", child: node.customerId as ASTNode };
          return {
            _interpreterNote: "would call Stripe API",
            amount,
            currency,
            customerId,
          };
        }
        case "stripe/refund": {
          const chargeId = yield { type: "recurse", child: node.chargeId as ASTNode };
          return { _interpreterNote: "would refund", chargeId };
        }
        case "stripe/getCustomer": {
          const customerId = yield { type: "recurse", child: node.customerId as ASTNode };
          return { _interpreterNote: "would fetch customer", customerId };
        }
        default:
          throw new Error(`Unknown stripe node kind: ${node.kind}`);
      }
    },
  };
}

// ---- Step 4: Use it! --------------------------------------
//
// import { ilo, num, str, postgres } from 'ilo'
// import { stripe } from './my-stripe-plugin'
//
// const checkout = ilo(num, str, postgres('postgres://...'), stripe({ publishableKey: 'pk_...' }))
//
// const processPayment = checkout(($) => {
//   const order = $.sql`select * from orders where id = ${$.input.orderId}`
//   const charge = $.stripe.charge(order[0].total, 'usd', order[0].customerId)
//   return $.do(
//     $.sql`update orders set charge_id = ${charge.id} where id = ${order[0].id}`,
//     charge
//   )
// })

// ---- Plugin Design Guidelines -----------------------------
//
// 1. NAMESPACE YOUR NODE KINDS
//    Always prefix with your plugin name: "stripe/charge"
//    not "charge". This prevents collisions.
//
// 2. ACCEPT Expr<T> | T FOR ALL PARAMETERS
//    Users should be able to pass raw values or computed
//    expressions. Use ctx.lift() to normalize.
//
// 3. INCLUDE CONFIG IN AST NODES
//    The interpreter needs to know how to connect to your
//    service. Bake config into the node so the AST is
//    self-contained.
//
// 4. KEEP METHODS PURE (AST-BUILDING ONLY)
//    Your build() methods must not perform side effects.
//    They only construct AST nodes. Side effects happen
//    in the interpreter.
//
// 5. RETURN Expr<T> WITH ACCURATE TYPES
//    The phantom type T flows through to the user's code
//    via proxy property access. Get it right and users
//    get autocomplete on the results of your operations.
//
// 6. DOCUMENT YOUR NODE SCHEMA
//    Other people will write interpreters for your nodes.
//    Make the schema obvious from the nodeKinds list and
//    the structure of nodes you emit.
//
// 7. SHIP AN INTERPRETER FRAGMENT
//    If your plugin has effects (DB calls, API calls),
//    ship both the AST plugin and an interpreter fragment
//    so users can actually run programs that use it.
