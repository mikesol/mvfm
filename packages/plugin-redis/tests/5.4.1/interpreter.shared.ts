import type { Program } from "@mvfm/core";
import { coreInterpreter, foldAST, injectInput, mvfm, num, str } from "@mvfm/core";
import { redis } from "../../src/5.4.1";
import { createRedisInterpreter, type RedisClient } from "../../src/5.4.1/interpreter";

export const app = mvfm(num, str, redis({ host: "127.0.0.1", port: 6379 }));

export async function run(prog: Program, input: Record<string, unknown> = {}) {
  const captured: Array<{ command: string; args: unknown[] }> = [];
  const injected = injectInput(prog, input);
  const mockClient: RedisClient = {
    async command(command: string, ...args: unknown[]) {
      captured.push({ command, args });
      return "mock_result";
    },
  };
  const combined = { ...createRedisInterpreter(mockClient), ...coreInterpreter };
  const result = await foldAST(combined, injected);
  return { result, captured };
}
