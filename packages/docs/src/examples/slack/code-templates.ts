/**
 * Code template generator for Slack plugin documentation examples.
 *
 * Generates executable playground code following the `app -> prog -> foldAST`
 * pipeline pattern for each Slack API method node kind.
 */

/** Well-known methods with sensible default arguments for documentation. */
const WELL_KNOWN_ARGS: Record<string, string> = {
  "chat.postMessage": '{ channel: "C0123456789", text: "Hello from mvfm!" }',
  "chat.update":
    '{ channel: "C0123456789", ts: "1700000000.000001", text: "Updated message" }',
  "chat.delete": '{ channel: "C0123456789", ts: "1700000000.000001" }',
  "conversations.create": '{ name: "new-channel" }',
  "conversations.invite": '{ channel: "C0123456789", users: "U0123456789" }',
  "conversations.join": '{ channel: "C0123456789" }',
  "conversations.leave": '{ channel: "C0123456789" }',
  "conversations.archive": '{ channel: "C0123456789" }',
  "conversations.unarchive": '{ channel: "C0123456789" }',
  "conversations.rename": '{ channel: "C0123456789", name: "renamed-channel" }',
  "conversations.setPurpose":
    '{ channel: "C0123456789", purpose: "Channel purpose" }',
  "conversations.setTopic":
    '{ channel: "C0123456789", topic: "Channel topic" }',
  "conversations.history": '{ channel: "C0123456789" }',
  "conversations.info": '{ channel: "C0123456789" }',
  "conversations.members": '{ channel: "C0123456789" }',
  "conversations.replies":
    '{ channel: "C0123456789", ts: "1700000000.000001" }',
  "conversations.kick":
    '{ channel: "C0123456789", user: "U0123456789" }',
  "reactions.add":
    '{ channel: "C0123456789", name: "thumbsup", timestamp: "1700000000.000001" }',
  "reactions.remove":
    '{ channel: "C0123456789", name: "thumbsup", timestamp: "1700000000.000001" }',
  "reactions.get": '{ channel: "C0123456789", timestamp: "1700000000.000001" }',
  "users.info": '{ user: "U0123456789" }',
  "users.lookupByEmail": '{ email: "user@example.com" }',
  "files.upload": '{ channels: "C0123456789", content: "file content", filename: "example.txt" }',
  "files.delete": '{ file: "F0123456789" }',
  "files.info": '{ file: "F0123456789" }',
  "pins.add": '{ channel: "C0123456789", timestamp: "1700000000.000001" }',
  "pins.remove": '{ channel: "C0123456789", timestamp: "1700000000.000001" }',
  "pins.list": '{ channel: "C0123456789" }',
  "bookmarks.add":
    '{ channel_id: "C0123456789", title: "Docs", type: "link", link: "https://example.com" }',
  "reminders.add": '{ text: "Review PR", time: "in 1 hour" }',
  "reminders.delete": '{ reminder: "Rm0123456789" }',
  "reminders.complete": '{ reminder: "Rm0123456789" }',
  "search.messages": '{ query: "from:me" }',
  "search.files": '{ query: "type:pdf" }',
  "stars.add": '{ channel: "C0123456789", timestamp: "1700000000.000001" }',
  "stars.remove": '{ channel: "C0123456789", timestamp: "1700000000.000001" }',
  "usergroups.create": '{ name: "Engineering" }',
  "usergroups.update":
    '{ usergroup: "S0123456789", name: "Updated Group" }',
  "usergroups.disable": '{ usergroup: "S0123456789" }',
  "usergroups.enable": '{ usergroup: "S0123456789" }',
  "views.open": '{ trigger_id: "T0123456789", view: { type: "modal", title: { type: "plain_text", text: "Title" } } }',
  "views.update": '{ view_id: "V0123456789", view: { type: "modal", title: { type: "plain_text", text: "Updated" } } }',
  "views.publish": '{ user_id: "U0123456789", view: { type: "home", blocks: [] } }',
  "views.push": '{ trigger_id: "T0123456789", view: { type: "modal", title: { type: "plain_text", text: "Pushed" } } }',
};

/**
 * Generate executable playground code for a Slack API method.
 *
 * @param accessor - Dot-path accessor like `chat.postMessage`
 * @param nodeKind - The full node kind like `slack/chat_postMessage`
 * @param isOptional - Whether the method arguments are optional
 * @returns Executable code string for the playground
 */
export function generateCodeString(
  accessor: string,
  nodeKind: string,
  isOptional: boolean,
): string {
  const args = getArgsString(accessor, isOptional);
  const callExpr = `$.slack.${accessor}(${args})`;

  return [
    "const app = mvfm(prelude, console_, slack_);",
    "const prog = app({}, ($) => {",
    `  const result = ${callExpr};`,
    "  return $.begin($.console.log(result), result);",
    "});",
    "await foldAST(defaults(app), prog);",
  ].join("\n");
}

/**
 * Determine the argument string for a Slack method call.
 */
function getArgsString(accessor: string, isOptional: boolean): string {
  if (WELL_KNOWN_ARGS[accessor]) {
    return WELL_KNOWN_ARGS[accessor];
  }
  if (isOptional) {
    return "";
  }
  return "{ /* see Slack API docs */ }";
}
