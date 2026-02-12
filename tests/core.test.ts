import { describe, expect, it } from "vitest";
import { ilo } from "../src/core";
import { num } from "../src/plugins/num";
import { str } from "../src/plugins/str";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("core: $.do()", () => {
  const app = ilo(num, str);

  it("sequences side effects with last arg as return value", () => {
    const prog = app(($) => {
      const a = $.add(1, 2);
      const b = $.add(3, 4);
      return $.do(a, b);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
    expect(ast.result.steps).toHaveLength(1);
    expect(ast.result.steps[0].kind).toBe("num/add");
    expect(ast.result.result.kind).toBe("num/add");
  });

  it("works with a single expression (no steps)", () => {
    const prog = app(($) => {
      return $.do($.add(1, 2));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
    expect(ast.result.steps).toHaveLength(0);
    expect(ast.result.result.kind).toBe("num/add");
  });
});

describe("core: $.cond()", () => {
  const app = ilo(num);

  it("produces a core/cond node with both branches via .t().f()", () => {
    const prog = app(($) => {
      return $.cond($.eq($.input.x, 1)).t($.add(1, 2)).f($.add(3, 4));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/cond");
    expect(ast.result.then.kind).toBe("num/add");
    expect(ast.result.else.kind).toBe("num/add");
  });

  it("works with .f().t() order", () => {
    const prog = app(($) => {
      return $.cond($.eq($.input.x, 1)).f($.add(3, 4)).t($.add(1, 2));
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/cond");
    expect(ast.result.then.kind).toBe("num/add");
    expect(ast.result.else.kind).toBe("num/add");
  });

  it("auto-lifts raw values in branches", () => {
    const prog = app(($) => {
      return $.cond($.eq($.input.x, 1)).t("yes").f("no");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.then.kind).toBe("core/literal");
    expect(ast.result.then.value).toBe("yes");
    expect(ast.result.else.kind).toBe("core/literal");
    expect(ast.result.else.value).toBe("no");
  });
});

describe("core: $.eq()", () => {
  const app = ilo(num);

  it("$.eq produces core/eq", () => {
    const prog = app(($) => $.eq($.input.x, 1));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/eq");
    expect(ast.result.right.kind).toBe("core/literal");
    expect(ast.result.right.value).toBe(1);
  });
});

describe("core: auto-lifting", () => {
  const app = ilo(num);

  it("lifts raw numbers to core/literal", () => {
    const prog = app(($) => $.add(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.left.kind).toBe("core/literal");
    expect(ast.result.left.value).toBe(1);
    expect(ast.result.right.kind).toBe("core/literal");
    expect(ast.result.right.value).toBe(2);
  });

  it("lifts raw strings to core/literal", () => {
    const prog = app(($) => $.eq($.input.name, "alice"));
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
  const app = ilo();

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
  const app = ilo(num);

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
    const prog = app(($) => {
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
  const app = ilo(num, str);

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

  it("does not reject nodes inside $.do()", () => {
    expect(() => {
      app(($) => {
        const sideEffect = $.add(1, 2);
        const result = $.add(3, 4);
        return $.do(sideEffect, result);
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
  const app = ilo(num);

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
    const app = ilo(num, str);
    const prog = app(($) => $.add(1, 2));
    expect(prog.plugins).toEqual(["num", "str"]);
  });

  it("works with no plugins", () => {
    const app = ilo();
    const prog = app(($) => $.input.x);
    expect(prog.plugins).toEqual([]);
  });
});
