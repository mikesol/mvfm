import type { Interpreter } from "@mvfm/core";
import { createResendInterpreter, type ResendClient } from "./interpreter";

/**
 * Creates a server-side interpreter for `resend/*` node kinds.
 *
 * @param client - The {@link ResendClient} to execute against.
 * @returns An Interpreter for resend node kinds.
 */
export function serverInterpreter(client: ResendClient): Interpreter {
  return createResendInterpreter(client);
}
