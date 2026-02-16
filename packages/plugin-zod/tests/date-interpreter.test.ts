import {
  coreInterpreter,
  foldAST,
  injectInput,
  mvfm,
  type Program,
  strInterpreter,
} from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { createZodInterpreter, zod } from "../src/index";

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const interp = { ...coreInterpreter, ...strInterpreter, ...createZodInterpreter() };
  return await foldAST(interp, injectInput(prog, input));
}

const app = mvfm(zod);

describe("zodInterpreter: date schema (#142)", () => {
  it("date parse validates valid date input", async () => {
    const prog = app(($) => $.zod.date().parse($.input.value));
    const d = new Date("2024-06-15T00:00:00.000Z");
    expect(await run(prog, { value: d })).toEqual(d);
  });

  it("date parse rejects non-date", async () => {
    const prog = app(($) => $.zod.date().parse($.input.value));
    await expect(run(prog, { value: "not a date" })).rejects.toThrow();
  });

  it("min check rejects dates before minimum", async () => {
    const minDate = new Date("2020-01-01T00:00:00.000Z");
    const prog = app(($) => $.zod.date().min(minDate).safeParse($.input.value));
    const before = (await run(prog, { value: new Date("2019-12-31T00:00:00.000Z") })) as any;
    const exact = (await run(prog, { value: new Date("2020-01-01T00:00:00.000Z") })) as any;
    const after = (await run(prog, { value: new Date("2020-06-15T00:00:00.000Z") })) as any;
    expect(before.success).toBe(false);
    expect(exact.success).toBe(true);
    expect(after.success).toBe(true);
  });

  it("max check rejects dates after maximum", async () => {
    const maxDate = new Date("2025-12-31T23:59:59.999Z");
    const prog = app(($) => $.zod.date().max(maxDate).safeParse($.input.value));
    const before = (await run(prog, { value: new Date("2025-06-15T00:00:00.000Z") })) as any;
    const exact = (await run(prog, { value: new Date("2025-12-31T23:59:59.999Z") })) as any;
    const after = (await run(prog, { value: new Date("2026-01-01T00:00:00.000Z") })) as any;
    expect(before.success).toBe(true);
    expect(exact.success).toBe(true);
    expect(after.success).toBe(false);
  });

  it("min + max together constrain range", async () => {
    const prog = app(($) =>
      $.zod
        .date()
        .min(new Date("2020-01-01T00:00:00.000Z"))
        .max(new Date("2025-12-31T23:59:59.999Z"))
        .safeParse($.input.value),
    );
    const tooEarly = (await run(prog, { value: new Date("2019-06-01") })) as any;
    const inRange = (await run(prog, { value: new Date("2023-06-01") })) as any;
    const tooLate = (await run(prog, { value: new Date("2026-06-01") })) as any;
    expect(tooEarly.success).toBe(false);
    expect(inRange.success).toBe(true);
    expect(tooLate.success).toBe(false);
  });

  it("date with optional wrapper", async () => {
    const prog = app(($) => $.zod.date().optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: new Date("2024-01-01") })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
  });

  it("date schema-level error", async () => {
    const prog = app(($) => $.zod.date("Expected a date").safeParse($.input.value));
    const result = (await run(prog, { value: "hello" })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Expected a date");
  });

  it("date check-level error", async () => {
    const prog = app(($) =>
      $.zod.date().min(new Date("2020-01-01"), { error: "Too early!" }).safeParse($.input.value),
    );
    const result = (await run(prog, { value: new Date("2019-01-01") })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Too early!");
  });
});
