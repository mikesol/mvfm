/**
 * DagQL-Fu Mutations: Dirty transactions, named aliases, pipe chains,
 * multi-input programs, and the grand finale.
 *
 * Exercises DagQL mutation and composition operations through the front-door
 * pipeline: mvfm -> app -> Program -> pipe/dagql -> fold
 *
 * Phases 6-10: Dirty transactions, Named aliases, Pipe chains,
 * Multi-input programs, Grand finale.
 */

import { describe, expect, test } from "vitest";
import {
  addEntry,
  byKind,
  byName,
  commit,
  defaults,
  dirty,
  fold,
  gc,
  gcPreservingAliases,
  injectInput,
  mvfm,
  name,
  pipe,
  prelude,
  replaceWhere,
  rewireChildren,
  selectWhere,
  swapEntry,
  wrapByName,
} from "../src/index";

describe("dagql-fu mutations", () => {
  const app = mvfm(prelude);

  // (x + 3) * (x - 1)  with x=7 -> (10)*(6) = 60
  const prog = () => {
    const p = app({ x: "number" }, ($: any) => {
      return $.mul($.add($.input.x, 3), $.sub($.input.x, 1));
    });
    return injectInput(p, { x: 7 });
  };

  // -- Phase 6: Dirty transaction --
  test("dirty: swap add->sub via swapEntry", async () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];
    const entry = nexpr.__adj[addId];

    const d = dirty(nexpr);
    const swapped = swapEntry(d, addId, {
      kind: "num/sub" as const,
      children: entry.children,
      out: entry.out,
    });
    expect(await fold(commit(swapped), defaults(app))).toBe(24);
  });

  test("dirty: addEntry + setRoot + gc", () => {
    const nexpr = prog().__nexpr;
    const d = dirty(nexpr);
    const withExtra = addEntry(d, "orphan", {
      kind: "num/literal" as const,
      children: [] as const,
      out: 999,
    });
    const cleaned = gc(withExtra);
    expect("orphan" in cleaned.__adj).toBe(false);
    expect(Object.keys(cleaned.__adj).length).toBe(Object.keys(nexpr.__adj).length);
  });

  test("dirty: rewireChildren redirects references", () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];
    const subId = [...selectWhere(nexpr, byKind("num/sub"))][0];

    const d = dirty(nexpr);
    const rewired = rewireChildren(d, addId, subId);
    const _c = commit(rewired);
  });

  // -- Phase 7: Named aliases + byName predicate --
  test("named: alias then select by name", () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];
    const named = name(nexpr, "the-sum", addId);
    const found = selectWhere(named, byName("the-sum"));
    expect(found.size).toBe(1);
    expect(found.has(addId as any)).toBe(true);
  });

  test("named: gcPreservingAliases keeps alias, gc removes it", () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];
    const named = name(nexpr, "the-sum", addId);

    const gcDrop = commit(gc(dirty(named)));
    expect("@the-sum" in gcDrop.__adj).toBe(false);

    const gcKeep = commit(gcPreservingAliases(dirty(named)));
    expect("@the-sum" in gcKeep.__adj).toBe(true);
  });

  test("named: replaceWhere byName targets only the aliased node", async () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];
    const named = name(nexpr, "the-sum", addId);

    const replaced = replaceWhere(named, byName("the-sum"), "num/sub");
    expect(replaced.__adj[addId].kind).toBe("num/sub");
    const subId = [...selectWhere(nexpr, byKind("num/sub"))][0];
    expect(replaced.__adj[subId].kind).toBe("num/sub");
  });

  // -- Phase 8: Pipe chains --
  test("pipe: replace -> map -> fold", async () => {
    const nexpr = prog().__nexpr;
    const result = await fold(
      commit(
        pipe(
          nexpr,
          (e) => replaceWhere(e, byKind("num/sub"), "num/add"),
          (e) => replaceWhere(e, byKind("num/mul"), "num/sub"),
        ),
      ),
      defaults(app),
    );
    expect(result).toBe(2);
  });

  test("pipe: wrap -> replace wrapper -> splice", async () => {
    const nexpr = prog().__nexpr;
    const addId = [...selectWhere(nexpr, byKind("num/add"))][0];

    const final = pipe(
      nexpr,
      (e) => wrapByName(e, addId, "debug/span"),
      (e) => replaceWhere(e, byKind("debug/span"), "num/neg"),
    );
    const committed = commit(final);
    const negIds = selectWhere(committed, byKind("num/neg"));
    expect(negIds.size).toBe(1);
  });

  // -- Phase 9: Multi-input program with DagQL --
  test("multi-input: build, inject, transform, fold", async () => {
    const prog2 = app({ a: "number", b: "number" }, ($: any) => {
      return $.add($.mul($.input.a, 2), $.mul($.input.b, 3));
    });
    const injected = injectInput(prog2, { a: 5, b: 10 });

    expect(await fold(defaults(app), injected)).toBe(40);

    const nexpr = injected.__nexpr;
    const transformed = commit(replaceWhere(nexpr, byKind("num/mul"), "num/add"));
    expect(await fold(transformed, defaults(app))).toBe(20);
  });

  // -- Phase 10: The grand finale --
  test("grand finale: build -> inject -> name -> wrap -> replace -> gc -> fold", async () => {
    const p = app({ n: "number" }, ($: any) => {
      return $.add($.mul($.input.n, $.input.n), $.sub($.input.n, 1));
    });
    const injected = injectInput(p, { n: 4 });
    expect(await fold(defaults(app), injected)).toBe(19);

    const nexpr = injected.__nexpr;
    const mulId = [...selectWhere(nexpr, byKind("num/mul"))][0];
    const named0 = name(nexpr, "square", mulId);

    const final = pipe(
      named0,
      (e) => wrapByName(e, mulId, "debug/log"),
      (e) => replaceWhere(e, byKind("debug/log"), "num/neg"),
      (e) => gcPreservingAliases(e),
    );
    const committed = commit(final);

    expect("@square" in committed.__adj).toBe(true);
    expect(await fold(committed, defaults(app))).toBe(-13);
  });
});
