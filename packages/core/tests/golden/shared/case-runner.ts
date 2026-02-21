import type { Program } from "../../../src/index";
import { defaults, fold } from "../../../src/index";

export async function runWithDefaults(
  app: { plugins: readonly unknown[] },
  program: Program<unknown>,
) {
  return await fold(defaults(app as never), program as never);
}
