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

describe("zodInterpreter: string format schemas (#101)", () => {
  it("email() validates valid email", async () => {
    const prog = app(($) => $.zod.email().safeParse($.input.value));
    const valid = (await run(prog, { value: "user@example.com" })) as any;
    const invalid = (await run(prog, { value: "not-an-email" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("uuid() validates valid UUID", async () => {
    const prog = app(($) => $.zod.uuid().safeParse($.input.value));
    const valid = (await run(prog, { value: "550e8400-e29b-41d4-a716-446655440000" })) as any;
    const invalid = (await run(prog, { value: "not-a-uuid" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("url() validates valid URL", async () => {
    const prog = app(($) => $.zod.url().safeParse($.input.value));
    const valid = (await run(prog, { value: "https://example.com" })) as any;
    const invalid = (await run(prog, { value: "not a url" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("email() with error config", async () => {
    const prog = app(($) => $.zod.email("Bad email").safeParse($.input.value));
    const result = (await run(prog, { value: "not-an-email" })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Bad email");
  });

  it("email() with min check", async () => {
    const prog = app(($) => $.zod.email().min(20).safeParse($.input.value));
    const tooShort = (await run(prog, { value: "a@b.c" })) as any;
    const valid = (await run(prog, { value: "longuser@longdomain.example.com" })) as any;
    // Short email fails min_length check
    expect(tooShort.success).toBe(false);
    expect(valid.success).toBe(true);
  });

  it("email() with optional wrapper", async () => {
    const prog = app(($) => $.zod.email().optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: "user@example.com" })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
  });

  it("ipv4() validates IPv4 addresses", async () => {
    const prog = app(($) => $.zod.ipv4().safeParse($.input.value));
    const valid = (await run(prog, { value: "192.168.1.1" })) as any;
    const invalid = (await run(prog, { value: "not-an-ip" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("hex() validates hexadecimal strings", async () => {
    const prog = app(($) => $.zod.hex().safeParse($.input.value));
    const valid = (await run(prog, { value: "deadbeef" })) as any;
    const invalid = (await run(prog, { value: "xyz" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("base64() validates base64 strings", async () => {
    const prog = app(($) => $.zod.base64().safeParse($.input.value));
    const valid = (await run(prog, { value: "SGVsbG8gV29ybGQ=" })) as any;
    const invalid = (await run(prog, { value: "not base64!!!" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("iso.date() validates ISO dates", async () => {
    const prog = app(($) => $.zod.iso.date().safeParse($.input.value));
    const valid = (await run(prog, { value: "2024-01-15" })) as any;
    const invalid = (await run(prog, { value: "not-a-date" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("iso.datetime() validates ISO datetimes", async () => {
    const prog = app(($) => $.zod.iso.datetime().safeParse($.input.value));
    const valid = (await run(prog, { value: "2024-01-15T10:30:00Z" })) as any;
    const invalid = (await run(prog, { value: "not-a-datetime" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("rejects non-string input on format schemas", async () => {
    const prog = app(($) => $.zod.email().safeParse($.input.value));
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
  });
});
