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
  DeleteObjectCommandOutput,
  GetObjectCommandOutput,
  HeadObjectCommandOutput,
  ListObjectsV2CommandOutput,
  PutObjectCommandOutput,
} from "@aws-sdk/client-s3";
import type { CExpr, KindSpec, Plugin } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";

// ---- liftArg: recursive plain-value -> CExpr lifting --------

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives are returned as-is (elaborate lifts them).
 * - Plain objects become `s3/record` CExprs with key-value child pairs.
 * - Arrays become `s3/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("s3/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("s3/record", pairs);
  }
  return value;
}

// liftArg erases generic type info at runtime (returns unknown).
// Cast helpers restore the declared CExpr Args types for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

// ---- Configuration ----------------------------------------

/**
 * Configuration for the s3 plugin.
 *
 * Requires a region. Optionally accepts credentials, a custom
 * endpoint (for S3-compatible services like MinIO/LocalStack),
 * and forcePathStyle for local development.
 */
export interface S3Config {
  /** AWS region (e.g. `us-east-1`). */
  region: string;
  /** AWS credentials. If omitted, the SDK uses default credential resolution. */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  /** Custom endpoint URL for S3-compatible services (e.g. LocalStack, MinIO). */
  endpoint?: string;
  /** Use path-style addressing (required for LocalStack/MinIO). */
  forcePathStyle?: boolean;
}

// ---- Plugin factory ---------------------------------------

/**
 * Creates the s3 plugin definition (unified Plugin type).
 *
 * This plugin has NO defaultInterpreter. You must provide one
 * via `defaults(plugins, { s3: createS3Interpreter(client) })`.
 *
 * @param _config - An {@link S3Config} with region and optional credentials.
 *   Config is captured by the interpreter, not stored on AST nodes.
 * @returns A unified Plugin that contributes `$.s3`.
 *
 * @example
 * ```ts
 * const plugin = s3({ region: "us-east-1" });
 * const $ = composeDollar(numPlugin, strPlugin, plugin);
 * const expr = $.s3.putObject({ Bucket: "b", Key: "k", Body: "hello" });
 * const nexpr = app(expr);
 * const interp = defaults([numPlugin, strPlugin, plugin], {
 *   s3: createS3Interpreter(myClient),
 * });
 * const result = await fold(nexpr, interp);
 * ```
 */
export function s3(_config: S3Config) {
  return {
    name: "s3" as const,
    ctors: {
      s3: {
        /** Upload an object to S3. */
        putObject<A>(input: A): CExpr<PutObjectCommandOutput, "s3/put_object", [A]> {
          return mk("s3/put_object", [liftArg(input)]);
        },
        /** Download an object from S3. */
        getObject<A>(input: A): CExpr<GetObjectCommandOutput, "s3/get_object", [A]> {
          return mk("s3/get_object", [liftArg(input)]);
        },
        /** Delete an object from S3. */
        deleteObject<A>(input: A): CExpr<DeleteObjectCommandOutput, "s3/delete_object", [A]> {
          return mk("s3/delete_object", [liftArg(input)]);
        },
        /** Check existence and retrieve metadata for an object. */
        headObject<A>(input: A): CExpr<HeadObjectCommandOutput, "s3/head_object", [A]> {
          return mk("s3/head_object", [liftArg(input)]);
        },
        /** List objects in a bucket (v2). */
        listObjectsV2<A>(input: A): CExpr<ListObjectsV2CommandOutput, "s3/list_objects_v2", [A]> {
          return mk("s3/list_objects_v2", [liftArg(input)]);
        },
      },
    },
    kinds: {
      "s3/put_object": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "s3/get_object": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "s3/delete_object": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "s3/head_object": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "s3/list_objects_v2": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "s3/record": {
        inputs: [] as unknown[],
        output: {} as Record<string, unknown>,
      } as KindSpec<unknown[], Record<string, unknown>>,
      "s3/array": {
        inputs: [] as unknown[],
        output: [] as unknown[],
      } as KindSpec<unknown[], unknown[]>,
    },
    traits: {},
    lifts: {},
  } satisfies Plugin;
}

/**
 * Alias for {@link s3}, kept for readability at call sites.
 */
export const s3Plugin = s3;
