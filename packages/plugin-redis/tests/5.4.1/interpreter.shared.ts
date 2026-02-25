import { composeDollar, createApp, defaults, fold, numPlugin, strPlugin } from "@mvfm/core";
import { redis } from "../../src/5.4.1";
import { createRedisInterpreter, type RedisClient } from "../../src/5.4.1/interpreter";

const plugin = redis;
export const plugins = [numPlugin, strPlugin, plugin] as const;
export const $ = composeDollar(...plugins);
export const app = createApp(...plugins);

export async function run(nexpr: ReturnType<typeof app>, _input?: Record<string, unknown>) {
  const captured: Array<{ command: string; args: unknown[] }> = [];
  const mockClient: RedisClient = {
    async command(command: string, ...args: unknown[]) {
      captured.push({ command, args });
      return "mock_result";
    },
  };
  const interp = defaults(plugins, { redis: createRedisInterpreter(mockClient) });
  const result = await fold(nexpr, interp);
  return { result, captured };
}
