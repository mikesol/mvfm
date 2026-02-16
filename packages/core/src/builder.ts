// ============================================================
// MVFM — Program builder (mvfm entry point)
// ============================================================

import { autoLift, isExpr, makeExprProxy } from "./proxy";
import type { InferSchema, SchemaShape } from "./schema";
import type {
  CoreDollar,
  Expr,
  FlattenPluginInputs,
  MergePlugins,
  Plugin,
  PluginContext,
  PluginDefinition,
  PluginInput,
  Program,
} from "./types";
import { isInternalNode, nextNodeId, simpleHash } from "./utils";

function resolvePlugin(plugin: Plugin): PluginDefinition<any, any> {
  return typeof plugin === "function" ? plugin() : plugin;
}

function flattenPluginInputs(inputs: readonly PluginInput[]): PluginDefinition<any, any>[] {
  const flattened: PluginDefinition<any, any>[] = [];
  for (const input of inputs) {
    if (Array.isArray(input)) {
      flattened.push(...flattenPluginInputs(input));
      continue;
    }
    flattened.push(resolvePlugin(input as Plugin));
  }
  return flattened;
}

/**
 * Create a mvfm program builder with the given plugins.
 *
 * Usage:
 *   `const serverless = mvfm(num, str, db('postgres://...'))`
 *   `const myProgram = serverless(($) => { ... })`
 */
export function mvfm<const P extends readonly PluginInput[]>(...plugins: P) {
  type FlatP = FlattenPluginInputs<P>;

  function define<S extends SchemaShape>(
    schema: S,
    fn: ($: CoreDollar<InferSchema<S>> & MergePlugins<FlatP>) => Expr<any> | any,
  ): Program;
  function define<I = never>(
    fn: ($: CoreDollar<I> & MergePlugins<FlatP>) => Expr<any> | any,
  ): Program;
  function define(schemaOrFn: SchemaShape | (($: any) => any), maybeFn?: ($: any) => any): Program {
    const schema = typeof schemaOrFn === "function" ? undefined : (schemaOrFn as SchemaShape);
    const fn = typeof schemaOrFn === "function" ? schemaOrFn : maybeFn!;

    const statements: any[] = [];
    const registry = new Map<number, any>();

    const resolvedPlugins = flattenPluginInputs(plugins);

    const ctx: PluginContext = {
      expr: <T>(node: any) => {
        const id = nextNodeId();
        node.__id = id;
        registry.set(id, node);
        return makeExprProxy<T>(node, ctx);
      },
      lift: <T>(value: T | Expr<T>) => autoLift(value, ctx.expr),
      isExpr,
      emit: (node: any) => statements.push(node),
      statements,
      _registry: registry,
      plugins: resolvedPlugins,
      inputSchema: schema,
    };

    const core: CoreDollar<any> = {
      input: makeExprProxy<any>({ kind: "core/input" }, ctx),

      cond(predicate: Expr<boolean>) {
        let thenNode: any = null;
        let elseNode: any = null;

        const makeResult = () => {
          if (thenNode && elseNode) {
            return makeExprProxy(
              {
                kind: "core/cond",
                predicate: predicate.__node,
                then: thenNode,
                else: elseNode,
              },
              ctx,
            );
          }
        };

        return {
          t: <T>(then: Expr<T> | T) => {
            thenNode = isExpr(then) ? then.__node : autoLift(then, ctx.expr).__node;
            return {
              f: <U>(els: Expr<U> | U) => {
                elseNode = isExpr(els) ? els.__node : autoLift(els, ctx.expr).__node;
                return makeResult()!;
              },
            };
          },
          f: <U>(els: Expr<U> | U) => {
            elseNode = isExpr(els) ? els.__node : autoLift(els, ctx.expr).__node;
            return {
              t: <T>(then: Expr<T> | T) => {
                thenNode = isExpr(then) ? then.__node : autoLift(then, ctx.expr).__node;
                return makeResult()!;
              },
            };
          },
        };
      },

      begin(first: Expr<any> | any, ...rest: (Expr<any> | any)[]) {
        const exprs = [first, ...rest];
        const nodes = exprs.map((e) => (isExpr(e) ? e.__node : autoLift(e, ctx.expr).__node));
        const steps = nodes.slice(0, -1);
        const result = nodes[nodes.length - 1];
        return makeExprProxy({ kind: "core/begin", steps, result }, ctx);
      },

      rec<T, R>(fn: (self: (arg: Expr<T> | T) => Expr<R>, param: Expr<T>) => Expr<R> | R): Expr<R> {
        const recId = `rec_${nextNodeId()}`;
        const paramNode: any = {
          kind: "core/lambda_param",
          name: "rec_param",
        };
        const paramProxy = makeExprProxy<T>(paramNode, ctx);

        const self = (arg: Expr<T> | T): Expr<R> => {
          const argNode = isExpr(arg) ? arg.__node : autoLift(arg, ctx.expr).__node;
          return makeExprProxy<R>({ kind: "core/rec_call", recId, arg: argNode }, ctx);
        };

        const result = fn(self, paramProxy);
        const bodyNode = isExpr(result) ? result.__node : autoLift(result, ctx.expr).__node;

        return makeExprProxy<R>(
          {
            kind: "core/rec",
            recId,
            param: paramNode,
            body: bodyNode,
          },
          ctx,
        );
      },
    };

    const pluginContributions = resolvedPlugins.reduce(
      (acc, plugin) => {
        const contribution = plugin.build(ctx);
        return { ...acc, ...contribution };
      },
      {} as Record<string, unknown>,
    );

    const dollar = {
      ...core,
      ...pluginContributions,
    } as CoreDollar<any> & MergePlugins<FlatP>;

    const result = fn(dollar);
    const resultNode = isExpr(result)
      ? (result as Expr<unknown>).__node
      : autoLift(result, ctx.expr).__node;

    const ast: any = {
      kind: "core/program",
      statements,
      result: resultNode,
    };

    // ---- Reachability analysis ----------------------------
    const reachableIds = new Set<number>();

    function walkNode(node: unknown): void {
      if (node === null || node === undefined) return;
      if (typeof node !== "object") return;

      if (Array.isArray(node)) {
        for (const item of node) walkNode(item);
        return;
      }

      const obj = node as Record<string, unknown>;

      if ("kind" in obj) {
        const astNode = obj as any;
        if (astNode.__id !== undefined) {
          if (reachableIds.has(astNode.__id)) return;
          reachableIds.add(astNode.__id);
        }
      }

      for (const [key, value] of Object.entries(obj)) {
        if (key === "__id") continue;
        walkNode(value);
      }
    }

    walkNode(ast);

    const orphans: any[] = [];
    for (const [id, node] of registry) {
      if (!reachableIds.has(id) && !isInternalNode(node)) {
        orphans.push(node);
      }
    }

    if (orphans.length > 0) {
      const details = orphans
        .map((n: any) => `  - ${n.kind}${n.sql ? `: ${n.sql}` : ""}${n.url ? `: ${n.url}` : ""}`)
        .join("\n");
      throw new Error(
        `Mvfm build error: ${orphans.length} unreachable node(s) detected.\n` +
          `These expressions were created but are not part of the return tree.\n` +
          `Wrap side effects in $.begin():\n\n` +
          `  return $.begin(\n` +
          `    $.db.exec('...'),  // side effect\n` +
          `    result             // return value\n` +
          `  )\n\n` +
          `Orphaned nodes:\n${details}`,
      );
    }

    const hash = simpleHash(
      JSON.stringify(ast, (key, value) => (key === "__id" || key === "recId" ? undefined : value)),
    );

    return {
      ast,
      hash,
      plugins: resolvedPlugins.map((p) => p.name),
      inputSchema: schema ?? {},
    };
  }

  return define;
}
