import { mvfm, num, str } from "@mvfm/core";
import { redis } from "../../src/5.4.1";

export function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

export const app = mvfm(num, str, redis({ host: "127.0.0.1", port: 6379 }));
