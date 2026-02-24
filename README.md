# mvfm

Typescript reimplemented in Typescript.

## Motivation

When the Typescript compiler compiles a program, it represents it as an Abstract Syntax Tree (AST). Manipulating the tree itself is traditionally called metaprogramming.

In languages like `nim` and `haxe`, metaprogramming is a first-class citizen. They offer an expressive macro system that allows you to rewrite programs at compile time. `lisp` takes this concept even farther, treating programs as data.

`mvfm` follows the `lisp` philosophy, but with types and using a syntax that resembles traditional Typescript. The result is that you can separate a program's construction, manipulation, and interpretation in-code with minimal fuss.

## A Short Example

Here's what a typical `mvfm` program looks like.

```typescript
import { mvfm, prelude, error, st, fold, defaults, injectInput } from "@mvfm/core";
import { openai } from "@mvfm/plugin-openai";
import { postgres } from "@mvfm/plugin-postgres";
import { stripe } from "@mvfm/plugin-stripe";

const app = mvfm(prelude, st, error, openai(), postgres(), stripe());

const handlePrompt = app(
  { userId: "string", prompt: "string", paymentMethodId: "string" },
  ($) => {
    // look up the user's remaining credits
    const rows = $.sql`SELECT credits FROM users WHERE id = ${$.input.userId}`;
    const credits = $.let(0);
    $.each([rows], (row) => {
      credits.set(row);
    });

    // bail if they're out
    $.try($.guard($.gt(credits.get(), 0), "no credits remaining")).catch(
      (err) => $.fail(err),
    );

    // call openai
    const completion = $.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: $.input.prompt }],
    });

    // deduct one credit
    $.sql`UPDATE users SET credits = credits - 1 WHERE id = ${$.input.userId}`;

    // charge via stripe
    $.stripe.paymentIntents.create({
      amount: 500,
      currency: "usd",
      payment_method: $.input.paymentMethodId,
      confirm: true,
    });

    return completion;
  },
);
```

To interpret this program, you construct a gaggle of interpreters that interpret it.

```typescript
import pgClient from "postgres";
import { wrapPostgresJs, createPostgresServerInterpreter } from "@mvfm/plugin-postgres";

const pg = pgClient(process.env.DATABASE_URL!);

const result = await fold(
  defaults(app, {
    postgres: createPostgresServerInterpreter(wrapPostgresJs(pg)),
  }),
  injectInput(handlePrompt, {
    userId: "usr_abc123",
    prompt: "Explain monads like I'm five",
    paymentMethodId: "pm_card_visa",
  }),
);
```

Those are the default interpreters, but writing your own is quite straightforward. This is useful for mocking, program splitting, debugging, and basically everything you need to do that is not just running the program. Of course, it is equally good at just running the program.

## Why

To be honest, I don't know. It just seemed like a cool thing to try out. Perhaps someone will find it useful.

100% of the code in this repo is LLM generated, so a big part of what I want to explore is "Can an LLM boil the ocean?" Meaning is it possible to implement a meaningful chunk of Typescript's ecosystem in Typescript following this convention. The results so far are [mixed](https://x.com/stronglynormal/status/2025877650296668169), but it gets better all the time.

## Status

The project is a side quest's side quest, so it's pretty experimental. If folks want to contribute, all I ask is that the code be 100% LLM written. I think one of the most useful things is coming up with strategies to keep LLM's on-point with typelevel programming, so the strategy is as useful as the contribution.
