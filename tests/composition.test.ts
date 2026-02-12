import { describe, expect, it } from "vitest";
import { ilo } from "../src/core";
import { error } from "../src/plugins/error";
import { fiber } from "../src/plugins/fiber";
import { num } from "../src/plugins/num";
import { ord } from "../src/plugins/ord";
import { postgres } from "../src/plugins/postgres/3.4.8";
import { semiring } from "../src/plugins/semiring";
import { str } from "../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, ord, semiring, postgres("postgres://localhost/test"), fiber, error);

describe("composition: postgres + fiber", () => {
  it("$.par wrapping postgres queries nests correctly", () => {
    const prog = app(($) => {
      return $.par($.sql`select count(*) from users`, $.sql`select count(*) from posts`);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fiber/par");
    expect(ast.result.branches[0].kind).toBe("postgres/query");
    expect(ast.result.branches[1].kind).toBe("postgres/query");
  });

  it("$.par map form over postgres query results", () => {
    const prog = app(($) => {
      const users = $.sql`select * from users`;
      return $.par(
        users,
        { concurrency: 5 },
        (user) => $.sql`select * from posts where user_id = ${user.id}`,
      );
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fiber/par_map");
    expect(ast.result.collection.kind).toBe("postgres/query");
    expect(ast.result.body.kind).toBe("postgres/query");
  });
});

describe("composition: postgres + error", () => {
  it("$.try wrapping postgres query produces correct nesting", () => {
    const prog = app(($) => {
      return $.try($.sql`select * from users where id = ${$.input.id}`).catch((err) => ({
        error: err.message,
      }));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("error/try");
    expect(ast.result.expr.kind).toBe("postgres/query");
  });

  it("$.guard inside transaction with $.do", () => {
    const prog = app(($) => {
      return $.sql.begin((sql) => {
        const from = sql`select * from accounts where id = ${$.input.fromId}`;
        return $.do(
          $.guard($.gt(from[0].balance, $.input.amount), { code: "INSUFFICIENT" }),
          sql`update accounts set balance = balance - ${$.input.amount} where id = ${$.input.fromId}`,
          { success: true },
        );
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("postgres/begin");
    const doNode = ast.result.body;
    expect(doNode.steps[0].kind).toBe("error/guard");
    expect(doNode.steps[1].kind).toBe("postgres/query");
  });
});

describe("composition: postgres + fiber + error (full stack)", () => {
  it("$.try($.par(...)).catch() — the full monty", () => {
    const prog = app(($) => {
      return $.try($.par($.sql`select * from service_a`, $.sql`select * from service_b`)).catch(
        (_err) => [],
      );
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("error/try");
    expect(ast.result.expr.kind).toBe("fiber/par");
    expect(ast.result.expr.branches[0].kind).toBe("postgres/query");
  });

  it("guard → par_map → try → retry → catch nests correctly", () => {
    const prog = app(($) => {
      const users = $.sql`select * from users where active = true`;
      return $.do(
        $.guard($.gt(users.length, 0), { code: 404, message: "no users" }),
        $.par(users, { concurrency: 5 }, (user) =>
          $.try(
            $.retry($.sql`select * from posts where user_id = ${user.id}`, {
              attempts: 2,
              delay: 500,
            }),
          ).catch((_err) => []),
        ),
      );
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
    expect(ast.result.steps[0].kind).toBe("error/guard");
    expect(ast.result.result.kind).toBe("fiber/par_map");
    expect(ast.result.result.body.kind).toBe("error/try");
    expect(ast.result.result.body.expr.kind).toBe("fiber/retry");
    expect(ast.result.result.body.expr.expr.kind).toBe("postgres/query");
  });

  it("safeTransfer: try → begin → guard + do → catch", () => {
    const prog = app(($) => {
      return $.try(
        $.sql.begin((sql) => {
          const from = sql`select * from accounts where id = ${$.input.fromId} for update`;
          const to = sql`select * from accounts where id = ${$.input.toId} for update`;
          return $.do(
            $.guard($.gt(from[0].balance, $.input.amount), { code: "INSUFFICIENT_FUNDS" }),
            sql`update accounts set balance = balance - ${$.input.amount} where id = ${$.input.fromId}`,
            sql`update accounts set balance = balance + ${$.input.amount} where id = ${$.input.toId}`,
            {
              success: true,
              fromBalance: $.sub(from[0].balance, $.input.amount),
              toBalance: $.add(to[0].balance, $.input.amount),
            },
          );
        }),
      ).catch((err) => ({ success: false, error: err }));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("error/try");
    expect(ast.result.expr.kind).toBe("postgres/begin");
    expect(ast.result.expr.body.kind).toBe("core/do");
    expect(ast.result.expr.body.steps[0].kind).toBe("error/guard");
    expect(ast.result.catch.body.kind).toBe("core/record");
  });
});
