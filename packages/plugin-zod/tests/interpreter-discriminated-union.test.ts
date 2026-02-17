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

describe("zodInterpreter: discriminated union schemas (#113)", () => {
  it("discriminatedUnion accepts value matching first option", async () => {
    const prog = app(($) =>
      $.zod
        .discriminatedUnion("status", [
          $.zod.object({ status: $.zod.literal("success"), data: $.zod.string() }),
          $.zod.object({ status: $.zod.literal("failed"), error: $.zod.string() }),
        ])
        .parse($.input.value),
    );
    expect(await run(prog, { value: { status: "success", data: "hello" } })).toEqual({
      status: "success",
      data: "hello",
    });
  });

  it("discriminatedUnion accepts value matching second option", async () => {
    const prog = app(($) =>
      $.zod
        .discriminatedUnion("status", [
          $.zod.object({ status: $.zod.literal("success"), data: $.zod.string() }),
          $.zod.object({ status: $.zod.literal("failed"), error: $.zod.string() }),
        ])
        .parse($.input.value),
    );
    expect(await run(prog, { value: { status: "failed", error: "oh no" } })).toEqual({
      status: "failed",
      error: "oh no",
    });
  });

  it("discriminatedUnion rejects non-matching input", async () => {
    const prog = app(($) =>
      $.zod
        .discriminatedUnion("type", [
          $.zod.object({ type: $.zod.literal("a") }),
          $.zod.object({ type: $.zod.literal("b") }),
        ])
        .safeParse($.input.value),
    );
    const result = (await run(prog, { value: { type: "c" } })) as any;
    expect(result.success).toBe(false);
  });

  it("discriminatedUnion with schema-level error", async () => {
    const prog = app(($) =>
      $.zod
        .discriminatedUnion(
          "kind",
          [$.zod.object({ kind: $.zod.literal("x") }), $.zod.object({ kind: $.zod.literal("y") })],
          "Must be x or y!",
        )
        .safeParse($.input.value),
    );
    const result = (await run(prog, { value: { kind: "z" } })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be x or y!");
  });

  it("discriminatedUnion with optional wrapper", async () => {
    const prog = app(($) =>
      $.zod
        .discriminatedUnion("mode", [
          $.zod.object({ mode: $.zod.literal("on") }),
          $.zod.object({ mode: $.zod.literal("off") }),
        ])
        .optional()
        .safeParse($.input.value),
    );
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: { mode: "on" } })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
  });

  it("nested discriminated unions work", async () => {
    const prog = app(($) => {
      const inner = $.zod.discriminatedUnion("shape", [
        $.zod.object({ shape: $.zod.literal("circle"), radius: $.zod.number() }),
        $.zod.object({ shape: $.zod.literal("square"), side: $.zod.number() }),
      ]);
      return $.zod
        .discriminatedUnion("type", [
          $.zod.object({ type: $.zod.literal("geometry"), data: inner }),
          $.zod.object({ type: $.zod.literal("text"), content: $.zod.string() }),
        ])
        .parse($.input.value);
    });
    const result = await run(prog, {
      value: { type: "geometry", data: { shape: "circle", radius: 5 } },
    });
    expect(result).toEqual({ type: "geometry", data: { shape: "circle", radius: 5 } });
  });

  it("discriminatedUnion enforces discriminator field", async () => {
    const prog = app(($) =>
      $.zod
        .discriminatedUnion("type", [
          $.zod.object({ type: $.zod.literal("a"), value: $.zod.string() }),
          $.zod.object({ type: $.zod.literal("b"), count: $.zod.number() }),
        ])
        .safeParse($.input.value),
    );
    // Missing discriminator field
    const result = (await run(prog, { value: { value: "test" } })) as any;
    expect(result.success).toBe(false);
  });
});
