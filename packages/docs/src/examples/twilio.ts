import type { NodeExample } from "./types";

const TWILIO = ["@mvfm/plugin-twilio"];

const examples: Record<string, NodeExample> = {
  "twilio/create_message": {
    description: "Send an outbound SMS or MMS message",
    code: `const app = mvfm(prelude, console_, twilio_({ accountSid: "AC123", authToken: "secret" }));
const prog = app({}, ($) => {
  const message = $.twilio.messages.create({
    to: "+15551234567",
    from: "+15557654321",
    body: "Hello from mvfm",
  });
  return $.console.log(message);
});
await foldAST(defaults(app, { twilio: crystalBallTwilioInterpreter }), prog);`,
    plugins: TWILIO,
  },

  "twilio/fetch_message": {
    description: "Fetch a message by SID using the callable resource pattern",
    code: `const app = mvfm(prelude, console_, twilio_({ accountSid: "AC123", authToken: "secret" }));
const prog = app({}, ($) => {
  const message = $.twilio.messages("SM1234567890abcdef").fetch();
  return $.console.log(message);
});
await foldAST(defaults(app, { twilio: crystalBallTwilioInterpreter }), prog);`,
    plugins: TWILIO,
  },

  "twilio/list_messages": {
    description: "List messages with optional filters such as limit",
    code: `const app = mvfm(prelude, console_, twilio_({ accountSid: "AC123", authToken: "secret" }));
const prog = app({}, ($) => {
  const messages = $.twilio.messages.list({ limit: 10 });
  return $.console.log(messages);
});
await foldAST(defaults(app, { twilio: crystalBallTwilioInterpreter }), prog);`,
    plugins: TWILIO,
  },

  "twilio/create_call": {
    description: "Initiate an outbound call with TwiML URL instructions",
    code: `const app = mvfm(prelude, console_, twilio_({ accountSid: "AC123", authToken: "secret" }));
const prog = app({}, ($) => {
  const call = $.twilio.calls.create({
    to: "+15551234567",
    from: "+15557654321",
    url: "https://example.com/twiml/hello",
  });
  return $.console.log(call);
});
await foldAST(defaults(app, { twilio: crystalBallTwilioInterpreter }), prog);`,
    plugins: TWILIO,
  },

  "twilio/fetch_call": {
    description: "Fetch a call record by SID",
    code: `const app = mvfm(prelude, console_, twilio_({ accountSid: "AC123", authToken: "secret" }));
const prog = app({}, ($) => {
  const call = $.twilio.calls("CA1234567890abcdef").fetch();
  return $.console.log(call);
});
await foldAST(defaults(app, { twilio: crystalBallTwilioInterpreter }), prog);`,
    plugins: TWILIO,
  },

  "twilio/list_calls": {
    description: "List calls with optional query parameters",
    code: `const app = mvfm(prelude, console_, twilio_({ accountSid: "AC123", authToken: "secret" }));
const prog = app({}, ($) => {
  const calls = $.twilio.calls.list({ limit: 20 });
  return $.console.log(calls);
});
await foldAST(defaults(app, { twilio: crystalBallTwilioInterpreter }), prog);`,
    plugins: TWILIO,
  },
};

export default examples;
