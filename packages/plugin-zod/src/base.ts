import type { Expr, PluginContext, TypedNode } from "@mvfm/core";
import { ZodSchemaBuilderCore } from "./base-core";
import type { WrapperASTNode } from "./types";

export abstract class ZodSchemaBuilder<T> extends ZodSchemaBuilderCore<T> {
  private _wrap<U>(wrapperKind: string, extra?: Record<string, unknown>): ZodWrappedBuilder<U> {
    const wrapperNode: WrapperASTNode = {
      kind: wrapperKind,
      inner: this.__schemaNode,
      ...extra,
    };
    return new ZodWrappedBuilder<U>(this._ctx, wrapperNode);
  }

  optional(): ZodWrappedBuilder<T | undefined> {
    return this._wrap<T | undefined>("zod/optional");
  }

  nonoptional(): ZodWrappedBuilder<NonNullable<T>> {
    return this._wrap<NonNullable<T>>("zod/nonoptional");
  }

  nullable(): ZodWrappedBuilder<T | null> {
    return this._wrap<T | null>("zod/nullable");
  }

  nullish(): ZodWrappedBuilder<T | null | undefined> {
    return this._wrap<T | null | undefined>("zod/nullish");
  }

  default(value: Expr<T> | T): ZodWrappedBuilder<T> {
    return this._wrap<T>("zod/default", { value: this._ctx.lift(value).__node });
  }

  prefault(value: Expr<T> | T): ZodWrappedBuilder<T> {
    return this._wrap<T>("zod/prefault", { value: this._ctx.lift(value).__node });
  }

  catch(value: Expr<T> | T): ZodWrappedBuilder<T> {
    return this._wrap<T>("zod/catch", { value: this._ctx.lift(value).__node });
  }

  readonly(): ZodWrappedBuilder<Readonly<T>> {
    return this._wrap<Readonly<T>>("zod/readonly");
  }

  brand<B extends string>(brand?: B): ZodWrappedBuilder<T & { __brand: B }> {
    return this._wrap<T & { __brand: B }>("zod/branded", brand ? { brand } : {});
  }

  transform<U>(fn: (val: Expr<T>) => Expr<U>): ZodWrappedBuilder<U> {
    const paramNode = { kind: "core/lambda_param", name: "transform_val" } as TypedNode;
    const paramProxy = this._ctx.expr<T>(paramNode);
    const result = fn(paramProxy);
    const bodyNode = this._ctx.isExpr(result) ? result.__node : paramNode;
    const wrapperNode: WrapperASTNode = {
      kind: "zod/transform",
      inner: this.__schemaNode,
      fn: { kind: "core/lambda", param: paramNode, body: bodyNode },
    };
    return new ZodWrappedBuilder<U>(this._ctx, wrapperNode);
  }

  pipe<U>(target: ZodSchemaBuilder<U>): ZodWrappedBuilder<U> {
    const wrapperNode: WrapperASTNode = {
      kind: "zod/pipe",
      inner: this.__schemaNode,
      target: target.__schemaNode,
    };
    return new ZodWrappedBuilder<U>(this._ctx, wrapperNode);
  }
}

export class ZodWrappedBuilder<T> extends ZodSchemaBuilder<T> {
  private readonly _wrapperNode: WrapperASTNode;

  constructor(ctx: PluginContext, wrapperNode: WrapperASTNode) {
    super(ctx, wrapperNode.kind);
    this._wrapperNode = wrapperNode;
  }

  protected _buildSchemaNode(): WrapperASTNode {
    return this._wrapperNode;
  }

  protected _clone(): ZodWrappedBuilder<T> {
    return new ZodWrappedBuilder<T>(this._ctx, this._wrapperNode);
  }
}
