import { mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { resend } from "../../src/6.9.2";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, resend({ apiKey: "re_test_123" }));

// ============================================================
// Parity tests: Resend plugin AST builder
// ============================================================

describe("resend: emails.send", () => {
  it("produces resend/send_email node", () => {
    const prog = app(($) => {
      return $.resend.emails.send({
        from: "onboarding@resend.dev",
        to: "user@example.com",
        subject: "Hello World",
        html: "<p>Welcome!</p>",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/send_email");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.from.kind).toBe("core/literal");
    expect(ast.result.params.fields.from.value).toBe("onboarding@resend.dev");
    expect(ast.result.params.fields.to.kind).toBe("core/literal");
    expect(ast.result.params.fields.to.value).toBe("user@example.com");
    expect(ast.result.params.fields.subject.kind).toBe("core/literal");
    expect(ast.result.params.fields.subject.value).toBe("Hello World");
    expect(ast.result.params.fields.html.kind).toBe("core/literal");
    expect(ast.result.params.fields.html.value).toBe("<p>Welcome!</p>");
  });

  it("accepts Expr params and captures proxy dependencies", () => {
    const prog = app(($) => {
      return $.resend.emails.send({
        from: $.input.fromAddress,
        to: $.input.toAddress,
        subject: $.input.subject,
        html: $.input.body,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/send_email");
    expect(ast.result.params.fields.from.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.to.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.subject.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.html.kind).toBe("core/prop_access");
  });
});

describe("resend: emails.get", () => {
  it("produces resend/get_email node with literal id", () => {
    const prog = app(($) => {
      return $.resend.emails.get("email_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/get_email");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("email_123");
  });

  it("accepts Expr<string> id", () => {
    const prog = app(($) => {
      return $.resend.emails.get($.input.emailId);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/get_email");
    expect(ast.result.id.kind).toBe("core/prop_access");
  });
});

describe("resend: batch.send", () => {
  it("produces resend/send_batch node with array becoming core/tuple", () => {
    const prog = app(($) => {
      return $.resend.batch.send([
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
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/send_batch");
    expect(ast.result.emails.kind).toBe("core/tuple");
    expect(ast.result.emails.elements).toHaveLength(2);
    expect(ast.result.emails.elements[0].kind).toBe("core/record");
    expect(ast.result.emails.elements[0].fields.to.value).toBe("user1@example.com");
    expect(ast.result.emails.elements[1].fields.to.value).toBe("user2@example.com");
  });
});

describe("resend: contacts.create", () => {
  it("produces resend/create_contact node with params as core/record", () => {
    const prog = app(($) => {
      return $.resend.contacts.create({
        email: "user@example.com",
        firstName: "John",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/create_contact");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.email.value).toBe("user@example.com");
    expect(ast.result.params.fields.firstName.value).toBe("John");
  });
});

describe("resend: contacts.get", () => {
  it("produces resend/get_contact node with id as core/literal", () => {
    const prog = app(($) => {
      return $.resend.contacts.get("contact_456");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/get_contact");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("contact_456");
  });

  it("accepts Expr<string> id", () => {
    const prog = app(($) => {
      return $.resend.contacts.get($.input.contactId);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/get_contact");
    expect(ast.result.id.kind).toBe("core/prop_access");
  });
});

describe("resend: contacts.list", () => {
  it("produces resend/list_contacts node", () => {
    const prog = app(($) => {
      return $.resend.contacts.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/list_contacts");
  });
});

describe("resend: contacts.remove", () => {
  it("produces resend/remove_contact node with id as core/literal", () => {
    const prog = app(($) => {
      return $.resend.contacts.remove("contact_456");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/remove_contact");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("contact_456");
  });

  it("accepts Expr<string> id", () => {
    const prog = app(($) => {
      return $.resend.contacts.remove($.input.contactId);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/remove_contact");
    expect(ast.result.id.kind).toBe("core/prop_access");
  });
});

describe("resend: integration with $.begin()", () => {
  it("side-effecting operations wrapped in $.begin() are reachable", () => {
    expect(() => {
      app(($) => {
        const email = $.resend.emails.send({
          from: "onboarding@resend.dev",
          to: "user@example.com",
          subject: "Welcome",
          html: "<p>Hello</p>",
        });
        const contact = $.resend.contacts.create({
          email: "user@example.com",
        });
        return $.begin(email, contact);
      });
    }).not.toThrow();
  });

  it("orphaned operations are rejected", () => {
    expect(() => {
      app(($) => {
        const email = $.resend.emails.get("email_123");
        $.resend.contacts.create({
          email: "user@example.com",
        }); // orphan!
        return email;
      });
    }).toThrow(/unreachable node/i);
  });
});

describe("resend: cross-operation dependencies", () => {
  it("can use result of send as input to get", () => {
    const prog = app(($) => {
      const sent = $.resend.emails.send({
        from: "onboarding@resend.dev",
        to: "user@example.com",
        subject: "Welcome",
        html: "<p>Hello</p>",
      });
      const retrieved = $.resend.emails.get(sent.id);
      return $.begin(sent, retrieved);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/begin");
    // The get email id should reference the send result via prop_access
    const getNode = ast.result.result;
    expect(getNode.kind).toBe("resend/get_email");
    expect(getNode.id.kind).toBe("core/prop_access");
  });
});

describe("resend: compile-time typing guards", () => {
  it("rejects invalid sdk payload shapes", () => {
    const typecheckOnly = process.env.MVFM_TYPECHECK_ONLY === "1";
    if (typecheckOnly) {
      app(($) => {
        // @ts-expect-error from must be a string
        $.resend.emails.send({
          from: 123,
          to: "user@example.com",
          subject: "Hello",
          html: "<p>x</p>",
        });

        // @ts-expect-error each batch email must satisfy CreateEmailOptions
        $.resend.batch.send([
          { from: "sender@example.com", to: "user@example.com", subject: "Missing body" },
        ]);

        // @ts-expect-error subscription only allows "opt_in" | "opt_out"
        $.resend.contacts.create({
          email: "user@example.com",
          topics: [{ id: "topic_123", subscription: "invalid" }],
        });

        return $.resend.contacts.list();
      });
    }
    expect(true).toBe(true);
  });
});
