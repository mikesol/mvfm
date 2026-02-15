import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { s3 } from "../../../../src/plugins/s3/3.989.0";
import { str } from "../../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, s3({ region: "us-east-1" }));

// ============================================================
// putObject
// ============================================================

describe("s3: putObject", () => {
  it("produces s3/put_object node with literal params", () => {
    const prog = app(($) => {
      return $.s3.putObject({ Bucket: "my-bucket", Key: "file.txt", Body: "hello" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/put_object");
    expect(ast.result.input.kind).toBe("core/record");
    expect(ast.result.input.fields.Bucket.kind).toBe("core/literal");
    expect(ast.result.input.fields.Bucket.value).toBe("my-bucket");
    expect(ast.result.input.fields.Key.kind).toBe("core/literal");
    expect(ast.result.input.fields.Key.value).toBe("file.txt");
    expect(ast.result.input.fields.Body.kind).toBe("core/literal");
    expect(ast.result.input.fields.Body.value).toBe("hello");
  });

  it("accepts Expr params", () => {
    const prog = app(($) => {
      return $.s3.putObject({
        Bucket: $.input.bucket,
        Key: $.input.key,
        Body: $.input.content,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/put_object");
    expect(ast.result.input.fields.Bucket.kind).toBe("core/prop_access");
    expect(ast.result.input.fields.Key.kind).toBe("core/prop_access");
    expect(ast.result.input.fields.Body.kind).toBe("core/prop_access");
  });
});

// ============================================================
// getObject
// ============================================================

describe("s3: getObject", () => {
  it("produces s3/get_object node", () => {
    const prog = app(($) => {
      return $.s3.getObject({ Bucket: "my-bucket", Key: "file.txt" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/get_object");
    expect(ast.result.input.kind).toBe("core/record");
    expect(ast.result.input.fields.Bucket.value).toBe("my-bucket");
    expect(ast.result.input.fields.Key.value).toBe("file.txt");
  });
});

// ============================================================
// deleteObject
// ============================================================

describe("s3: deleteObject", () => {
  it("produces s3/delete_object node", () => {
    const prog = app(($) => {
      return $.s3.deleteObject({ Bucket: "my-bucket", Key: "file.txt" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/delete_object");
    expect(ast.result.input.fields.Bucket.value).toBe("my-bucket");
    expect(ast.result.input.fields.Key.value).toBe("file.txt");
  });
});

// ============================================================
// headObject
// ============================================================

describe("s3: headObject", () => {
  it("produces s3/head_object node", () => {
    const prog = app(($) => {
      return $.s3.headObject({ Bucket: "my-bucket", Key: "file.txt" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/head_object");
    expect(ast.result.input.fields.Bucket.value).toBe("my-bucket");
    expect(ast.result.input.fields.Key.value).toBe("file.txt");
  });
});

// ============================================================
// listObjectsV2
// ============================================================

describe("s3: listObjectsV2", () => {
  it("produces s3/list_objects_v2 node with params", () => {
    const prog = app(($) => {
      return $.s3.listObjectsV2({ Bucket: "my-bucket", Prefix: "uploads/" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("s3/list_objects_v2");
    expect(ast.result.input.fields.Bucket.value).toBe("my-bucket");
    expect(ast.result.input.fields.Prefix.value).toBe("uploads/");
  });
});

// ============================================================
// $.do() integration
// ============================================================

describe("s3: integration with $.do()", () => {
  it("side-effecting operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const put = $.s3.putObject({ Bucket: "b", Key: "k", Body: "data" });
        const head = $.s3.headObject({ Bucket: "b", Key: "k" });
        return $.do(put, head);
      });
    }).not.toThrow();
  });

  it("orphaned operations are rejected", () => {
    expect(() => {
      app(($) => {
        const get = $.s3.getObject({ Bucket: "b", Key: "k" });
        $.s3.deleteObject({ Bucket: "b", Key: "k" }); // orphan!
        return get;
      });
    }).toThrow(/unreachable node/i);
  });
});

// ============================================================
// Cross-operation dependencies
// ============================================================

describe("s3: cross-operation dependencies", () => {
  it("can use result of one operation as input to another", () => {
    const prog = app(($) => {
      const list = $.s3.listObjectsV2({ Bucket: "my-bucket" });
      const head = $.s3.headObject({
        Bucket: "my-bucket",
        Key: (list as any).Contents[0].Key,
      });
      return $.do(list, head);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
  });
});
