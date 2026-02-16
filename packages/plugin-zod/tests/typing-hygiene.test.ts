import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "src");

const HANDLER_FILES = [
  "interpreter.ts",
  "string.ts",
  "number.ts",
  "bigint.ts",
  "date.ts",
  "enum.ts",
  "literal.ts",
  "primitives.ts",
  "special.ts",
  "object.ts",
  "array.ts",
  "union.ts",
  "intersection.ts",
  "map-set.ts",
  "record.ts",
];

describe("zod interpreter typing hygiene (#192)", () => {
  it("does not use node: any in handler modules", () => {
    for (const file of HANDLER_FILES) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect(source).not.toMatch(/\(node:\s*any\)/);
    }
  });

  it("isolates Zod type-gap casts in compat layer", () => {
    const interpreter = readFileSync(join(ROOT, "interpreter.ts"), "utf8");
    expect(interpreter).not.toContain(" as any");
  });
});
