/**
 * Everything-Everywhere-All-At-Once Integration Test
 *
 * This is the SPECIFICATION for the front-door API. It defines what "done"
 * looks like. Every import, every method call, every chaining pattern here
 * is the contract. If this test passes, the front door is back on.
 *
 * Exercises:
 * - Front-door API: mvfm, fold, defaults, injectInput, prelude
 * - st plugin: let, get, set, push
 * - error plugin: try, catch, fail, guard
 * - control plugin: each, while
 * - Arithmetic: add, sub, mul, div, mod, neg, abs, floor, min, max
 * - Strings: concat, upper, trim, replace, startsWith, len, show
 * - Booleans: and, or, not
 * - Ordering: gt, lt, gte
 * - Eq: eq, neq — including nested trait dispatch eq(eq(1,2), eq(3,4))
 * - Core: cond (.t/.f), begin, input, proxy access chains
 * - Auto-lift: records, tuples, raw JS values to core/literal
 * - Deeply nested let bindings with complex auto-lifted structures
 * - Proxy access chains on .get() results: cell.get().deep.inner
 *
 * THIS TEST WILL NOT COMPILE until the front-door API is implemented.
 * That is intentional.
 */

import { describe, expect, test } from "vitest";
import { control, defaults, error, fold, injectInput, mvfm, prelude, st } from "../src/index";

describe("everything-everywhere-all-at-once", () => {
  test("the answer is 42", async () => {
    const app = mvfm(prelude, st, error, control);

    const prog = app({ x: "number", name: "string", threshold: "number", flag: "boolean" }, ($) => {
      // ── Phase 1: Arithmetic gauntlet ─────────────────────────────
      // Exercises: mul, div, add, mod, abs, neg, floor, min, max
      const squared = $.mul($.input.x, $.input.x); //           49
      const halved = $.div(squared, $.input.x); //              7
      const base = $.add(halved, $.mod(squared, 10)); //        7+9 = 16
      const flipped = $.abs($.neg(base)); //                    16
      const stretched = $.floor($.div($.mul(flipped, 10), 7)); // floor(22.857) = 22
      const clamped = $.min(stretched, $.max(22, 15)); //       min(22,22) = 22

      // ── Phase 2: Mutable state (st) ──────────────────────────────
      // Exercises: let, get, set, push
      const acc = $.let(clamped); //                            starts at 22
      const trail = $.let([]);

      // ── Phase 3: Each loop with conditional mutation (control) ────
      // Exercises: each, cond inside loop, gt, begin, set, push, show
      $.each([2, 4, 6, 8], (item) => {
        $.cond($.gt(item, $.input.threshold))
          .t($.begin(acc.set($.add(acc.get(), item)), trail.push($.concat("added:", $.show(item)))))
          .f(trail.push($.concat("skip:", $.show(item))));
      });
      // threshold=3 → skip 2, add 4+6+8 → acc = 22+18 = 40

      // ── Phase 4: While loop (control) ────────────────────────────
      // Exercises: while, lt, body, counter pattern
      const counter = $.let(0);
      $.while($.lt(counter.get(), 2)).body(() => {
        acc.set($.add(acc.get(), 1));
        counter.set($.add(counter.get(), 1));
      });
      // acc = 40+2 = 42

      // ── Phase 5: Error handling (error) ──────────────────────────
      // Exercises: try, catch, fail, guard, begin
      const validated = $.try(
        $.begin($.guard($.gt(acc.get(), 0), "must be positive"), acc.get()),
      ).catch((err) => $.concat("error: ", err));
      // acc=42 > 0 → guard passes → validated = 42

      // ── Phase 6: String torture ──────────────────────────────────
      // Exercises: concat, upper, trim, replace, startsWith, len, show
      const greeting = $.concat("Hello, ", $.upper($.trim($.input.name)));
      const tagged = $.replace(greeting, "Hello", "Hi");
      const hasPrefix = $.startsWith(tagged, "Hi"); //         true
      const nameLen = $.len($.trim($.input.name)); //          5

      // ── Phase 7: Boolean logic ───────────────────────────────────
      // Exercises: and, or, not, gt, eq on numbers
      const isPositive = $.gt(acc.get(), 0);
      const check = $.and(isPositive, $.not($.eq($.input.x, 0)));
      const disjunction = $.or($.input.flag, $.lt($.input.x, 0));

      // ── Phase 8: Nested trait dispatch (the sadistic part) ───────
      // Exercises: eq dispatching on boolean results of eq
      const nestedEq = $.eq($.eq(1, 2), $.eq(3, 4)); //       eq(false,false) = true
      const neqCheck = $.neq($.input.x, 0); //                7≠0 → true

      // ── Phase 9: Deeply nested let + proxy access chains ─────────
      // Exercises: let with auto-lifted record/tuple, .get().field chains
      const a = $.mul($.input.x, 2); //                        14
      const zz = 36;
      const nested = $.let({
        y: a,
        z: $.input.x,
        m: zz,
        deep: { inner: $.sub(a, $.input.x) }, //               14-7 = 7
      });
      const fromDeep = nested.get().deep.inner; //             proxy chain → 7
      const deepEq = $.eq(fromDeep, $.input.x); //            eq(7,7) = true

      // ── Phase 10: Record with tuple inside let, proxy into it ────
      const metadata = $.let({
        greeting: tagged,
        flags: [hasPrefix, check, nestedEq, deepEq],
        stats: { nameLen, disjunction },
      });
      const firstFlag = metadata.get().flags[0]; //           hasPrefix → true

      // ── Phase 11: Final gate ─────────────────────────────────────
      const allChecks = $.and($.and(nestedEq, deepEq), $.and(check, firstFlag));
      const answer = $.cond($.and($.eq(validated, 42), allChecks))
        .t(validated)
        .f(-1);

      return $.begin(
        trail.push(greeting),
        trail.push($.show(nestedEq)),
        trail.push($.show(neqCheck)),
        answer,
      );
    });

    const result = await fold(
      defaults(app),
      injectInput(prog, { x: 7, name: " alice ", threshold: 3, flag: true }),
    );

    expect(result).toBe(42);
  });

  test("record and tuple auto-lift return", async () => {
    const app = mvfm(prelude, st);

    const prog = app({ a: "number", b: "number" }, ($) => {
      const sum = $.add($.input.a, $.input.b);
      const diff = $.sub($.input.a, $.input.b);
      const product = $.mul($.input.a, $.input.b);
      const cell = $.let(0);
      cell.set(sum);

      return {
        sum: cell.get(),
        diff,
        pair: [$.input.a, $.input.b],
        nested: {
          product,
          isPositive: $.gt(product, 0),
          label: $.concat("result: ", $.show(sum)),
        },
      };
    });

    const result = await fold(defaults(app), injectInput(prog, { a: 10, b: 3 }));

    expect(result).toEqual({
      sum: 13,
      diff: 7,
      pair: [10, 3],
      nested: {
        product: 30,
        isPositive: true,
        label: "result: 13",
      },
    });
  });

  test("error recovery across branches", async () => {
    const app = mvfm(prelude, error, st);

    const prog = app({ age: "number" }, ($) => {
      const status = $.let("pending");
      const checked = $.cond($.gte($.input.age, 18))
        .t($.begin(status.set("approved"), $.concat("welcome, age ", $.show($.input.age))))
        .f($.fail("must be 18+"));

      const safe = $.try(checked).catch((err) =>
        $.begin(status.set("denied"), $.concat("denied: ", err)),
      );

      return { message: safe, status: status.get() };
    });

    const denied = await fold(defaults(app), injectInput(prog, { age: 15 }));
    expect(denied).toEqual({
      message: "denied: must be 18+",
      status: "denied",
    });

    const approved = await fold(defaults(app), injectInput(prog, { age: 25 }));
    expect(approved).toEqual({
      message: "welcome, age 25",
      status: "approved",
    });
  });
});
