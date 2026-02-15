import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { slack } from "../../../../src/plugins/slack/7.14.0";
import { str } from "../../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, slack({ token: "xoxb-test-token" }));

// ============================================================
// chat
// ============================================================

describe("slack: chat.postMessage", () => {
  it("produces slack/chat_postMessage node", () => {
    const prog = app(($) => {
      return $.slack.chat.postMessage({ channel: "#general", text: "Hello" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_postMessage");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.channel.value).toBe("#general");
    expect(ast.result.params.fields.text.value).toBe("Hello");
  });

  it("accepts Expr params", () => {
    const prog = app(($) => {
      return $.slack.chat.postMessage({
        channel: $.input.channel,
        text: $.input.message,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_postMessage");
    expect(ast.result.params.fields.channel.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.text.kind).toBe("core/prop_access");
  });
});

describe("slack: chat.update", () => {
  it("produces slack/chat_update node", () => {
    const prog = app(($) => {
      return $.slack.chat.update({ channel: "C123", ts: "1234567890.123456", text: "Updated" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_update");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

describe("slack: chat.delete", () => {
  it("produces slack/chat_delete node", () => {
    const prog = app(($) => {
      return $.slack.chat.delete({ channel: "C123", ts: "1234567890.123456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_delete");
  });
});

describe("slack: chat.postEphemeral", () => {
  it("produces slack/chat_postEphemeral node", () => {
    const prog = app(($) => {
      return $.slack.chat.postEphemeral({ channel: "C123", user: "U123", text: "Secret" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_postEphemeral");
  });
});

describe("slack: chat.scheduleMessage", () => {
  it("produces slack/chat_scheduleMessage node", () => {
    const prog = app(($) => {
      return $.slack.chat.scheduleMessage({ channel: "C123", text: "Later", post_at: 1234567890 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_scheduleMessage");
  });
});

describe("slack: chat.getPermalink", () => {
  it("produces slack/chat_getPermalink node", () => {
    const prog = app(($) => {
      return $.slack.chat.getPermalink({ channel: "C123", message_ts: "1234567890.123456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_getPermalink");
  });
});

// ============================================================
// conversations
// ============================================================

describe("slack: conversations.list", () => {
  it("produces slack/conversations_list with params", () => {
    const prog = app(($) => {
      return $.slack.conversations.list({ limit: 100 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_list");
    expect(ast.result.params.fields.limit.value).toBe(100);
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.slack.conversations.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_list");
    expect(ast.result.params).toBeNull();
  });
});

describe("slack: conversations.info", () => {
  it("produces slack/conversations_info node", () => {
    const prog = app(($) => {
      return $.slack.conversations.info({ channel: "C123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_info");
  });
});

describe("slack: conversations.create", () => {
  it("produces slack/conversations_create node", () => {
    const prog = app(($) => {
      return $.slack.conversations.create({ name: "new-channel" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_create");
  });
});

describe("slack: conversations.invite", () => {
  it("produces slack/conversations_invite node", () => {
    const prog = app(($) => {
      return $.slack.conversations.invite({ channel: "C123", users: "U123,U456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_invite");
  });
});

describe("slack: conversations.history", () => {
  it("produces slack/conversations_history node", () => {
    const prog = app(($) => {
      return $.slack.conversations.history({ channel: "C123", limit: 50 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_history");
  });
});

describe("slack: conversations.members", () => {
  it("produces slack/conversations_members node", () => {
    const prog = app(($) => {
      return $.slack.conversations.members({ channel: "C123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_members");
  });
});

describe("slack: conversations.open", () => {
  it("produces slack/conversations_open node", () => {
    const prog = app(($) => {
      return $.slack.conversations.open({ users: "U123,U456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_open");
  });
});

describe("slack: conversations.replies", () => {
  it("produces slack/conversations_replies node", () => {
    const prog = app(($) => {
      return $.slack.conversations.replies({ channel: "C123", ts: "1234567890.123456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_replies");
  });
});

// ============================================================
// users
// ============================================================

describe("slack: users.info", () => {
  it("produces slack/users_info node", () => {
    const prog = app(($) => {
      return $.slack.users.info({ user: "U123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/users_info");
  });
});

describe("slack: users.list", () => {
  it("produces slack/users_list with optional params", () => {
    const prog = app(($) => {
      return $.slack.users.list({ limit: 200 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/users_list");
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.slack.users.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/users_list");
    expect(ast.result.params).toBeNull();
  });
});

describe("slack: users.lookupByEmail", () => {
  it("produces slack/users_lookupByEmail node", () => {
    const prog = app(($) => {
      return $.slack.users.lookupByEmail({ email: "user@example.com" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/users_lookupByEmail");
  });
});

describe("slack: users.conversations", () => {
  it("produces slack/users_conversations with optional params", () => {
    const prog = app(($) => {
      return $.slack.users.conversations({ user: "U123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/users_conversations");
  });
});

// ============================================================
// reactions
// ============================================================

describe("slack: reactions.add", () => {
  it("produces slack/reactions_add node", () => {
    const prog = app(($) => {
      return $.slack.reactions.add({
        channel: "C123",
        timestamp: "1234567890.123456",
        name: "thumbsup",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/reactions_add");
  });
});

describe("slack: reactions.get", () => {
  it("produces slack/reactions_get node", () => {
    const prog = app(($) => {
      return $.slack.reactions.get({ channel: "C123", timestamp: "1234567890.123456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/reactions_get");
  });
});

describe("slack: reactions.list", () => {
  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.slack.reactions.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/reactions_list");
    expect(ast.result.params).toBeNull();
  });
});

describe("slack: reactions.remove", () => {
  it("produces slack/reactions_remove node", () => {
    const prog = app(($) => {
      return $.slack.reactions.remove({
        channel: "C123",
        timestamp: "1234567890.123456",
        name: "thumbsup",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/reactions_remove");
  });
});

// ============================================================
// files
// ============================================================

describe("slack: files.list", () => {
  it("produces slack/files_list with optional params", () => {
    const prog = app(($) => {
      return $.slack.files.list({ channel: "C123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/files_list");
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.slack.files.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/files_list");
    expect(ast.result.params).toBeNull();
  });
});

describe("slack: files.info", () => {
  it("produces slack/files_info node", () => {
    const prog = app(($) => {
      return $.slack.files.info({ file: "F123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/files_info");
  });
});

describe("slack: files.delete", () => {
  it("produces slack/files_delete node", () => {
    const prog = app(($) => {
      return $.slack.files.delete({ file: "F123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/files_delete");
  });
});

// ============================================================
// Integration: $.do(), orphan detection, cross-operation deps
// ============================================================

describe("slack: integration with $.do()", () => {
  it("side-effecting operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const msg = $.slack.chat.postMessage({ channel: "#general", text: "Hello" });
        const reaction = $.slack.reactions.add({
          channel: "#general",
          timestamp: (msg as any).ts,
          name: "thumbsup",
        });
        return $.do(msg, reaction);
      });
    }).not.toThrow();
  });

  it("orphaned operations are rejected", () => {
    expect(() => {
      app(($) => {
        const info = $.slack.conversations.info({ channel: "C123" });
        $.slack.chat.postMessage({ channel: "C123", text: "orphan!" }); // orphan!
        return info;
      });
    }).toThrow(/unreachable node/i);
  });
});

describe("slack: cross-operation dependencies", () => {
  it("can use result of one operation as input to another", () => {
    const prog = app(($) => {
      const user = $.slack.users.lookupByEmail({ email: "user@example.com" });
      const msg = $.slack.chat.postMessage({
        channel: "#general",
        text: "Hello",
        user: (user as any).user.id,
      });
      return $.do(user, msg);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
  });
});
