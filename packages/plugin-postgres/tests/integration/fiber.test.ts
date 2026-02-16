import { fiber, mvfm, num } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { postgres } from "../../src/3.4.8";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, postgres("postgres://localhost/test"), fiber);

describe("fiber: $.par() tuple form", () => {
  it("produces core/tuple node with elements", () => {
    const prog = app(($) => {
      return $.par($.sql`select count(*) from users`, $.sql`select count(*) from posts`);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/tuple");
    expect(ast.result.elements).toHaveLength(2);
    expect(ast.result.elements[0].kind).toBe("postgres/query");
    expect(ast.result.elements[1].kind).toBe("postgres/query");
  });

  it("works with 3+ elements", () => {
    const prog = app(($) => {
      return $.par($.sql`select 1`, $.sql`select 2`, $.sql`select 3`);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.elements).toHaveLength(3);
  });
});

describe("fiber: $.par() map form", () => {
  it("produces fiber/par_map with concurrency and lambda", () => {
    const prog = app(($) => {
      const users = $.sql`select * from users where active = true`;
      return $.par(
        users,
        { concurrency: 5 },
        (user) => $.sql`select * from posts where user_id = ${user.id}`,
      );
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fiber/par_map");
    expect(ast.result.concurrency).toBe(5);
    expect(ast.result.collection.kind).toBe("postgres/query");
    expect(ast.result.param.kind).toBe("core/lambda_param");
    expect(ast.result.body.kind).toBe("postgres/query");
  });
});

describe("fiber: $.seq()", () => {
  it("produces core/do with steps and result", () => {
    const prog = app(($) => {
      return $.seq(
        $.sql`insert into log (msg) values ('start')`,
        $.sql`insert into log (msg) values ('end')`,
        $.sql`select * from log`,
      );
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/begin");
    expect(ast.result.steps).toHaveLength(2);
    expect(ast.result.result.kind).toBe("postgres/query");
  });
});

describe("fiber: $.race()", () => {
  it("produces fiber/race with branches", () => {
    const prog = app(($) => {
      return $.race(
        $.sql`select * from users_primary where id = ${$.input.id}`,
        $.sql`select * from users_replica where id = ${$.input.id}`,
      );
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fiber/race");
    expect(ast.result.branches).toHaveLength(2);
  });
});

describe("fiber: $.timeout()", () => {
  it("produces fiber/timeout with ms and fallback", () => {
    const prog = app(($) => {
      return $.timeout($.sql`select * from slow_view`, 5000, { error: "timeout" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fiber/timeout");
    expect(ast.result.ms.kind).toBe("core/literal");
    expect(ast.result.ms.value).toBe(5000);
    expect(ast.result.fallback.kind).toBe("core/record");
  });

  it("accepts Expr<number> for ms", () => {
    const prog = app(($) => {
      return $.timeout($.sql`select 1`, $.input.timeoutMs, "fallback");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.ms.kind).toBe("core/prop_access");
  });
});

describe("fiber: $.retry()", () => {
  it("produces fiber/retry with attempts and delay", () => {
    const prog = app(($) => {
      return $.retry($.sql`select * from flaky_service`, { attempts: 3, delay: 1000 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fiber/retry");
    expect(ast.result.attempts).toBe(3);
    expect(ast.result.delay).toBe(1000);
  });

  it("defaults delay to 0", () => {
    const prog = app(($) => {
      return $.retry($.sql`select 1`, { attempts: 2 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.delay).toBe(0);
  });
});

describe("fiber: nested composition", () => {
  it("par_map → retry → par nests correctly", () => {
    const prog = app(($) => {
      const users = $.sql`select * from users where active = true`;
      return $.par(users, { concurrency: 5 }, (user) =>
        $.retry(
          $.par(
            $.sql`select * from posts where user_id = ${user.id}`,
            $.sql`select * from comments where user_id = ${user.id}`,
          ),
          { attempts: 2, delay: 500 },
        ),
      );
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fiber/par_map");
    expect(ast.result.body.kind).toBe("fiber/retry");
    expect(ast.result.body.expr.kind).toBe("core/tuple");
    expect(ast.result.body.expr.elements).toHaveLength(2);
  });
});
