import { fold } from "./fold";
import type { Interpreter, PluginDef } from "./fold-types";

export { fold };
export type { Handler, Interpreter, PluginDef, ScopedBinding, ScopedEffect } from "./fold-types";
export { VOLATILE_KINDS } from "./fold-types";

/** Compose default interpreters from plugin defs with optional per-plugin overrides. */
export function defaults(
  plugins: readonly PluginDef[],
  overrides: Record<string, Interpreter> = {},
): Interpreter {
  const out: Interpreter = {};
  const kindOwner = new Map<string, string>();
  for (const plugin of plugins) {
    let interp: Interpreter;
    if (plugin.name in overrides) {
      interp = overrides[plugin.name];
    } else if (plugin.defaultInterpreter) {
      interp = plugin.defaultInterpreter();
    } else if (plugin.nodeKinds.length === 0) {
      continue;
    } else {
      throw new Error(`Plugin "${plugin.name}" has no defaultInterpreter and no override`);
    }

    for (const [kind, handler] of Object.entries(interp)) {
      const existingOwner = kindOwner.get(kind);
      if (existingOwner) {
        throw new Error(
          `defaults: duplicate interpreter for "${kind}" from "${plugin.name}" (already registered by "${existingOwner}")`,
        );
      }
      kindOwner.set(kind, plugin.name);
      out[kind] = handler;
    }
  }
  return out;
}
