import { describe, expect, it } from "vitest";
import type {
  ASTNode,
  InterpreterFragment,
  LegacyInterpreterFragment,
  Step,
  StepContext,
  StepEffect,
  StepHandler,
} from "../src/core";
import { adaptLegacy, foldAST, runAST, Stepper } from "../src/core";

// ---- Helpers ---------------------------------------------------

/** A minimal generator fragment for core nodes (literal, add, input, prop_access, cond, do, record). */
function makeCoreGenFragment(): InterpreterFragment {
  return {
    pluginName: "core",
    canHandle: (node) => node.kind.startsWith("core/"),
    *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
      switch (node.kind) {
        case "core/literal":
          return node.value;
        case "core/input":
          return (node as any).__inputData;
        case "core/prop_access": {
          const obj = yield { type: "recurse", child: node.object as ASTNode };
          return (obj as Record<string, unknown>)[node.property as string];
        }
        case "core/cond": {
          const pred = yield { type: "recurse", child: node.predicate as ASTNode };
          if (pred) {
            return yield { type: "recurse", child: node.then as ASTNode };
          }
          return yield { type: "recurse", child: node.else as ASTNode };
        }
        case "core/do": {
          const steps = node.steps as ASTNode[];
          for (const step of steps) {
            yield { type: "recurse", child: step };
          }
          return yield { type: "recurse", child: node.result as ASTNode };
        }
        case "core/program":
          return yield { type: "recurse", child: node.result as ASTNode };
        case "core/record": {
          const fields = node.fields as Record<string, ASTNode>;
          const result: Record<string, unknown> = {};
          for (const [key, fieldNode] of Object.entries(fields)) {
            result[key] = yield { type: "recurse", child: fieldNode };
          }
          return result;
        }
        case "core/lambda_param":
          return (node as any).__value;
        default:
          throw new Error(`Unknown core node: ${node.kind}`);
      }
    },
    isVolatile: (node) => node.kind === "core/lambda_param",
  };
}

/** A minimal generator fragment for num nodes. */
function makeNumGenFragment(): InterpreterFragment {
  return {
    pluginName: "num",
    canHandle: (node) => node.kind.startsWith("num/"),
    *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
      switch (node.kind) {
        case "num/add": {
          const left = (yield { type: "recurse", child: node.left as ASTNode }) as number;
          const right = (yield { type: "recurse", child: node.right as ASTNode }) as number;
          return left + right;
        }
        case "num/sub": {
          const left = (yield { type: "recurse", child: node.left as ASTNode }) as number;
          const right = (yield { type: "recurse", child: node.right as ASTNode }) as number;
          return left - right;
        }
        default:
          throw new Error(`Unknown num node: ${node.kind}`);
      }
    },
  };
}

/** A fragment that yields a custom "query" IO effect. */
function makeQueryGenFragment(): InterpreterFragment {
  return {
    pluginName: "db",
    canHandle: (node) => node.kind === "db/query",
    *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
      const result = yield { type: "query", sql: node.sql as string };
      return result;
    },
  };
}

// ---- Test Suite ---------------------------------------------------

describe("Step types: compile-time validation", () => {
  it("StepEffect discriminated union compiles", () => {
    const recurse: StepEffect = { type: "recurse", child: { kind: "core/literal", value: 1 } };
    const custom: StepEffect = { type: "query", sql: "SELECT 1" };
    expect(recurse.type).toBe("recurse");
    expect(custom.type).toBe("query");
  });

  it("StepContext has required fields", () => {
    const ctx: StepContext = { depth: 0, path: ["core/program"] };
    expect(ctx.depth).toBe(0);
    expect(ctx.path).toEqual(["core/program"]);
    expect(ctx.parentNode).toBeUndefined();
  });

  it("Step<S> done=true carries value and state", () => {
    const step: Step<number> = { done: true, value: 42, state: 0 };
    expect(step.done).toBe(true);
    if (step.done) {
      expect(step.value).toBe(42);
      expect(step.state).toBe(0);
    }
  });

  it("Step<S> done=false carries effect, context, state", () => {
    const step: Step<string> = {
      done: false,
      node: { kind: "db/query", sql: "SELECT 1" },
      effect: { type: "query", sql: "SELECT 1" },
      context: { depth: 1, path: ["core/program", "db/query"] },
      state: "initial",
    };
    expect(step.done).toBe(false);
    if (!step.done) {
      expect(step.effect.type).toBe("query");
      expect(step.state).toBe("initial");
    }
  });

  it("StepHandler<S> signature compiles", () => {
    const handler: StepHandler<number> = async (_effect, _ctx, state) => {
      return { value: "result", state: state + 1 };
    };
    expect(typeof handler).toBe("function");
  });
});

describe("adaptLegacy", () => {
  it("wraps a legacy fragment and yields a __legacy effect", () => {
    const legacy: LegacyInterpreterFragment = {
      pluginName: "test",
      canHandle: (node) => node.kind === "test/op",
      async visit(node, recurse) {
        const child = await recurse(node.child as ASTNode);
        return (child as number) * 2;
      },
    };

    const adapted = adaptLegacy(legacy);
    expect(adapted.pluginName).toBe("test");
    expect(adapted.canHandle({ kind: "test/op" })).toBe(true);
    expect(adapted.canHandle({ kind: "other/op" })).toBe(false);

    // The generator should yield exactly one __legacy effect
    const gen = adapted.visit({ kind: "test/op", child: { kind: "core/literal", value: 5 } });
    const first = gen.next();
    expect(first.done).toBe(false);
    expect((first.value as StepEffect).type).toBe("__legacy");
    expect((first.value as any).fragment).toBe(legacy);

    // Feed back a result — generator should return it
    const second = gen.next(42);
    expect(second.done).toBe(true);
    expect(second.value).toBe(42);
  });
});

describe("Stepper", () => {
  it("evaluates a literal (immediate done)", () => {
    const fragments = [makeCoreGenFragment()];
    const stepper = new Stepper(fragments, { kind: "core/literal", value: 42 });
    const step = stepper.tick();
    expect(step).not.toBeNull();
    expect(step!.done).toBe(true);
    if (step!.done) {
      expect(step!.value).toBe(42);
    }
  });

  it("evaluates num/add with recurse into children", () => {
    const fragments = [makeCoreGenFragment(), makeNumGenFragment()];
    const ast: ASTNode = {
      kind: "num/add",
      left: { kind: "core/literal", value: 3 },
      right: { kind: "core/literal", value: 4 },
    };
    const stepper = new Stepper(fragments, ast);
    const step = stepper.tick();
    expect(step).not.toBeNull();
    expect(step!.done).toBe(true);
    if (step!.done) {
      expect(step!.value).toBe(7);
    }
  });

  it("yields IO effects for external handling", () => {
    const fragments = [makeCoreGenFragment(), makeQueryGenFragment()];
    const ast: ASTNode = { kind: "db/query", sql: "SELECT 1" };
    const stepper = new Stepper(fragments, ast);

    // First tick should yield the query effect
    const step = stepper.tick();
    expect(step).not.toBeNull();
    expect(step!.done).toBe(false);
    if (!step!.done) {
      expect(step!.effect.type).toBe("query");
      expect((step!.effect as any).sql).toBe("SELECT 1");
    }

    // Feed back the result of the query
    const step2 = stepper.tick([{ count: 42 }]);
    expect(step2).not.toBeNull();
    expect(step2!.done).toBe(true);
    if (step2!.done) {
      expect(step2!.value).toEqual([{ count: 42 }]);
    }
  });

  it("tracks context (depth, path)", () => {
    const fragments = [makeCoreGenFragment(), makeQueryGenFragment()];
    // core/do -> db/query (the query is inside a do block)
    const queryNode: ASTNode = { kind: "db/query", sql: "SELECT 1" };
    const ast: ASTNode = {
      kind: "core/do",
      steps: [],
      result: queryNode,
    };

    const stepper = new Stepper(fragments, ast);
    const step = stepper.tick();
    // The stepper auto-recurses into the child, so we see the IO effect
    expect(step).not.toBeNull();
    expect(step!.done).toBe(false);
    if (!step!.done) {
      expect(step!.effect.type).toBe("query");
      // Context should show the path through the stack
      expect(step!.context.path.length).toBeGreaterThanOrEqual(1);
      expect(step!.context.depth).toBeGreaterThanOrEqual(0);
    }
  });

  it("fresh() creates a new stepper with empty cache", () => {
    const fragments = [makeCoreGenFragment()];
    const ast: ASTNode = { kind: "core/literal", value: 99 };
    const stepper = new Stepper(fragments, ast);
    stepper.tick(); // Evaluate once

    const fresh = stepper.fresh(ast);
    const step = fresh.tick();
    expect(step).not.toBeNull();
    expect(step!.done).toBe(true);
    if (step!.done) {
      expect(step!.value).toBe(99);
    }
  });
});

describe("runAST", () => {
  it("auto-recurse + handler delegation", async () => {
    const fragments = [makeCoreGenFragment(), makeNumGenFragment(), makeQueryGenFragment()];
    // A program: add(literal(3), literal(4))
    const ast: ASTNode = {
      kind: "num/add",
      left: { kind: "core/literal", value: 10 },
      right: { kind: "core/literal", value: 20 },
    };

    const handler: StepHandler<null> = async () => {
      throw new Error("Should not be called — no IO effects");
    };

    const result = await runAST(ast, fragments, handler, null);
    expect(result.value).toBe(30);
    expect(result.state).toBeNull();
  });

  it("state threading through IO effects", async () => {
    const fragments = [makeCoreGenFragment(), makeQueryGenFragment()];
    const ast: ASTNode = { kind: "db/query", sql: "SELECT count(*) FROM users" };

    let callCount = 0;
    const handler: StepHandler<number> = async (effect, _ctx, state) => {
      callCount++;
      expect(effect.type).toBe("query");
      expect((effect as any).sql).toBe("SELECT count(*) FROM users");
      return { value: [{ count: 42 }], state: state + 1 };
    };

    const result = await runAST(ast, fragments, handler, 0);
    expect(result.value).toEqual([{ count: 42 }]);
    expect(result.state).toBe(1);
    expect(callCount).toBe(1);
  });

  it("handles __legacy effects from adapted fragments", async () => {
    const legacy: LegacyInterpreterFragment = {
      pluginName: "test",
      canHandle: (node) => node.kind === "test/double",
      async visit(node, recurse) {
        const child = await recurse(node.child as ASTNode);
        return (child as number) * 2;
      },
    };
    const adapted = adaptLegacy(legacy);
    const fragments = [makeCoreGenFragment(), adapted];

    const ast: ASTNode = {
      kind: "test/double",
      child: { kind: "core/literal", value: 21 },
    };

    const handler: StepHandler<null> = async () => {
      throw new Error("Should not be called");
    };

    const result = await runAST(ast, fragments, handler, null);
    expect(result.value).toBe(42);
  });
});

describe("foldAST", () => {
  it("returns a RecurseFn that evaluates AST nodes", async () => {
    const fragments = [makeCoreGenFragment(), makeNumGenFragment()];
    const recurse = foldAST(fragments, {});

    const ast: ASTNode = {
      kind: "num/add",
      left: { kind: "core/literal", value: 5 },
      right: { kind: "core/literal", value: 7 },
    };

    const result = await recurse(ast);
    expect(result).toBe(12);
  });

  it("has fresh() method", async () => {
    const fragments = [makeCoreGenFragment(), makeNumGenFragment()];
    const recurse = foldAST(fragments, {});

    const ast: ASTNode = {
      kind: "num/add",
      left: { kind: "core/literal", value: 1 },
      right: { kind: "core/literal", value: 2 },
    };

    const result1 = await recurse(ast);
    expect(result1).toBe(3);

    // fresh() should create a new RecurseFn with empty cache
    const freshRecurse = recurse.fresh();
    const result2 = await freshRecurse(ast);
    expect(result2).toBe(3);
  });

  it("delegates IO effects to handlers map", async () => {
    const fragments = [makeCoreGenFragment(), makeQueryGenFragment()];
    const recurse = foldAST(fragments, {
      query: async (effect) => {
        expect((effect as any).sql).toBe("SELECT 1");
        return [{ result: 1 }];
      },
    });

    const ast: ASTNode = { kind: "db/query", sql: "SELECT 1" };
    const result = await recurse(ast);
    expect(result).toEqual([{ result: 1 }]);
  });

  it("handles adapted legacy fragments", async () => {
    const legacy: LegacyInterpreterFragment = {
      pluginName: "test",
      canHandle: (node) => node.kind === "test/triple",
      async visit(node, recurse) {
        const child = await recurse(node.child as ASTNode);
        return (child as number) * 3;
      },
    };
    const adapted = adaptLegacy(legacy);
    const fragments = [makeCoreGenFragment(), adapted];
    const recurse = foldAST(fragments, {});

    const ast: ASTNode = {
      kind: "test/triple",
      child: { kind: "core/literal", value: 10 },
    };

    const result = await recurse(ast);
    expect(result).toBe(30);
  });

  it("caches shared nodes (DAG deduplication)", async () => {
    let evalCount = 0;
    // Use adaptLegacy to wrap a legacy counter fragment, avoiding biome's
    // useYield lint for generator functions that don't need to yield.
    const countingLiteral = adaptLegacy({
      pluginName: "core",
      canHandle: (node: ASTNode) => node.kind === "core/literal",
      async visit(node: ASTNode) {
        evalCount++;
        return node.value;
      },
    });

    const fragments = [countingLiteral, makeNumGenFragment()];
    const recurse = foldAST(fragments, {});

    // Shared node — should only be evaluated once
    const shared: ASTNode = { kind: "core/literal", value: 5 };
    const ast: ASTNode = {
      kind: "num/add",
      left: shared,
      right: shared,
    };

    const result = await recurse(ast);
    expect(result).toBe(10);
    expect(evalCount).toBe(1); // Shared node evaluated only once
  });
});

describe("composeInterpreters: backward compat with generator fragments", () => {
  it("accepts generator fragments alongside legacy fragments", async () => {
    // Import the actual composeInterpreters
    const { composeInterpreters } = await import("../src/core");
    const coreGen = makeCoreGenFragment();
    const numGen = makeNumGenFragment();

    const recurse = composeInterpreters([coreGen, numGen]);

    const ast: ASTNode = {
      kind: "num/add",
      left: { kind: "core/literal", value: 100 },
      right: { kind: "core/literal", value: 200 },
    };

    const result = await recurse(ast);
    expect(result).toBe(300);
  });

  it("mixes legacy and generator fragments", async () => {
    const { composeInterpreters } = await import("../src/core");
    const { coreInterpreter } = await import("../src/interpreters/core");
    const numGen = makeNumGenFragment();

    // coreInterpreter is legacy, numGen is generator
    const recurse = composeInterpreters([coreInterpreter, numGen]);

    const ast: ASTNode = {
      kind: "num/add",
      left: { kind: "core/literal", value: 7 },
      right: { kind: "core/literal", value: 8 },
    };

    const result = await recurse(ast);
    expect(result).toBe(15);
  });
});
