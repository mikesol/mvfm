import { mvfm, num, str } from "@mvfm/core";
import { slack } from "../../src/7.14.0";

export function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

export const app = mvfm(num, str, slack({ token: "xoxb-test-token" }));
