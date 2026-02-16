import type { Interpreter, TypedNode } from "../../fold";
import { eval_, recurseScoped } from "../../fold";

// ---- Typed node interfaces ----------------------------------

interface ErrorTry extends TypedNode<unknown> {
  kind: "error/try";
  expr: TypedNode;
  catch?: { param: any; body: TypedNode };
  match?: { param: any; branches: Record<string, TypedNode> };
  finally?: TypedNode;
}

interface ErrorFail extends TypedNode<never> {
  kind: "error/fail";
  error: TypedNode;
}

interface ErrorAttempt extends TypedNode<{ ok: unknown; err: unknown }> {
  kind: "error/attempt";
  expr: TypedNode;
}

interface ErrorGuard extends TypedNode<void> {
  kind: "error/guard";
  condition: TypedNode<boolean>;
  error: TypedNode;
}

interface ErrorSettle extends TypedNode<{ fulfilled: unknown[]; rejected: unknown[] }> {
  kind: "error/settle";
  exprs: TypedNode[];
}

// ---- Interpreter map ----------------------------------------

/** Interpreter handlers for `error/` node kinds. */
export const errorInterpreter: Interpreter = {
  "error/try": async function* (node: ErrorTry) {
    try {
      return yield* eval_(node.expr);
    } catch (e) {
      if (node.catch) {
        return yield recurseScoped(node.catch.body, [{ paramId: node.catch.param.__id, value: e }]);
      }
      if (node.match) {
        const errObj = e as any;
        const key = typeof errObj === "string" ? errObj : (errObj?.code ?? errObj?.type ?? "_");
        const branch = node.match.branches[key] ?? node.match.branches._ ?? null;
        if (!branch) throw e;
        return yield recurseScoped(branch, [{ paramId: node.match.param.__id, value: e }]);
      }
      throw e;
    } finally {
      if (node.finally) {
        yield* eval_(node.finally);
      }
    }
  },

  "error/fail": async function* (node: ErrorFail) {
    throw yield* eval_(node.error);
  },

  "error/attempt": async function* (node: ErrorAttempt) {
    try {
      const ok = yield* eval_(node.expr);
      return { ok, err: null };
    } catch (e) {
      return { ok: null, err: e };
    }
  },

  "error/guard": async function* (node: ErrorGuard) {
    const condition = yield* eval_(node.condition);
    if (!condition) {
      throw yield* eval_(node.error);
    }
    return undefined;
  },

  "error/settle": async function* (node: ErrorSettle) {
    const fulfilled: unknown[] = [];
    const rejected: unknown[] = [];
    for (const expr of node.exprs) {
      try {
        fulfilled.push(yield* eval_(expr));
      } catch (e) {
        rejected.push(e);
      }
    }
    return { fulfilled, rejected };
  },
};
