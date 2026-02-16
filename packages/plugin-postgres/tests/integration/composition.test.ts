import { error, fiber, mvfm, num, ord, semiring, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { postgres } from "../../src/3.4.8";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, ord, semiring, postgres("postgres://localhost/test"), fiber, error);

describe("composition: postgres + fiber", () => {
  it("$.par wrapping postgres queries nests correctly", () => {
    const prog = app(($) => {
      return $.par($.sql`select count(*) from users`, $.sql`select count(*) from posts`);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/tuple");
    expect(ast.result.elements[0].kind).toBe("postgres/query");
    expect(ast.result.elements[1].kind).toBe("postgres/query");
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
        return $.begin(
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
    expect(ast.result.expr.kind).toBe("core/tuple");
    expect(ast.result.expr.elements[0].kind).toBe("postgres/query");
  });

  it("guard → par_map → try → retry → catch nests correctly", () => {
    const prog = app(($) => {
      const users = $.sql`select * from users where active = true`;
      return $.begin(
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
    expect(ast.result.kind).toBe("core/begin");
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
          return $.begin(
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
    expect(ast.result.expr.body.kind).toBe("core/begin");
    expect(ast.result.expr.body.steps[0].kind).toBe("error/guard");
    expect(ast.result.catch.body.kind).toBe("core/record");
  });
});
