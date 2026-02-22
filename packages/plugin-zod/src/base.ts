import type { CExpr } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { ZodSchemaBuilderCore } from "./base-core";
import type { WrapperASTNode } from "./types";

export abstract class ZodSchemaBuilder<T> extends ZodSchemaBuilderCore<T> {
  private _wrap<U>(wrapperKind: string, extra?: Record<string, unknown>): ZodWrappedBuilder<U> {
    const wrapperNode: WrapperASTNode = {
      kind: wrapperKind,
      inner: this.__schemaNode,
      ...extra,
    };
    return new ZodWrappedBuilder<U>(wrapperNode);
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

  default(value: unknown): ZodWrappedBuilder<T> {
    return this._wrap<T>("zod/default", { value });
  }

  prefault(value: unknown): ZodWrappedBuilder<T> {
    return this._wrap<T>("zod/prefault", { value });
  }

  catch(value: unknown): ZodWrappedBuilder<T> {
    return this._wrap<T>("zod/catch", { value });
  }

  readonly(): ZodWrappedBuilder<Readonly<T>> {
    return this._wrap<Readonly<T>>("zod/readonly");
  }

  brand<B extends string>(brand?: B): ZodWrappedBuilder<T & { __brand: B }> {
    return this._wrap<T & { __brand: B }>("zod/branded", brand ? { brand } : {});
  }

  transform<U>(fn: (val: CExpr<T>) => CExpr<U>): ZodWrappedBuilder<U> {
    const param = makeCExpr<T, "core/lambda_param", []>("core/lambda_param", []);
    const result = fn(param);
    const body = isCExpr(result) ? result : param;
    const wrapperNode: WrapperASTNode = {
      kind: "zod/transform",
      inner: this.__schemaNode,
      fn: { param, body },
    };
    return new ZodWrappedBuilder<U>(wrapperNode);
  }

  pipe<U>(target: ZodSchemaBuilder<U>): ZodWrappedBuilder<U> {
    const wrapperNode: WrapperASTNode = {
      kind: "zod/pipe",
      inner: this.__schemaNode,
      target: target.__schemaNode,
    };
    return new ZodWrappedBuilder<U>(wrapperNode);
  }
}

export class ZodWrappedBuilder<T> extends ZodSchemaBuilder<T> {
  private readonly _wrapperNode: WrapperASTNode;

  constructor(wrapperNode: WrapperASTNode) {
    super(wrapperNode.kind);
    this._wrapperNode = wrapperNode;
  }

  protected _buildSchemaNode(): WrapperASTNode {
    return this._wrapperNode;
  }

  protected _clone(): ZodWrappedBuilder<T> {
    return new ZodWrappedBuilder<T>(this._wrapperNode);
  }
}
