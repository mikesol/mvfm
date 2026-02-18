import type { NodeExample } from "./types";

const S3 = ["@mvfm/plugin-s3"];

const examples: Record<string, NodeExample> = {
  "s3/put_object": {
    description: "Upload a text object to an S3 bucket",
    code: `const app = mvfm(prelude, s3_);
const prog = app({}, ($) => {
  return $.s3.putObject({
    Bucket: "my-bucket",
    Key: "greeting.txt",
    Body: "hello world",
  });
});
await foldAST(
  defaults(app, { s3: memoryS3Interpreter }),
  prog
);`,
    plugins: S3,
    s3: true,
  },

  "s3/get_object": {
    description: "Download an object from S3 and read its body",
    code: `const app = mvfm(prelude, s3_);
const prog = app({}, ($) => {
  return $.begin(
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "data.json",
      Body: '{"count":42}',
    }),
    $.s3.getObject({ Bucket: "my-bucket", Key: "data.json" })
  );
});
await foldAST(
  defaults(app, { s3: memoryS3Interpreter }),
  prog
);`,
    plugins: S3,
    s3: true,
  },

  "s3/delete_object": {
    description: "Delete an object from an S3 bucket",
    code: `const app = mvfm(prelude, s3_);
const prog = app({}, ($) => {
  return $.begin(
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "temp.txt",
      Body: "temporary data",
    }),
    $.s3.deleteObject({ Bucket: "my-bucket", Key: "temp.txt" })
  );
});
await foldAST(
  defaults(app, { s3: memoryS3Interpreter }),
  prog
);`,
    plugins: S3,
    s3: true,
  },

  "s3/head_object": {
    description: "Check if an object exists and retrieve its metadata",
    code: `const app = mvfm(prelude, s3_);
const prog = app({}, ($) => {
  return $.begin(
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "report.csv",
      Body: "name,score\\nAlice,95\\nBob,87",
      ContentType: "text/csv",
    }),
    $.s3.headObject({ Bucket: "my-bucket", Key: "report.csv" })
  );
});
await foldAST(
  defaults(app, { s3: memoryS3Interpreter }),
  prog
);`,
    plugins: S3,
    s3: true,
  },

  "s3/list_objects_v2": {
    description: "List objects in an S3 bucket filtered by prefix",
    code: `const app = mvfm(prelude, s3_);
const prog = app({}, ($) => {
  return $.begin(
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "uploads/photo.jpg",
      Body: "<photo data>",
    }),
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "uploads/doc.pdf",
      Body: "<pdf data>",
    }),
    $.s3.putObject({
      Bucket: "my-bucket",
      Key: "config/settings.json",
      Body: '{"theme":"dark"}',
    }),
    $.s3.listObjectsV2({
      Bucket: "my-bucket",
      Prefix: "uploads/",
    })
  );
});
await foldAST(
  defaults(app, { s3: memoryS3Interpreter }),
  prog
);`,
    plugins: S3,
    s3: true,
  },
};

export default examples;
