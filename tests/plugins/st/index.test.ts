import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { num } from "../../../src/plugins/num";
import { semiring } from "../../../src/plugins/semiring";
import { st } from "../../../src/plugins/st";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

const app = mvfm(num, semiring, st);

describe("st: $.let()", () => {
  it("emits st/let statement and st/get returns proxy", () => {
    const prog = app(($) => {
      const x = $.let(0);
      return x.get();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.statements[0].kind).toBe("st/let");
    expect(ast.statements[0].initial.kind).toBe("core/literal");
    expect(ast.statements[0].initial.value).toBe(0);
    expect(ast.result.kind).toBe("st/get");
  });

  it("$.let().set() emits st/set statement", () => {
    const prog = app(($) => {
      const x = $.let(0);
      x.set($.add(x.get(), 1));
      return x.get();
    });
    const ast = strip(prog.ast) as any;
    const setStmt = ast.statements.find((s: any) => s.kind === "st/set");
    expect(setStmt).toBeDefined();
    expect(setStmt.value.kind).toBe("num/add");
  });

  it("$.let().push() emits st/push statement", () => {
    const prog = app(($) => {
      const arr = $.let([]);
      arr.push($.input.item);
      return arr.get();
    });
    const ast = strip(prog.ast) as any;
    const pushStmt = ast.statements.find((s: any) => s.kind === "st/push");
    expect(pushStmt).toBeDefined();
  });

  it("auto-lifts initial value", () => {
    const prog = app(($) => {
      const x = $.let("hello");
      return x.get();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.statements[0].initial.kind).toBe("core/literal");
    expect(ast.statements[0].initial.value).toBe("hello");
  });
});
