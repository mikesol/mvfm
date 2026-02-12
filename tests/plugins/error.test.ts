import { describe, expect, it } from "vitest";
import { ilo } from "../../src/core";
import { error } from "../../src/plugins/error";
import { num } from "../../src/plugins/num";
import { postgres } from "../../src/plugins/postgres";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, postgres("postgres://localhost/test"), error);

describe("error: $.try().catch()", () => {
  it("produces error/try with catch branch", () => {
    const prog = app(($) => {
      return $.try($.sql`select * from users where id = ${$.input.id}`).catch((err) => ({
        error: err.message,
        data: null,
      }));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("error/try");
    expect(ast.result.expr.kind).toBe("postgres/query");
    expect(ast.result.catch.param.kind).toBe("core/lambda_param");
    expect(ast.result.catch.body.kind).toBe("core/record");
  });
});

describe("error: $.try().match()", () => {
  it("produces error/try with match branches", () => {
    const prog = app(($) => {
      return $.try($.sql`select * from users where id = ${$.input.id}`).match({
        not_found: (_err) => "default_user",
        timeout: (_err) => "cached_user",
        _: (err) => $.fail(err),
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("error/try");
    expect(ast.result.match).toBeDefined();
    expect(ast.result.match.branches.not_found.kind).toBe("core/literal");
    expect(ast.result.match.branches.timeout.kind).toBe("core/literal");
    expect(ast.result.match.branches._.kind).toBe("error/fail");
  });
});

describe("error: $.try().finally()", () => {
  it("produces error/try with finally node", () => {
    const prog = app(($) => {
      return $.try($.sql`delete from users where id = ${$.input.id}`)
        .finally($.sql`insert into audit_log (action) values ('delete')`)
        .catch((err) => ({ error: err.message }));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("error/try");
    expect(ast.result.finally).not.toBeNull();
    expect(ast.result.finally.kind).toBe("postgres/query");
  });
});

describe("error: $.fail()", () => {
  it("produces error/fail node", () => {
    const prog = app(($) => {
      return $.cond($.gt($.input.x, 0))
        .t($.input.x)
        .f($.fail({ code: 404, message: "not found" }));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.else.kind).toBe("error/fail");
    expect(ast.result.else.error.kind).toBe("core/record");
  });
});

describe("error: $.orElse()", () => {
  it("produces error/try with catch that returns fallback", () => {
    const prog = app(($) => {
      return $.orElse($.sql`select * from users where id = ${$.input.id}`, [{ name: "anonymous" }]);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("error/try");
    expect(ast.result.catch.param.name).toBe("_err");
  });
});

describe("error: $.attempt()", () => {
  it("produces error/attempt node", () => {
    const prog = app(($) => {
      const result = $.attempt($.sql`select * from users where id = ${$.input.id}`);
      return $.cond($.gt($.input.id, 0))
        .t({ found: true, user: result.ok })
        .f({ found: false, error: result.err });
    });
    const ast = strip(prog.ast) as any;
    // result.ok and result.err are prop_access on the attempt node
    expect(ast.result.then.kind).toBe("core/record");
  });
});

describe("error: $.guard()", () => {
  it("produces error/guard node", () => {
    const prog = app(($) => {
      return $.do(
        $.guard($.gt($.input.balance, $.input.amount), {
          code: 400,
          message: "insufficient funds",
        }),
        $.sql`update accounts set balance = balance - ${$.input.amount}`,
        { success: true },
      );
    });
    const ast = strip(prog.ast) as any;
    const guardNode = ast.result.steps[0];
    expect(guardNode.kind).toBe("error/guard");
    expect(guardNode.condition.kind).toBe("num/gt");
    expect(guardNode.error.kind).toBe("core/record");
  });
});

describe("error: $.settle()", () => {
  it("produces error/settle with multiple expressions", () => {
    const prog = app(($) => {
      return $.settle(
        $.sql`select 1 from users limit 1`,
        $.sql`select 1 from posts limit 1`,
        $.sql`select 1 from comments limit 1`,
      );
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("error/settle");
    expect(ast.result.exprs).toHaveLength(3);
    expect(ast.result.exprs[0].kind).toBe("postgres/query");
  });
});
