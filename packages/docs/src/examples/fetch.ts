import type { NodeExample } from "./types";

const FETCH = ["@mvfm/plugin-fetch"];

const examples: Record<string, NodeExample> = {
  "fetch/request": {
    description: "Make an HTTP GET request and read the response as text",
    code: `const app = mvfm(prelude, console_, fetch_);
const prog = app({}, ($) => {
  const response = $.fetch("https://httpbin.org/get");
  const body = $.fetch.text(response);
  return $.console.log(body);
});
await fold(defaults(app), prog);`,
    plugins: FETCH,
  },

  "fetch/json": {
    description: "Parse an HTTP response body as JSON",
    code: `const app = mvfm(prelude, console_, fetch_);
const prog = app({}, ($) => {
  const response = $.fetch("https://httpbin.org/json");
  const data = $.fetch.json(response);
  return $.console.log(data);
});
await fold(defaults(app), prog);`,
    plugins: FETCH,
  },

  "fetch/text": {
    description: "Read an HTTP response body as plain text",
    code: `const app = mvfm(prelude, console_, fetch_);
const prog = app({}, ($) => {
  const response = $.fetch("https://httpbin.org/robots.txt");
  const text = $.fetch.text(response);
  return $.console.log(text);
});
await fold(defaults(app), prog);`,
    plugins: FETCH,
  },

  "fetch/status": {
    description: "Get the HTTP status code from a response",
    code: `const app = mvfm(prelude, console_, fetch_);
const prog = app({}, ($) => {
  const response = $.fetch("https://httpbin.org/status/200");
  const code = $.fetch.status(response);
  return $.console.log(code);
});
await fold(defaults(app), prog);`,
    plugins: FETCH,
  },

  "fetch/headers": {
    description: "Get the response headers as a key-value record",
    code: `const app = mvfm(prelude, console_, fetch_);
const prog = app({}, ($) => {
  const response = $.fetch("https://httpbin.org/response-headers?X-Custom=hello");
  const hdrs = $.fetch.headers(response);
  return $.console.log(hdrs);
});
await fold(defaults(app), prog);`,
    plugins: FETCH,
  },
};

export default examples;
