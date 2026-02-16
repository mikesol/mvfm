// ============================================================
// MVFM — defaults() — compose interpreter from plugin defaults
// ============================================================

import type { Interpreter } from "./fold";
import { coreInterpreter } from "./interpreters/core";
import type { PluginInput } from "./types";

// ---- Type-level helpers -------------------------------------

/** Detect whether a plugin structurally has `defaultInterpreter`. */
type HasDefault<P> = P extends { defaultInterpreter: Record<string, any> } ? true : false;

/**
 * Identify plugins that require an override (no defaultInterpreter
 * and at least one nodeKind).
 * @internal
 */
type PluginsNeedingOverride<Plugins extends readonly any[]> = {
  [K in keyof Plugins]: HasDefault<Plugins[K]> extends true
    ? never
    : Plugins[K] extends { name: infer _N extends string }
      ? Plugins[K]
      : never;
}[number];

/**
 * Extract plugin names that MUST be provided as overrides.
 * @internal
 */
type OverrideKeys<Plugins extends readonly any[]> =
  PluginsNeedingOverride<Plugins> extends never
    ? never
    : PluginsNeedingOverride<Plugins> extends { name: infer N extends string }
      ? N
      : never;

/**
 * Union of all plugin name literals in the tuple.
 * @internal
 */
type AllPluginNames<Plugins extends readonly any[]> = {
  [K in keyof Plugins]: Plugins[K] extends { name: infer N extends string } ? N : never;
}[number];

/**
 * The overrides map type: required keys for plugins lacking defaults,
 * optional keys for plugins that have defaults (allowing override).
 * @internal
 */
type OverridesMap<Plugins extends readonly any[]> = {
  [K in OverrideKeys<Plugins>]: Interpreter;
} & {
  [K in Exclude<AllPluginNames<Plugins>, OverrideKeys<Plugins>>]?: Interpreter;
};

/**
 * When no overrides are needed the argument is optional;
 * otherwise it is required.
 * @internal
 */
type DefaultsArgs<Plugins extends readonly any[]> =
  OverrideKeys<Plugins> extends never
    ? [overrides?: Partial<Record<AllPluginNames<Plugins>, Interpreter>>]
    : [overrides: OverridesMap<Plugins>];

// ---- Runtime ------------------------------------------------

/**
 * Compose a complete interpreter from core + plugin defaults + overrides.
 *
 * If every plugin provides `defaultInterpreter`, the overrides argument
 * is optional. If any plugin lacks a default, TypeScript requires the
 * caller to supply an interpreter for that plugin by name.
 *
 * @example
 * ```ts
 * const app = mvfm(num, str);
 * // num and str both have defaultInterpreter → overrides optional
 * const interp = defaults(app);
 * ```
 *
 * @example
 * ```ts
 * const app = mvfm(num, db);
 * // db lacks defaultInterpreter → must provide override
 * const interp = defaults(app, { db: myDbInterpreter });
 * ```
 */
export function defaults<const P extends readonly PluginInput[]>(
  app: { readonly plugins: P },
  ...args: DefaultsArgs<P>
): Interpreter {
  const overrides = (args[0] ?? {}) as Record<string, Interpreter>;
  const plugins = app.plugins as unknown as any[];
  const composed: Interpreter = { ...coreInterpreter };

  for (const plugin of plugins) {
    const name: string = plugin.name;
    if (name in overrides) {
      Object.assign(composed, overrides[name]);
    } else if (plugin.defaultInterpreter) {
      Object.assign(composed, plugin.defaultInterpreter);
    } else {
      throw new Error(
        `Plugin "${name}" has no defaultInterpreter and no override was provided. ` +
          `Pass { ${name}: interpreter } in the overrides argument.`,
      );
    }
  }

  return composed;
}
