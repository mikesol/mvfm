import type { NodeExample } from "./types";

const RESEND = ["@mvfm/plugin-resend"];

const examples: Record<string, NodeExample> = {
  "resend/send_email": {
    description: "Send an email via Resend",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const result = $.resend.emails.send({
    from: "onboarding@resend.dev",
    to: "user@example.com",
    subject: "Hello World",
    html: "<p>Welcome!</p>",
  });
  return $.console.log(result);
});
await fold(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/get_email": {
    description: "Retrieve an email by its ID",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const email = $.resend.emails.get("email_abc123");
  return $.console.log(email);
});
await fold(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/send_batch": {
    description: "Send a batch of emails in a single API call",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const batch = $.resend.batch.send([
    { from: "onboarding@resend.dev", to: "user1@example.com", subject: "Hi 1", html: "<p>Email 1</p>" },
    { from: "onboarding@resend.dev", to: "user2@example.com", subject: "Hi 2", html: "<p>Email 2</p>" },
  ]);
  return $.console.log(batch);
});
await fold(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/create_contact": {
    description: "Create a contact in Resend",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const contact = $.resend.contacts.create({
    email: "user@example.com",
    firstName: "John",
  });
  return $.console.log(contact);
});
await fold(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/get_contact": {
    description: "Retrieve a contact by ID",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const contact = $.resend.contacts.get("contact_abc123");
  return $.console.log(contact);
});
await fold(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/list_contacts": {
    description: "List all contacts",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const contacts = $.resend.contacts.list();
  return $.console.log(contacts);
});
await fold(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },

  "resend/remove_contact": {
    description: "Remove a contact by ID",
    code: `const app = mvfm(prelude, console_, resend_);
const prog = app({}, ($) => {
  const result = $.resend.contacts.remove("contact_abc123");
  return $.console.log(result);
});
await fold(defaults(app, { resend: crystalBallResendInterpreter }), prog);`,
    plugins: RESEND,
  },
};

export default examples;
