import { describe, expect, it } from "vitest";
import { ilo } from "../../src/core";
import { control } from "../../src/plugins/control";
import { num } from "../../src/plugins/num";
import { st } from "../../src/plugins/st";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("control: $.each()", () => {
  const app = ilo(num, st, control);

  it("produces control/each with collection and body", () => {
    const prog = app(($) => {
      const sum = $.let(0);
      $.each($.input.items, (item: any) => {
        sum.set($.add(sum.get(), item.value));
      });
      return sum.get();
    });
    const ast = strip(prog.ast) as any;
    const eachNode = ast.statements.find((s: any) => s.kind === "control/each");
    expect(eachNode).toBeDefined();
    expect(eachNode.param.kind).toBe("core/lambda_param");
    expect(eachNode.body).toHaveLength(1);
  });
});

describe("control: $.while()", () => {
  const app = ilo(num, st, control);

  it("produces control/while with condition and body", () => {
    const prog = app(($) => {
      const counter = $.let(0);
      $.while($.lt(counter.get(), 10)).body(counter.set($.add(counter.get(), 1)));
      return counter.get();
    });
    const ast = strip(prog.ast) as any;
    const whileNode = ast.statements.find((s: any) => s.kind === "control/while");
    expect(whileNode).toBeDefined();
    expect(whileNode.condition.kind).toBe("num/lt");
  });
});
