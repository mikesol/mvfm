// ============================================================
// MVFM PLUGIN: s3 (@aws-sdk/client-s3 compatible API) — unified Plugin
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// Implementation status: PARTIAL (5 of 108 commands)
//
// Implemented:
//   - putObject: upload an object
//   - getObject: download an object
//   - deleteObject: delete an object
//   - headObject: check existence / get metadata
//   - listObjectsV2: list objects in a bucket
//
// NO defaultInterpreter — requires createS3Interpreter(client) at runtime.
// ============================================================

import type {
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  GetObjectCommandInput,
  GetObjectCommandOutput,
  HeadObjectCommandInput,
  HeadObjectCommandOutput,
  ListObjectsV2CommandInput,
  ListObjectsV2CommandOutput,
  PutObjectCommandInput,
  PutObjectCommandOutput,
} from "@aws-sdk/client-s3";
import type { CExpr, KindSpec, Liftable, Plugin } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";

// ---- Plugin definition ------------------------------------

/**
 * The s3 plugin definition (unified Plugin type).
 *
 * This plugin has NO defaultInterpreter. You must provide one
 * via `defaults(plugins, { s3: createS3Interpreter(client) })`.
 *
 * Contributes `$.s3`.
 *
 * @example
 * ```ts
 * const $ = composeDollar(numPlugin, strPlugin, s3);
 * const expr = $.s3.putObject({ Bucket: "b", Key: "k", Body: "hello" });
 * const nexpr = app(expr);
 * const interp = defaults([numPlugin, strPlugin, s3], {
 *   s3: createS3Interpreter(myClient),
 * });
 * const result = await fold(nexpr, interp);
 * ```
 */
export const s3 = {
  name: "s3" as const,
  ctors: {
    s3: {
      /** Upload an object to S3. */
      putObject(
        input: Liftable<PutObjectCommandInput>,
      ): CExpr<PutObjectCommandOutput, "s3/put_object", [Liftable<PutObjectCommandInput>]> {
        return makeCExpr("s3/put_object", [input]) as any;
      },
      /** Download an object from S3. */
      getObject(
        input: Liftable<GetObjectCommandInput>,
      ): CExpr<GetObjectCommandOutput, "s3/get_object", [Liftable<GetObjectCommandInput>]> {
        return makeCExpr("s3/get_object", [input]) as any;
      },
      /** Delete an object from S3. */
      deleteObject(
        input: Liftable<DeleteObjectCommandInput>,
      ): CExpr<
        DeleteObjectCommandOutput,
        "s3/delete_object",
        [Liftable<DeleteObjectCommandInput>]
      > {
        return makeCExpr("s3/delete_object", [input]) as any;
      },
      /** Check existence and retrieve metadata for an object. */
      headObject(
        input: Liftable<HeadObjectCommandInput>,
      ): CExpr<HeadObjectCommandOutput, "s3/head_object", [Liftable<HeadObjectCommandInput>]> {
        return makeCExpr("s3/head_object", [input]) as any;
      },
      /** List objects in a bucket (v2). */
      listObjectsV2(
        input: Liftable<ListObjectsV2CommandInput>,
      ): CExpr<
        ListObjectsV2CommandOutput,
        "s3/list_objects_v2",
        [Liftable<ListObjectsV2CommandInput>]
      > {
        return makeCExpr("s3/list_objects_v2", [input]) as any;
      },
    },
  },
  kinds: {
    "s3/put_object": {
      inputs: [undefined as unknown as PutObjectCommandInput],
      output: undefined as unknown as PutObjectCommandOutput,
    } as KindSpec<[PutObjectCommandInput], PutObjectCommandOutput>,
    "s3/get_object": {
      inputs: [undefined as unknown as GetObjectCommandInput],
      output: undefined as unknown as GetObjectCommandOutput,
    } as KindSpec<[GetObjectCommandInput], GetObjectCommandOutput>,
    "s3/delete_object": {
      inputs: [undefined as unknown as DeleteObjectCommandInput],
      output: undefined as unknown as DeleteObjectCommandOutput,
    } as KindSpec<[DeleteObjectCommandInput], DeleteObjectCommandOutput>,
    "s3/head_object": {
      inputs: [undefined as unknown as HeadObjectCommandInput],
      output: undefined as unknown as HeadObjectCommandOutput,
    } as KindSpec<[HeadObjectCommandInput], HeadObjectCommandOutput>,
    "s3/list_objects_v2": {
      inputs: [undefined as unknown as ListObjectsV2CommandInput],
      output: undefined as unknown as ListObjectsV2CommandOutput,
    } as KindSpec<[ListObjectsV2CommandInput], ListObjectsV2CommandOutput>,
  },
  shapes: {
    "s3/put_object": "*",
    "s3/get_object": "*",
    "s3/delete_object": "*",
    "s3/head_object": "*",
    "s3/list_objects_v2": "*",
  },
  traits: {},
  lifts: {},
} satisfies Plugin;

/**
 * Alias for {@link s3}, kept for readability at call sites.
 */
export const s3Plugin = s3;
