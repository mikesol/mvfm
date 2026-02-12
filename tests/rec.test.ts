import { describe, expect, it } from "vitest";
import { ilo } from "../src/core";
import { eq } from "../src/plugins/eq";
import { num } from "../src/plugins/num";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

const app = ilo(num, eq);

describe("rec: basic structure", () => {
  it("produces core/rec with param and body", () => {
    const prog = app(($) =>
      $.rec((self, n) =>
        $.cond($.eq(n, 0))
          .t(1)
          .f($.mul(n, self($.sub(n, 1)))),
      ),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/rec");
    expect(ast.result.param.kind).toBe("core/lambda_param");
    expect(ast.result.param.name).toBe("rec_param");
    expect(ast.result.body.kind).toBe("core/cond");
  });

  it("self() calls produce core/rec_call nodes", () => {
    const prog = app(($) =>
      $.rec((self, n) =>
        $.cond($.eq(n, 0))
          .t(1)
          .f($.mul(n, self($.sub(n, 1)))),
      ),
    );
    const ast = strip(prog.ast) as any;
    // The else branch is mul(n, self(sub(n,1)))
    const elseBranch = ast.result.body.else;
    expect(elseBranch.kind).toBe("num/mul");
    expect(elseBranch.right.kind).toBe("core/rec_call");
    expect(elseBranch.right.arg.kind).toBe("num/sub");
  });

  it("rec_call references the same recId as the rec node", () => {
    const prog = app(($) =>
      $.rec((self, n) =>
        $.cond($.eq(n, 0))
          .t(1)
          .f(self($.sub(n, 1))),
      ),
    );
    const ast = strip(prog.ast) as any;
    const recId = ast.result.recId;
    expect(recId).toBeDefined();
    expect(typeof recId).toBe("string");
    // The else branch is the rec_call
    const recCall = ast.result.body.else;
    expect(recCall.kind).toBe("core/rec_call");
    expect(recCall.recId).toBe(recId);
  });
});

describe("rec: auto-lifting", () => {
  it("self() auto-lifts raw values", () => {
    const prog = app(($) => $.rec((_self, _n) => _self(42)));
    const ast = strip(prog.ast) as any;
    expect(ast.result.body.kind).toBe("core/rec_call");
    expect(ast.result.body.arg.kind).toBe("core/literal");
    expect(ast.result.body.arg.value).toBe(42);
  });
});

describe("rec: reachability", () => {
  it("does not trigger orphan detection", () => {
    // This should not throw — all nodes are reachable through the rec body
    expect(() =>
      app(($) =>
        $.rec((self, n) =>
          $.cond($.eq(n, 0))
            .t(1)
            .f($.mul(n, self($.sub(n, 1)))),
        ),
      ),
    ).not.toThrow();
  });
});

describe("rec: content hashing", () => {
  it("identical rec programs produce the same hash", () => {
    const prog1 = app(($) =>
      $.rec((self, n) =>
        $.cond($.eq(n, 0))
          .t(1)
          .f($.mul(n, self($.sub(n, 1)))),
      ),
    );
    const prog2 = app(($) =>
      $.rec((self, n) =>
        $.cond($.eq(n, 0))
          .t(1)
          .f($.mul(n, self($.sub(n, 1)))),
      ),
    );
    expect(prog1.hash).toBe(prog2.hash);
  });

  it("different rec programs produce different hashes", () => {
    const factorial = app(($) =>
      $.rec((self, n) =>
        $.cond($.eq(n, 0))
          .t(1)
          .f($.mul(n, self($.sub(n, 1)))),
      ),
    );
    const sum = app(($) =>
      $.rec((self, n) =>
        $.cond($.eq(n, 0))
          .t(0)
          .f($.add(n, self($.sub(n, 1)))),
      ),
    );
    expect(factorial.hash).not.toBe(sum.hash);
  });
});
