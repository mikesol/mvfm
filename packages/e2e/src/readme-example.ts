/**
 * Verified README example.
 *
 * This file contains the exact code shown in the project README.
 * The e2e test imports and exercises it against real services.
 * If this file doesn't compile or its tests fail, the README is lying.
 */

import { mvfm, prelude, error, fold, defaults, injectInput } from "@mvfm/core";
import { openai } from "@mvfm/plugin-openai";
import { postgres } from "@mvfm/plugin-postgres";
import { stripe } from "@mvfm/plugin-stripe";
import type { Interpreter } from "@mvfm/core";

// -- Block 1: Program construction ------------------------------------------

export const app = mvfm(
  prelude,
  error,
  openai,
  postgres,
  stripe,
);

export const handlePrompt = app(
  { userId: "string", prompt: "string", paymentMethodId: "string" },
  ($ : any) => {
    const rows = $.sql`SELECT credits FROM users WHERE id = ${$.input.userId}`;
    const credits = rows[0].credits;
    return $.begin(
      $.guard($.gt(credits, 0), "no credits remaining"),
      $.sql`UPDATE users SET credits = credits - 1 WHERE id = ${$.input.userId}`,
      $.stripe.paymentIntents.create({
        amount: 500,
        currency: "usd",
        payment_method: $.input.paymentMethodId,
        confirm: true,
      }),
      $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: $.input.prompt }],
      }),
    );
  },
);

// -- Block 2: Interpretation helper -----------------------------------------

export async function runExample(
  interpreters: {
    postgres: Interpreter;
    openai: Interpreter;
    stripe: Interpreter;
  },
  input: { userId: string; prompt: string; paymentMethodId: string },
) {
  return await fold(
    defaults(app, interpreters),
    injectInput(handlePrompt, input),
  );
}
