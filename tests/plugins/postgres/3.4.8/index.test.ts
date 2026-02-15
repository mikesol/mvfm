import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { postgres } from "../../../../src/plugins/postgres/3.4.8";
import { str } from "../../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, postgres("postgres://localhost/test"));

// ============================================================
// Parity tests: encoding the Honest Assessment Matrix
// ============================================================

describe("postgres: tagged template queries", () => {
  it("basic query produces postgres/query node", () => {
    const prog = app(($) => {
      return $.sql`select * from users where age > ${30}`;
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("postgres/query");
    expect(ast.result.strings).toEqual(["select * from users where age > ", ""]);
    expect(ast.result.params).toHaveLength(1);
    expect(ast.result.params[0].kind).toBe("core/literal");
    expect(ast.result.params[0].value).toBe(30);
  });

  it("parameterized query with Expr values captures dependency", () => {
    const prog = app(($) => {
      const user = $.sql`select * from users where id = ${$.input.id}`;
      const posts = $.sql`select * from posts where user_id = ${user[0].id}`;
      return { user: user[0], posts };
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/record");
    expect(ast.result.fields.posts.kind).toBe("postgres/query");
    // The param should reference through prop_access chain, not a literal
    const postParam = ast.result.fields.posts.params[0];
    expect(postParam.kind).toBe("core/prop_access");
  });

  it("query with no params produces empty params array", () => {
    const prog = app(($) => $.sql`select 1`);
    const ast = strip(prog.ast) as any;
    expect(ast.result.params).toEqual([]);
  });
});

describe("postgres: dynamic identifiers ($.sql.id)", () => {
  it("produces postgres/identifier node", () => {
    const prog = app(($) => {
      return $.sql`select ${$.sql.id("name")} from users`;
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("postgres/query");
    expect(ast.result.params[0].kind).toBe("postgres/identifier");
  });

  it("accepts Expr<string> argument", () => {
    const prog = app(($) => {
      return $.sql`select ${$.sql.id($.input.column)} from users`;
    });
    const ast = strip(prog.ast) as any;
    const idNode = ast.result.params[0];
    expect(idNode.kind).toBe("postgres/identifier");
    expect(idNode.name.kind).toBe("core/prop_access");
  });
});

describe("postgres: insert helper ($.sql.insert)", () => {
  it("produces postgres/insert_helper node", () => {
    const prog = app(($) => {
      return $.sql`insert into users ${$.sql.insert($.input.user, ["name", "age"])} returning *`;
    });
    const ast = strip(prog.ast) as any;
    const insertNode = ast.result.params[0];
    expect(insertNode.kind).toBe("postgres/insert_helper");
    expect(insertNode.columns).toEqual(["name", "age"]);
  });
});

describe("postgres: set helper ($.sql.set)", () => {
  it("produces postgres/set_helper node", () => {
    const prog = app(($) => {
      return $.sql`update users set ${$.sql.set($.input.data, ["name", "age"])} where id = ${$.input.id}`;
    });
    const ast = strip(prog.ast) as any;
    // First param is the set helper, second is the id
    const setNode = ast.result.params[0];
    expect(setNode.kind).toBe("postgres/set_helper");
    expect(setNode.columns).toEqual(["name", "age"]);
  });
});

describe("postgres: transactions", () => {
  it("pipeline mode (array return) produces postgres/begin with mode=pipeline", () => {
    const prog = app(($) => {
      return $.sql.begin((sql) => [
        sql`update users set active = false where id = ${$.input.id}`,
        sql`insert into audit_log (action) values ('deactivate')`,
      ]);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("postgres/begin");
    expect(ast.result.mode).toBe("pipeline");
    expect(ast.result.queries).toHaveLength(2);
    expect(ast.result.queries[0].kind).toBe("postgres/query");
    expect(ast.result.queries[1].kind).toBe("postgres/query");
  });

  it("callback mode (Expr return) produces postgres/begin with mode=callback", () => {
    const prog = app(($) => {
      return $.sql.begin((sql) => {
        const user = sql`insert into users (name) values ('test') returning *`;
        const account = sql`insert into accounts (user_id) values (${user[0].id}) returning *`;
        return $.do(user, account, { user: user[0], account: account[0] });
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("postgres/begin");
    expect(ast.result.mode).toBe("callback");
    expect(ast.result.body.kind).toBe("core/do");
  });

  it("transaction sql instance has savepoint", () => {
    const prog = app(($) => {
      return $.sql.begin((sql) => {
        const user = sql`select * from users where id = ${$.input.id}`;
        const sp = (sql as any).savepoint((sql2: any) => [
          sql2`update users set name = 'test' where id = ${user[0].id}`,
        ]);
        return $.do(sp, user[0]);
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("postgres/begin");
    const doNode = ast.result.body;
    expect(doNode.kind).toBe("core/do");
    expect(doNode.steps[0].kind).toBe("postgres/savepoint");
  });
});

describe("postgres: cursor", () => {
  it("$.sql.cursor() produces postgres/cursor node", () => {
    const prog = app(($) => {
      const query = $.sql`select * from users`;
      return $.sql.cursor(query, 100, (batch: any) => {
        return $.sql`insert into archive ${$.sql.insert(batch)}`;
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("postgres/cursor");
    expect(ast.result.query.kind).toBe("postgres/query");
    expect(ast.result.batchSize.kind).toBe("core/literal");
    expect(ast.result.batchSize.value).toBe(100);
    expect(ast.result.body.kind).toBe("postgres/query");
  });

  it("cursor batch parameter is a postgres/cursor_batch node", () => {
    const prog = app(($) => {
      const query = $.sql`select * from users`;
      return $.sql.cursor(query, 50, (batch: any) => {
        return batch; // just return the batch proxy itself
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("postgres/cursor");
    expect(ast.result.body.kind).toBe("postgres/cursor_batch");
    expect(ast.result.batchSize.value).toBe(50);
  });
});

describe("postgres: integration with $.do()", () => {
  it("side-effecting queries wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const user = $.sql`select * from users where id = ${$.input.id}`;
        return $.do($.sql`update users set last_seen = now() where id = ${$.input.id}`, user[0]);
      });
    }).not.toThrow();
  });

  it("orphaned queries are rejected", () => {
    expect(() => {
      app(($) => {
        const user = $.sql`select * from users where id = ${$.input.id}`;
        $.sql`update users set last_seen = now() where id = ${$.input.id}`; // orphan!
        return user[0];
      });
    }).toThrow(/unreachable node/i);
  });
});
