import {
  S3Client as AwsS3Client,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { s3 as s3Factory } from "../../src/3.989.0";
import { wrapAwsSdk } from "../../src/3.989.0/client-aws-sdk";
import { createS3Interpreter } from "../../src/3.989.0/interpreter";

let container: StartedTestContainer | undefined;
let awsClient: AwsS3Client | undefined;

const BUCKET = "test-bucket";

const commands: Record<string, new (input: unknown) => unknown> = {
  PutObject: PutObjectCommand,
  GetObject: GetObjectCommand,
  DeleteObject: DeleteObjectCommand,
  HeadObject: HeadObjectCommand,
  ListObjectsV2: ListObjectsV2Command,
};

const plugin = s3Factory({ region: "us-east-1" });
const plugins = [numPluginU, strPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  if (!awsClient) {
    throw new Error("S3 test client was not initialized");
  }
  const client = wrapAwsSdk(awsClient, commands);
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, { s3: createS3Interpreter(client) });
  return await fold(nexpr, interp);
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
    const putExpr = $.s3.putObject({ Bucket: BUCKET, Key: "hello.txt", Body: "Hello, S3!" });
    const putResult = (await run(putExpr)) as Record<string, unknown>;
    expect(putResult.ETag).toBeDefined();

    const getExpr = $.s3.getObject({ Bucket: BUCKET, Key: "hello.txt" });
    const getResult = (await run(getExpr)) as Record<string, unknown>;
    expect(getResult.Body).toBe("Hello, S3!");
  });
});

describe("s3 integration: headObject", () => {
  it("get object metadata", async () => {
    await awsClient!.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "meta.txt",
        Body: "metadata test",
      }),
    );

    const expr = $.s3.headObject({ Bucket: BUCKET, Key: "meta.txt" });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.ContentLength).toBeGreaterThan(0);
  });
});

describe("s3 integration: deleteObject", () => {
  it("delete an object", async () => {
    await awsClient!.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "to-delete.txt",
        Body: "delete me",
      }),
    );

    const expr = $.s3.deleteObject({ Bucket: BUCKET, Key: "to-delete.txt" });
    const result = await run(expr);
    expect(result).toBeDefined();
  });
});

describe("s3 integration: listObjectsV2", () => {
  it("list objects with prefix", async () => {
    await awsClient!.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "list-test/a.txt",
        Body: "a",
      }),
    );
    await awsClient!.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: "list-test/b.txt",
        Body: "b",
      }),
    );

    const expr = $.s3.listObjectsV2({ Bucket: BUCKET, Prefix: "list-test/" });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.Contents).toBeDefined();
    const contents = result.Contents as Array<{ Key: string }>;
    expect(contents.length).toBeGreaterThanOrEqual(2);
    const keys = contents.map((c) => c.Key);
    expect(keys).toContain("list-test/a.txt");
    expect(keys).toContain("list-test/b.txt");
  });
});
