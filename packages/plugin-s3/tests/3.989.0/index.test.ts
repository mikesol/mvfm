import { describe, expect, it } from "vitest";
import { s3, s3Plugin } from "../../src/3.989.0";

const plugin = s3;
const api = plugin.ctors.s3;

// ============================================================
// CExpr construction tests
// ============================================================

describe("s3: putObject", () => {
  it("produces s3/put_object CExpr with literal params", () => {
    const expr = api.putObject({ Bucket: "my-bucket", Key: "file.txt", Body: "hello" });
    expect(expr.__kind).toBe("s3/put_object");
    expect(expr.__args).toHaveLength(1);
    // With Liftable<T>, plain objects are passed directly (no s3/record wrapping)
    const paramsArg = expr.__args[0] as Record<string, unknown>;
    expect(paramsArg.Bucket).toBe("my-bucket");
  });

  it("accepts CExpr params (proxy chained value)", () => {
    const list = api.listObjectsV2({ Bucket: "my-bucket" });
    const expr = api.putObject({
      Bucket: "my-bucket",
      Key: list.Contents[0].Key,
      Body: "hello",
    });
    expect(expr.__kind).toBe("s3/put_object");
    expect(expr.__args).toHaveLength(1);
  });
});

describe("s3: getObject", () => {
  it("produces s3/get_object CExpr", () => {
    const expr = api.getObject({ Bucket: "my-bucket", Key: "file.txt" });
    expect(expr.__kind).toBe("s3/get_object");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as Record<string, unknown>;
    expect(paramsArg.Bucket).toBe("my-bucket");
  });
});

describe("s3: deleteObject", () => {
  it("produces s3/delete_object CExpr", () => {
    const expr = api.deleteObject({ Bucket: "my-bucket", Key: "file.txt" });
    expect(expr.__kind).toBe("s3/delete_object");
    expect(expr.__args).toHaveLength(1);
  });
});

describe("s3: headObject", () => {
  it("produces s3/head_object CExpr", () => {
    const expr = api.headObject({ Bucket: "my-bucket", Key: "file.txt" });
    expect(expr.__kind).toBe("s3/head_object");
    expect(expr.__args).toHaveLength(1);
  });
});

describe("s3: listObjectsV2", () => {
  it("produces s3/list_objects_v2 CExpr with params", () => {
    const expr = api.listObjectsV2({ Bucket: "my-bucket", Prefix: "uploads/" });
    expect(expr.__kind).toBe("s3/list_objects_v2");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as Record<string, unknown>;
    expect(paramsArg.Bucket).toBe("my-bucket");
  });
});

// ============================================================
// Unified Plugin shape
// ============================================================

describe("s3 plugin: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("s3");
  });

  it("has 5 node kinds (no record/array with Liftable)", () => {
    expect(Object.keys(plugin.kinds)).toHaveLength(5);
  });

  it("kinds are all namespaced", () => {
    for (const kind of Object.keys(plugin.kinds)) {
      expect(kind).toMatch(/^s3\//);
    }
  });

  it("kinds map has entries for all node kinds", () => {
    for (const kind of Object.keys(plugin.kinds)) {
      expect(plugin.kinds[kind]).toBeDefined();
    }
  });

  it("has empty traits and lifts", () => {
    expect(plugin.traits).toEqual({});
    expect(plugin.lifts).toEqual({});
  });

  it("has NO defaultInterpreter", () => {
    expect(plugin.defaultInterpreter).toBeUndefined();
  });
});

// ============================================================
// Factory aliases
// ============================================================

describe("s3 plugin: factory aliases", () => {
  it("s3 and s3Plugin are the same function", () => {
    expect(s3).toBe(s3Plugin);
  });
});
