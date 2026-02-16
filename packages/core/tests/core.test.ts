import { describe, expect, it } from "vitest";
import type { PluginDefinition } from "../src/core";
import { mvfm } from "../src/core";
import { boolean } from "../src/plugins/boolean";
import { eq } from "../src/plugins/eq";
import { heytingAlgebra } from "../src/plugins/heyting-algebra";
import { num } from "../src/plugins/num";
import { semiring } from "../src/plugins/semiring";
import { str } from "../src/plugins/str";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("core: $.discard()", () => {
  const app = mvfm(num, str, semiring);

  it("sequences side effects with last arg as return value", () => {
    const prog = app(($) => {
      const a = $.add(1, 2);
      const b = $.add(3, 4);
      return $.discard(a, b);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/discard");
    expect(ast.result.steps).toHaveLength(1);
    expect(ast.result.steps[0].kind).toBe("num/add");
    expect(ast.result.result.kind).toBe("num/add");
  });

  it("works with a single expression (no steps)", () => {
    const prog = app(($) => {
      return $.discard($.add(1, 2));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/discard");
    expect(ast.result.steps).toHaveLength(0);
    expect(ast.result.result.kind).toBe("num/add");
  });
});

describe("core: $.cond()", () => {
  const app = mvfm(num, eq, semiring);

  it("produces a core/cond node with both branches via .t().f()", () => {
    const prog = app({ x: "number" }, ($) => {
      return $.cond($.eq($.input.x, 1)).t($.add(1, 2)).f($.add(3, 4));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/cond");
    expect(ast.result.then.kind).toBe("num/add");
    expect(ast.result.else.kind).toBe("num/add");
  });

  it("works with .f().t() order", () => {
    const prog = app({ x: "number" }, ($) => {
      return $.cond($.eq($.input.x, 1)).f($.add(3, 4)).t($.add(1, 2));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/cond");
    expect(ast.result.then.kind).toBe("num/add");
    expect(ast.result.else.kind).toBe("num/add");
  });

  it("auto-lifts raw values in branches", () => {
    const prog = app({ x: "number" }, ($) => {
      return $.cond($.eq($.input.x, 1)).t("yes").f("no");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.then.kind).toBe("core/literal");
    expect(ast.result.then.value).toBe("yes");
    expect(ast.result.else.kind).toBe("core/literal");
    expect(ast.result.else.value).toBe("no");
  });
});

describe("core: auto-lifting", () => {
  const app = mvfm(num, semiring);
  const appWithEq = mvfm(str, eq);

  it("lifts raw numbers to core/literal", () => {
    const prog = app(($) => $.add(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.left.kind).toBe("core/literal");
    expect(ast.result.left.value).toBe(1);
    expect(ast.result.right.kind).toBe("core/literal");
    expect(ast.result.right.value).toBe(2);
  });

  it("lifts raw strings to core/literal", () => {
    const prog = appWithEq({ name: "string" }, ($) => $.eq($.input.name, "alice"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.right.kind).toBe("core/literal");
    expect(ast.result.right.value).toBe("alice");
  });

  it("lifts raw objects to core/record", () => {
    const prog = app(($) => {
      return { x: $.add(1, 2), y: "hello" };
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/record");
    expect(ast.result.fields.x.kind).toBe("num/add");
    expect(ast.result.fields.y.kind).toBe("core/literal");
  });

  it("does not re-wrap Expr values", () => {
    const prog = app(($) => {
      const a = $.add(1, 2);
      return $.add(a, 3);
    });
    const ast = strip(prog.ast) as any;
    // left operand should be num/add, not core/literal wrapping it
    expect(ast.result.left.kind).toBe("num/add");
  });
});

describe("core: proxy property access", () => {
  const app = mvfm();

  it("user.firstName produces core/prop_access", () => {
    const prog = app(($) => $.input.user.firstName);
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/prop_access");
    expect(ast.result.property).toBe("firstName");
    expect(ast.result.object.kind).toBe("core/prop_access");
    expect(ast.result.object.property).toBe("user");
  });

  it("arr[0] produces core/prop_access with '0'", () => {
    const prog = app(($) => $.input.items[0]);
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/prop_access");
    expect(ast.result.property).toBe("0");
  });
});

describe("core: array methods produce core/lambda", () => {
  const app = mvfm(num, semiring);
  const appWithEq = mvfm(num, boolean, eq, semiring, heytingAlgebra);

  it(".map() produces core/method_call with core/lambda", () => {
    const prog = app(($) => {
      return $.input.items.map((item: any) => $.add(item.price, 1));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/method_call");
    expect(ast.result.method).toBe("map");
    expect(ast.result.args[0].kind).toBe("core/lambda");
    expect(ast.result.args[0].body.kind).toBe("num/add");
  });

  it(".filter() produces core/method_call with core/lambda", () => {
    const prog = appWithEq(($) => {
      return $.input.items.filter((item: any) => $.eq(item.active, true));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/method_call");
    expect(ast.result.method).toBe("filter");
    expect(ast.result.args[0].kind).toBe("core/lambda");
  });

  it(".reduce() produces core/lambda with accumulator and item params", () => {
    const prog = app(($) => {
      return $.input.items.reduce((sum: any, item: any) => $.add(sum, item.price), 0);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/method_call");
    expect(ast.result.method).toBe("reduce");
    expect(ast.result.args[0].kind).toBe("core/lambda");
    expect(ast.result.args[0].params).toHaveLength(2);
    expect(ast.result.args[0].params[0].name).toBe("accumulator");
    expect(ast.result.args[0].params[1].name).toBe("item");
  });
});

describe("core: reachability analysis", () => {
  const app = mvfm(num, str, semiring);

  it("rejects orphaned expressions", () => {
    expect(() => {
      app(($) => {
        $.add(1, 2); // created but not returned
        return $.add(3, 4);
      });
    }).toThrow(/unreachable node/i);
  });

  it("rejects multiple orphans", () => {
    expect(() => {
      app(($) => {
        $.add(1, 2);
        $.add(3, 4);
        return $.add(5, 6);
      });
    }).toThrow(/2 unreachable node/);
  });

  it("does not reject pure computations with all nodes connected", () => {
    expect(() => {
      app(($) => {
        const a = $.add(1, 2);
        const b = $.add(a, 3);
        return b;
      });
    }).not.toThrow();
  });

  it("does not reject nodes inside $.discard()", () => {
    expect(() => {
      app(($) => {
        const sideEffect = $.add(1, 2);
        const result = $.add(3, 4);
        return $.discard(sideEffect, result);
      });
    }).not.toThrow();
  });

  it("does not reject nodes inside .map() callbacks", () => {
    expect(() => {
      app(($) => {
        return $.input.items.map((item: any) => ({
          name: item.name,
          score: $.add(item.x, 1),
        }));
      });
    }).not.toThrow();
  });

  it("does not false-positive on $.input", () => {
    expect(() => {
      app(($) => {
        $.input.unused; // accessing input doesn't create orphans
        return $.input.x;
      });
    }).not.toThrow();
  });
});

describe("core: content hashing", () => {
  const app = mvfm(num, semiring);

  it("identical programs produce identical hashes", () => {
    const prog1 = app(($) => $.add($.input.x, 1));
    const prog2 = app(($) => $.add($.input.x, 1));
    expect(prog1.hash).toBe(prog2.hash);
  });

  it("different programs produce different hashes", () => {
    const prog1 = app(($) => $.add($.input.x, 1));
    const prog2 = app(($) => $.add($.input.x, 2));
    expect(prog1.hash).not.toBe(prog2.hash);
  });
});

describe("core: program metadata", () => {
  it("lists plugin names", () => {
    const app = mvfm(num, str, semiring);
    const prog = app(($) => $.add(1, 2));
    expect(prog.plugins).toEqual(["num", "str", "semiring"]);
  });

  it("works with no plugins", () => {
    const app = mvfm();
    const prog = app(($) => $.input.x);
    expect(prog.plugins).toEqual([]);
  });
});

describe("core: trait protocol", () => {
  it("plugins field on PluginContext exposes loaded plugins", () => {
    let capturedPlugins: any[] = [];
    const spy: PluginDefinition<{}> = {
      name: "spy",
      nodeKinds: [],
      build(ctx) {
        capturedPlugins = ctx.plugins;
        return {};
      },
    };
    const app = mvfm(num, semiring, spy);
    app(($) => $.add(1, 2));
    expect(capturedPlugins).toHaveLength(3);
    expect(capturedPlugins[0].name).toBe("num");
    expect(capturedPlugins[1].name).toBe("semiring");
    expect(capturedPlugins[2].name).toBe("spy");
  });

  it("inputSchema on PluginContext exposes runtime schema", () => {
    let capturedSchema: any;
    const spy: PluginDefinition<{}> = {
      name: "spy",
      nodeKinds: [],
      build(ctx) {
        capturedSchema = ctx.inputSchema;
        return {};
      },
    };
    const app = mvfm(num, semiring, spy);
    app({ x: "number" }, ($) => $.add($.input.x, 1));
    expect(capturedSchema).toEqual({ x: "number" });
  });

  it("traits field on PluginDefinition is accessible", () => {
    const p: PluginDefinition<{}> = {
      name: "test",
      nodeKinds: ["test/eq"],
      traits: { eq: { type: "number", nodeKinds: { eq: "test/eq" } } },
      build() {
        return {};
      },
    };
    expect(p.traits?.eq?.type).toBe("number");
    expect(p.traits?.eq?.nodeKinds.eq).toBe("test/eq");
  });
});
