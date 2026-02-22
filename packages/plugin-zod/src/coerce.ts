import { ZodNumberBuilder } from "./number";
import { ZodStringBuilder } from "./string";

/** Build the coerce namespace factory methods. */
export function coerceNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    coerce: {
      string: (e?: string | { error?: string }) =>
        new ZodStringBuilder([], [], parseError(e), { coerce: true }),
      number: (e?: string | { error?: string }) =>
        new ZodNumberBuilder([], [], parseError(e), { coerce: true }),
    },
  };
}
