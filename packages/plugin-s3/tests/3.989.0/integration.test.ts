import {
  S3Client as AwsS3Client,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { coreInterpreter, mvfm, num, numInterpreter, str, strInterpreter } from "@mvfm/core";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { s3 as s3Plugin } from "../../src/3.989.0";
import { wrapAwsSdk } from "../../src/3.989.0/client-aws-sdk";
import { serverEvaluate } from "../../src/3.989.0/handler.server";
import { createS3Interpreter } from "../../src/3.989.0/interpreter";

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

let container: StartedTestContainer | undefined;
let awsClient: AwsS3Client | undefined;

const BUCKET = "test-bucket";

const commands: Record<string, new (input: any) => any> = {
  PutObject: PutObjectCommand,
  GetObject: GetObjectCommand,
  DeleteObject: DeleteObjectCommand,
  HeadObject: HeadObjectCommand,
  ListObjectsV2: ListObjectsV2Command,
};

const app = mvfm(num, str, s3Plugin({ region: "us-east-1" }));

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  if (!awsClient) {
    throw new Error("S3 test client was not initialized");
  }
  const ast = injectInput(prog.ast, input);
  const client = wrapAwsSdk(awsClient, commands);
  const baseInterpreter = {
    ...createS3Interpreter(client),
    ...coreInterpreter,
    ...numInterpreter,
    ...strInterpreter,
  };
  const evaluate = serverEvaluate(client, baseInterpreter);
  return await evaluate(ast.result);
}

beforeAll(async () => {
  const endpointFromEnv =
    process.env.MVFM_S3_ENDPOINT ?? process.env.AWS_ENDPOINT_URL_S3 ?? process.env.AWS_ENDPOINT_URL;
  let endpoint = endpointFromEnv;

  if (!endpoint) {
    container = await new GenericContainer("localstack/localstack:latest")
      .withExposedPorts(4566)
      .withEnvironment({ SERVICES: "s3" })
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(4566);
    endpoint = `http://${host}:${port}`;
  }

  awsClient = new AwsS3Client({
    region: "us-east-1",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
  });

  // Create the test bucket
  await awsClient.send(new CreateBucketCommand({ Bucket: BUCKET }));
}, 120000);

afterAll(async () => {
  awsClient?.destroy();
  if (container) {
    await container.stop();
  }
});

// ============================================================
// Object operations
// ============================================================

describe("s3 integration: putObject + getObject", () => {
  it("upload and download an object", async () => {
    // Put
    const putProg = app(($) =>
      $.s3.putObject({ Bucket: BUCKET, Key: "hello.txt", Body: "Hello, S3!" }),
    );
    const putResult = (await run(putProg)) as any;
    expect(putResult.ETag).toBeDefined();

    // Get
    const getProg = app(($) => $.s3.getObject({ Bucket: BUCKET, Key: "hello.txt" }));
    const getResult = (await run(getProg)) as any;
    expect(getResult.Body).toBe("Hello, S3!");
  });
});

describe("s3 integration: headObject", () => {
  it("get object metadata", async () => {
    // Ensure object exists
    await awsClient.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "meta.txt",
        Body: "metadata test",
      }),
    );

    const prog = app(($) => $.s3.headObject({ Bucket: BUCKET, Key: "meta.txt" }));
    const result = (await run(prog)) as any;
    expect(result.ContentLength).toBeGreaterThan(0);
  });
});

describe("s3 integration: deleteObject", () => {
  it("delete an object", async () => {
    // Create then delete
    await awsClient.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "to-delete.txt",
        Body: "delete me",
      }),
    );

    const prog = app(($) => $.s3.deleteObject({ Bucket: BUCKET, Key: "to-delete.txt" }));
    const result = await run(prog);
    expect(result).toBeDefined();
  });
});

describe("s3 integration: listObjectsV2", () => {
  it("list objects with prefix", async () => {
    // Create objects with a prefix
    await awsClient.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "list-test/a.txt",
        Body: "a",
      }),
    );
    await awsClient.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "list-test/b.txt",
        Body: "b",
      }),
    );

    const prog = app(($) => $.s3.listObjectsV2({ Bucket: BUCKET, Prefix: "list-test/" }));
    const result = (await run(prog)) as any;
    expect(result.Contents).toBeDefined();
    expect(result.Contents.length).toBeGreaterThanOrEqual(2);
    const keys = result.Contents.map((c: any) => c.Key);
    expect(keys).toContain("list-test/a.txt");
    expect(keys).toContain("list-test/b.txt");
  });
});

describe("s3 integration: input resolution", () => {
  it("resolves dynamic input values", async () => {
    await awsClient.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "dynamic.txt",
        Body: "dynamic content",
      }),
    );

    const prog = app({ key: "string" }, ($) =>
      $.s3.getObject({ Bucket: BUCKET, Key: $.input.key }),
    );
    const result = (await run(prog, { key: "dynamic.txt" })) as any;
    expect(result.Body).toBe("dynamic content");
  });
});
