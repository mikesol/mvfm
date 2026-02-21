import { describe, expect, it } from "vitest";
import { resend, resendPlugin } from "../../src/6.9.2";

const plugin = resend({ apiKey: "re_test_123" });
const api = plugin.ctors.resend;

// ============================================================
// CExpr construction tests
// ============================================================

describe("resend: emails.send", () => {
  it("produces resend/send_email CExpr", () => {
    const expr = api.emails.send({
      from: "onboarding@resend.dev",
      to: "user@example.com",
      subject: "Hello World",
      html: "<p>Welcome!</p>",
    });
    expect(expr.__kind).toBe("resend/send_email");
    expect(expr.__args).toHaveLength(1);
    // The params arg should be a resend/record CExpr
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("resend/record");
  });
});

describe("resend: emails.get", () => {
  it("produces resend/get_email CExpr with string id", () => {
    const expr = api.emails.get("email_123");
    expect(expr.__kind).toBe("resend/get_email");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("email_123");
  });

  it("accepts CExpr id (proxy chained value)", () => {
    const sent = api.emails.send({
      from: "a@b.com",
      to: "c@d.com",
      subject: "Hi",
      html: "<p>x</p>",
    });
    const expr = api.emails.get(sent.id);
    expect(expr.__kind).toBe("resend/get_email");
    expect(expr.__args).toHaveLength(1);
    const idArg = expr.__args[0] as { __kind: string };
    expect(idArg.__kind).toBe("core/access");
  });
});

describe("resend: batch.send", () => {
  it("produces resend/send_batch CExpr with array wrapped as resend/array", () => {
    const expr = api.batch.send([
      {
        from: "onboarding@resend.dev",
        to: "user1@example.com",
        subject: "Hello User 1",
        html: "<p>Hi 1</p>",
      },
      {
        from: "onboarding@resend.dev",
        to: "user2@example.com",
        subject: "Hello User 2",
        html: "<p>Hi 2</p>",
      },
    ]);
    expect(expr.__kind).toBe("resend/send_batch");
    expect(expr.__args).toHaveLength(1);
    const arrayArg = expr.__args[0] as { __kind: string; __args: unknown[] };
    expect(arrayArg.__kind).toBe("resend/array");
    expect(arrayArg.__args).toHaveLength(2);
  });
});

describe("resend: contacts.create", () => {
  it("produces resend/create_contact CExpr", () => {
    const expr = api.contacts.create({
      email: "user@example.com",
      firstName: "John",
    });
    expect(expr.__kind).toBe("resend/create_contact");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("resend/record");
  });
});

describe("resend: contacts.get", () => {
  it("produces resend/get_contact CExpr with string id", () => {
    const expr = api.contacts.get("contact_456");
    expect(expr.__kind).toBe("resend/get_contact");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("contact_456");
  });
});

describe("resend: contacts.list", () => {
  it("produces resend/list_contacts CExpr", () => {
    const expr = api.contacts.list();
    expect(expr.__kind).toBe("resend/list_contacts");
    expect(expr.__args).toHaveLength(0);
  });
});

describe("resend: contacts.remove", () => {
  it("produces resend/remove_contact CExpr with string id", () => {
    const expr = api.contacts.remove("contact_456");
    expect(expr.__kind).toBe("resend/remove_contact");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("contact_456");
  });
});

// ============================================================
// Unified Plugin shape
// ============================================================

describe("resend plugin: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("resend");
  });

  it("has 9 node kinds (7 core + record + array)", () => {
    expect(plugin.nodeKinds).toHaveLength(9);
  });

  it("nodeKinds are all namespaced", () => {
    for (const kind of plugin.nodeKinds) {
      expect(kind).toMatch(/^resend\//);
    }
  });

  it("kinds map has entries for all node kinds", () => {
    for (const kind of plugin.nodeKinds) {
      expect(plugin.kinds[kind]).toBeDefined();
    }
  });

  it("has empty traits and lifts", () => {
    expect(plugin.traits).toEqual({});
    expect(plugin.lifts).toEqual({});
  });

  it("has a defaultInterpreter factory", () => {
    expect(typeof plugin.defaultInterpreter).toBe("function");
  });
});

// ============================================================
// Factory aliases
// ============================================================

describe("resend plugin: factory aliases", () => {
  it("resend and resendPlugin are the same function", () => {
    expect(resend).toBe(resendPlugin);
  });
});
