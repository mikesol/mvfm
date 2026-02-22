import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: string format schemas (#101)", () => {
  it("email() validates valid email", async () => {
    const valid = (await run($.zod.email().safeParse("user@example.com"))) as any;
    const invalid = (await run($.zod.email().safeParse("not-an-email"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("uuid() validates valid UUID", async () => {
    const valid = (await run(
      $.zod.uuid().safeParse("550e8400-e29b-41d4-a716-446655440000"),
    )) as any;
    const invalid = (await run($.zod.uuid().safeParse("not-a-uuid"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("url() validates valid URL", async () => {
    const valid = (await run($.zod.url().safeParse("https://example.com"))) as any;
    const invalid = (await run($.zod.url().safeParse("not a url"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("email() with error config", async () => {
    const result = (await run($.zod.email("Bad email").safeParse("not-an-email"))) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Bad email");
  });

  it("email() with min check", async () => {
    const tooShort = (await run($.zod.email().min(20).safeParse("a@b.c"))) as any;
    const valid = (await run(
      $.zod.email().min(20).safeParse("longuser@longdomain.example.com"),
    )) as any;
    expect(tooShort.success).toBe(false);
    expect(valid.success).toBe(true);
  });

  it("ipv4() validates IPv4 addresses", async () => {
    const valid = (await run($.zod.ipv4().safeParse("192.168.1.1"))) as any;
    const invalid = (await run($.zod.ipv4().safeParse("not-an-ip"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("hex() validates hexadecimal strings", async () => {
    const valid = (await run($.zod.hex().safeParse("deadbeef"))) as any;
    const invalid = (await run($.zod.hex().safeParse("xyz"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("base64() validates base64 strings", async () => {
    const valid = (await run($.zod.base64().safeParse("SGVsbG8gV29ybGQ="))) as any;
    const invalid = (await run($.zod.base64().safeParse("not base64!!!"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("iso.date() validates ISO dates", async () => {
    const valid = (await run($.zod.iso.date().safeParse("2024-01-15"))) as any;
    const invalid = (await run($.zod.iso.date().safeParse("not-a-date"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("iso.datetime() validates ISO datetimes", async () => {
    const valid = (await run($.zod.iso.datetime().safeParse("2024-01-15T10:30:00Z"))) as any;
    const invalid = (await run($.zod.iso.datetime().safeParse("not-a-datetime"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("rejects non-string input on format schemas", async () => {
    const result = (await run($.zod.email().safeParse(42))) as any;
    expect(result.success).toBe(false);
  });
});
