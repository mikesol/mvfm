import { createApp, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { postgres } from "../../src/3.4.8";

const plugin = postgres("postgres://localhost/test");
const plugins = [numPluginU, strPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

describe("postgres: CExpr construction (tagged template)", () => {
  it("basic query produces postgres/query CExpr", () => {
    const expr = $.sql`select * from users where age > ${30}`;
    expect(expr.__kind).toBe("postgres/query");
    // args: [numStrings=2, "select * from users where age > ", "", 30]
    expect(expr.__args[0]).toBe(2);
    expect(expr.__args[1]).toBe("select * from users where age > ");
    expect(expr.__args[2]).toBe("");
    expect(expr.__args[3]).toBe(30);
  });

  it("query with no params produces correct args", () => {
    const expr = $.sql`select 1`;
    expect(expr.__kind).toBe("postgres/query");
    expect(expr.__args[0]).toBe(1); // numStrings
    expect(expr.__args[1]).toBe("select 1");
    expect(expr.__args).toHaveLength(2); // numStrings + 1 string part, no params
  });

  it("query elaborates to NExpr without error", () => {
    expect(() => app($.sql`select * from users where age > ${30}`)).not.toThrow();
  });

  it("parameterized query with CExpr values captures dependency", () => {
    const user = $.sql`select * from users where id = ${1}`;
    const posts = $.sql`select * from posts where user_id = ${user[0].id}`;
    // Should elaborate without error — dependency captured via proxy
    expect(() => app(posts)).not.toThrow();
  });
});

describe("postgres: dynamic identifiers ($.sql.id)", () => {
  it("produces postgres/identifier CExpr", () => {
    const expr = $.sql.id("name");
    expect(expr.__kind).toBe("postgres/identifier");
    expect(expr.__args[0]).toBe("name");
  });

  it("accepts CExpr argument", () => {
    const col = $.sql`select 1`[0].column;
    const expr = $.sql.id(col);
    expect(expr.__kind).toBe("postgres/identifier");
  });

  it("identifier inside query elaborates", () => {
    expect(() => app($.sql`select ${$.sql.id("name")} from users`)).not.toThrow();
  });
});

describe("postgres: insert helper ($.sql.insert)", () => {
  it("produces postgres/insert_helper CExpr", () => {
    const data = $.sql`select 1`[0];
    const expr = $.sql.insert(data, ["name", "age"]);
    expect(expr.__kind).toBe("postgres/insert_helper");
    // arg[1] should be JSON-encoded columns
    expect(expr.__args[1]).toBe('["name","age"]');
  });

  it("insert with no columns stores null", () => {
    const data = $.sql`select 1`[0];
    const expr = $.sql.insert(data);
    expect(expr.__args[1]).toBe("null");
  });
});

describe("postgres: set helper ($.sql.set)", () => {
  it("produces postgres/set_helper CExpr", () => {
    const data = $.sql`select 1`[0];
    const expr = $.sql.set(data, ["name", "age"]);
    expect(expr.__kind).toBe("postgres/set_helper");
    expect(expr.__args[1]).toBe('["name","age"]');
  });
});

describe("postgres: transactions", () => {
  it("pipeline mode produces postgres/begin CExpr with mode=pipeline", () => {
    const expr = $.sql.begin((sql) => [
      sql`update users set active = false where id = ${1}`,
      sql`insert into audit_log (action) values ('deactivate')`,
    ]);
    expect(expr.__kind).toBe("postgres/begin");
    expect(expr.__args[0]).toBe("pipeline");
    expect(expr.__args).toHaveLength(3); // mode + 2 queries
  });

  it("callback mode produces postgres/begin CExpr with mode=callback", () => {
    const expr = $.sql.begin((sql) => {
      const user = sql`insert into users (name) values ('test') returning *`;
      return user;
    });
    expect(expr.__kind).toBe("postgres/begin");
    expect(expr.__args[0]).toBe("callback");
    expect(expr.__args).toHaveLength(2); // mode + body
  });

  it("transaction sql instance has savepoint", () => {
    const expr = $.sql.begin((sql) => {
      return (sql as unknown as { savepoint: Function }).savepoint((sql2: typeof sql) => [
        sql2`update users set name = 'test'`,
      ]);
    });
    expect(expr.__kind).toBe("postgres/begin");
    // The body is a savepoint CExpr
    const body = expr.__args[1] as { __kind: string };
    expect(body.__kind).toBe("postgres/savepoint");
  });

  it("transaction elaborates", () => {
    expect(() =>
      app(
        $.sql.begin((sql) => [
          sql`update users set active = false where id = ${1}`,
          sql`insert into audit_log (action) values ('deactivate')`,
        ]),
      ),
    ).not.toThrow();
  });
});

describe("postgres: cursor", () => {
  it("produces postgres/cursor CExpr", () => {
    const query = $.sql`select * from users`;
    const expr = $.sql.cursor(query, 100, (batch) => {
      return $.sql`insert into archive ${$.sql.insert(batch)}`;
    });
    expect(expr.__kind).toBe("postgres/cursor");
    expect(expr.__args).toHaveLength(3); // query, batchSize, body
  });

  it("cursor batch parameter is a postgres/cursor_batch CExpr", () => {
    const query = $.sql`select * from users`;
    const expr = $.sql.cursor(query, 50, (batch) => batch);
    expect(expr.__kind).toBe("postgres/cursor");
    const body = expr.__args[2] as { __kind: string };
    expect(body.__kind).toBe("postgres/cursor_batch");
  });
});

describe("postgres: plugin structure", () => {
  it("has correct name and kinds", () => {
    expect(plugin.name).toBe("postgres");
    expect(Object.keys(plugin.kinds)).toContain("postgres/query");
    expect(Object.keys(plugin.kinds)).toContain("postgres/begin");
    expect(Object.keys(plugin.kinds)).toContain("postgres/cursor");
    expect(Object.keys(plugin.kinds)).toHaveLength(10);
  });

  it("string config accepted", () => {
    const p = postgres("postgres://localhost:5432/mydb");
    expect(p.name).toBe("postgres");
  });
});
