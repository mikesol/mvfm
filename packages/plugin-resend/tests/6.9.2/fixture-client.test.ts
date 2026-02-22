import { describe, expect, it } from "vitest";
import { resolveOperation, sortedStringify } from "./fixture-client";

describe("resolveOperation", () => {
  it("matches POST /emails to send_email", () => {
    expect(resolveOperation("POST", "/emails")).toBe("send_email");
  });

  it("matches GET /emails/{id} to get_email", () => {
    expect(resolveOperation("GET", "/emails/abc-123")).toBe("get_email");
  });

  it("matches POST /emails/batch to send_batch", () => {
    expect(resolveOperation("POST", "/emails/batch")).toBe("send_batch");
  });

  it("matches POST /contacts to create_contact", () => {
    expect(resolveOperation("POST", "/contacts")).toBe("create_contact");
  });

  it("matches GET /contacts/{id} to get_contact", () => {
    expect(resolveOperation("GET", "/contacts/contact-456")).toBe("get_contact");
  });

  it("matches GET /contacts to list_contacts", () => {
    expect(resolveOperation("GET", "/contacts")).toBe("list_contacts");
  });

  it("matches DELETE /contacts/{id} to remove_contact", () => {
    expect(resolveOperation("DELETE", "/contacts/contact-789")).toBe("remove_contact");
  });

  it("throws for unknown route", () => {
    expect(() => resolveOperation("PUT", "/unknown")).toThrow("No matching operation");
  });
});

describe("sortedStringify", () => {
  it("produces stable output regardless of key order", () => {
    const a = sortedStringify({ z: 1, a: 2 });
    const b = sortedStringify({ a: 2, z: 1 });
    expect(a).toBe(b);
  });

  it("handles nested objects", () => {
    const result = sortedStringify({ b: { d: 1, c: 2 }, a: 3 });
    expect(result).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });
});
