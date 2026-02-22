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
import type { CExpr, KindSpec } from "@mvfm/core";
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

// ---- What the plugin adds to $ ----------------------------

type PutObjectInput = PutObjectCommandInput;
type PutObjectResult = PutObjectCommandOutput;
type GetObjectInput = GetObjectCommandInput;
type GetObjectResult = GetObjectCommandOutput;
type DeleteObjectInput = DeleteObjectCommandInput;
type DeleteObjectResult = DeleteObjectCommandOutput;
type HeadObjectInput = HeadObjectCommandInput;
type HeadObjectResult = HeadObjectCommandOutput;
type ListObjectsV2Input = ListObjectsV2CommandInput;
type ListObjectsV2Result = ListObjectsV2CommandOutput;

/**
 * S3 operations added to the DSL context by the s3 plugin.
 *
 * Mirrors the high-level `S3` aggregated client from
 * `@aws-sdk/client-s3` v3.989.0: putObject, getObject,
 * deleteObject, headObject, listObjectsV2.
 */
export interface S3Methods {
  /** S3 operations, namespaced under `$.s3`. */
  s3: {
    /** Upload an object to S3. */
    putObject(input: CExpr<PutObjectInput> | PutObjectInput): CExpr<PutObjectResult>;
    /** Download an object from S3. */
    getObject(input: CExpr<GetObjectInput> | GetObjectInput): CExpr<GetObjectResult>;
    /** Delete an object from S3. */
    deleteObject(input: CExpr<DeleteObjectInput> | DeleteObjectInput): CExpr<DeleteObjectResult>;
    /** Check existence and retrieve metadata for an object. */
    headObject(input: CExpr<HeadObjectInput> | HeadObjectInput): CExpr<HeadObjectResult>;
    /** List objects in a bucket (v2). */
    listObjectsV2(
      input: CExpr<ListObjectsV2Input> | ListObjectsV2Input,
    ): CExpr<ListObjectsV2Result>;
  };
}

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

// ---- Node kinds -------------------------------------------

function buildKinds(): Record<string, KindSpec<any, any>> {
  return {
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
  };
}

// ---- Constructor builder ----------------------------------

function buildS3Api(): S3Methods["s3"] {
  return {
    putObject(input) {
      return makeCExpr("s3/put_object", [liftArg(input)]);
    },
    getObject(input) {
      return makeCExpr("s3/get_object", [liftArg(input)]);
    },
    deleteObject(input) {
      return makeCExpr("s3/delete_object", [liftArg(input)]);
    },
    headObject(input) {
      return makeCExpr("s3/head_object", [liftArg(input)]);
    },
    listObjectsV2(input) {
      return makeCExpr("s3/list_objects_v2", [liftArg(input)]);
    },
  };
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
 * const $ = mvfmU(numPluginU, strPluginU, plugin);
 * const expr = $.s3.putObject({ Bucket: "b", Key: "k", Body: "hello" });
 * const nexpr = app(expr);
 * const interp = defaults([numPluginU, strPluginU, plugin], {
 *   s3: createS3Interpreter(myClient),
 * });
 * const result = await fold(nexpr, interp);
 * ```
 */
export function s3(_config: S3Config) {
  return {
    name: "s3" as const,
    ctors: { s3: buildS3Api() },
    kinds: buildKinds(),
    traits: {},
    lifts: {},
  };
}

/**
 * Alias for {@link s3}, kept for readability at call sites.
 */
export const s3Plugin = s3;
