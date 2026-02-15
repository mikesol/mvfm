// ============================================================
// ILO PLUGIN: s3 (@aws-sdk/client-s3 compatible API)
// ============================================================
//
// Implementation status: PARTIAL (5 of 108 commands)
// Plugin size: LARGE — at pass 1 of 60/30/10 split (5 of 108 commands)
//
// Implemented:
//   - putObject: upload an object
//   - getObject: download an object
//   - deleteObject: delete an object
//   - headObject: check existence / get metadata
//   - listObjectsV2: list objects in a bucket
//
// Not doable (fundamental mismatch with AST model):
//   - SelectObjectContent: event stream output (push-based)
//   - Multipart upload as a workflow: stateful multi-step loop
//
// Remaining (same command pattern, add as needed):
//   CopyObject, DeleteObjects, RenameObject, GetObjectAttributes,
//   GetObjectTagging, PutObjectTagging, DeleteObjectTagging,
//   CreateBucket, DeleteBucket, HeadBucket, ListBuckets,
//   and 80+ bucket configuration commands (lifecycle, CORS,
//   encryption, versioning, etc.).
//
//   Each command follows the same pattern: add node kind,
//   add method to S3Methods, add switch case to interpreter.
//   The interpreter/handler architecture does not need to
//   change — s3/command covers everything.
//
// ============================================================
//
// Goal: An LLM that knows @aws-sdk/client-s3 should be able
// to write Ilo programs with near-zero learning curve. The API
// mirrors the high-level S3 aggregated client (method calls
// with PascalCase input objects).
//
// Real @aws-sdk/client-s3 API (v3.989.0):
//   const s3 = new S3({ region: 'us-east-1' })
//   await s3.putObject({ Bucket: 'b', Key: 'k', Body: 'hello' })
//   const obj = await s3.getObject({ Bucket: 'b', Key: 'k' })
//   await s3.deleteObject({ Bucket: 'b', Key: 'k' })
//   const head = await s3.headObject({ Bucket: 'b', Key: 'k' })
//   const list = await s3.listObjectsV2({ Bucket: 'b', Prefix: 'uploads/' })
//
// Based on source-level analysis of aws-sdk-js-v3
// (github.com/aws/aws-sdk-js-v3, clients/client-s3).
// The SDK uses Smithy-generated Command classes dispatched
// via client.send(). The S3 aggregated class wraps these
// as convenience methods via createAggregatedClient().
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

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
    /**
     * Upload an object to S3.
     *
     * @param input - PutObject input (Bucket, Key, Body required).
     * @returns The PutObject response (ETag, VersionId, etc.).
     */
    putObject(
      input: Expr<Record<string, unknown>> | Record<string, unknown>,
    ): Expr<Record<string, unknown>>;

    /**
     * Download an object from S3.
     *
     * @param input - GetObject input (Bucket, Key required).
     * @returns The GetObject response (Body as string, ContentType, etc.).
     */
    getObject(
      input: Expr<Record<string, unknown>> | Record<string, unknown>,
    ): Expr<Record<string, unknown>>;

    /**
     * Delete an object from S3.
     *
     * @param input - DeleteObject input (Bucket, Key required).
     * @returns The DeleteObject response (DeleteMarker, VersionId, etc.).
     */
    deleteObject(
      input: Expr<Record<string, unknown>> | Record<string, unknown>,
    ): Expr<Record<string, unknown>>;

    /**
     * Check existence and retrieve metadata for an object.
     *
     * @param input - HeadObject input (Bucket, Key required).
     * @returns The HeadObject response (ContentLength, ContentType, etc.).
     */
    headObject(
      input: Expr<Record<string, unknown>> | Record<string, unknown>,
    ): Expr<Record<string, unknown>>;

    /**
     * List objects in a bucket (v2).
     *
     * @param input - ListObjectsV2 input (Bucket required, Prefix optional).
     * @returns The ListObjectsV2 response (Contents, IsTruncated, etc.).
     */
    listObjectsV2(
      input: Expr<Record<string, unknown>> | Record<string, unknown>,
    ): Expr<Record<string, unknown>>;
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

// ---- Plugin implementation --------------------------------

/**
 * S3 plugin factory. Namespace: `s3/`.
 *
 * Creates a plugin that exposes S3 object operations for building
 * parameterized S3 command AST nodes.
 *
 * @param config - An {@link S3Config} with region and optional credentials.
 * @returns A {@link PluginDefinition} for the s3 plugin.
 *
 * @example
 * ```ts
 * const app = ilo(num, str, s3({ region: "us-east-1" }));
 * const prog = app(($) => $.s3.putObject({ Bucket: "b", Key: "k", Body: "hello" }));
 * ```
 */
export function s3(config: S3Config): PluginDefinition<S3Methods> {
  return {
    name: "s3",
    nodeKinds: [
      "s3/put_object",
      "s3/get_object",
      "s3/delete_object",
      "s3/head_object",
      "s3/list_objects_v2",
    ],

    build(ctx: PluginContext): S3Methods {
      function resolveInput(input: Expr<Record<string, unknown>> | Record<string, unknown>) {
        return ctx.lift(input).__node;
      }

      return {
        s3: {
          putObject(input) {
            return ctx.expr({
              kind: "s3/put_object",
              input: resolveInput(input),
              config,
            });
          },

          getObject(input) {
            return ctx.expr({
              kind: "s3/get_object",
              input: resolveInput(input),
              config,
            });
          },

          deleteObject(input) {
            return ctx.expr({
              kind: "s3/delete_object",
              input: resolveInput(input),
              config,
            });
          },

          headObject(input) {
            return ctx.expr({
              kind: "s3/head_object",
              input: resolveInput(input),
              config,
            });
          },

          listObjectsV2(input) {
            return ctx.expr({
              kind: "s3/list_objects_v2",
              input: resolveInput(input),
              config,
            });
          },
        },
      };
    },
  };
}

// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Basic object operations:
//    Real:  await s3.putObject({ Bucket: 'b', Key: 'k', Body: 'hello' })
//    Ilo:   $.s3.putObject({ Bucket: 'b', Key: 'k', Body: 'hello' })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Parameterized operations with proxy values:
//    const list = $.s3.listObjectsV2({ Bucket: $.input.bucket })
//    const head = $.s3.headObject({ Bucket: $.input.bucket, Key: list.Contents[0].Key })
//    Proxy chains capture the dependency graph perfectly.
//
// 3. Method and parameter naming:
//    Real:  s3.putObject({ Bucket, Key, Body, ContentType, Metadata })
//    Ilo:   $.s3.putObject({ Bucket, Key, Body, ContentType, Metadata })
//    1:1 match. PascalCase params, camelCase methods.
//
// WORKS BUT DIFFERENT:
//
// 4. GetObject Body:
//    Real:  const body = await response.Body.transformToString()
//    Ilo:   const body = result.Body  (already a string)
//    The handler converts the stream to string before returning.
//    More ergonomic but different from the real SDK.
//
// 5. Return types:
//    Real SDK has typed CommandOutput interfaces (PutObjectOutput, etc.)
//    Ilo uses Record<string, unknown>. Property access works via proxy.
//
// DOESN'T WORK / NOT MODELED:
//
// 6. SelectObjectContent: Event stream, not request-response.
// 7. Multipart upload workflow: Stateful multi-step.
// 8. Presigned URLs: Utility function, not a command.
// 9. Waiters: waitUntilObjectExists — polling-based.
//
// SUMMARY:
// For the core 80% use case of "put/get/delete/head/list objects"
// — nearly identical to the real @aws-sdk/client-s3 high-level API.
// An LLM trained on the real SDK can write ilo S3 programs immediately.
// Not supported: streaming, multipart, presigned URLs, waiters.
// ============================================================
