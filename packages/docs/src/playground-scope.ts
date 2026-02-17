/** Builds the injected scope for playground code execution. */
export async function createPlaygroundScope(
  fakeConsole: { log: (...args: unknown[]) => void },
  mockInterpreter?: Record<string, unknown>,
) {
  const core = await import("@mvfm/core");
  const pluginConsole = await import("@mvfm/plugin-console");
  const { console: _drop, consoleInterpreter: _defaultInterp, ...consoleRest } = pluginConsole;
  const fakeConsoleInterpreter = pluginConsole.createConsoleInterpreter(
    pluginConsole.wrapConsole(fakeConsole as any),
  );
  const realDefaults = core.defaults;

  // Group mock handler keys (e.g. "st/let") by plugin name (e.g. "st")
  // so they can be passed as overrides to defaults().
  const mockOverrides: Record<string, Record<string, unknown>> = {};
  if (mockInterpreter) {
    for (const [key, handler] of Object.entries(mockInterpreter)) {
      const pluginName = key.split("/")[0];
      if (!mockOverrides[pluginName]) mockOverrides[pluginName] = {};
      mockOverrides[pluginName][key] = handler;
    }
  }

  const injected: Record<string, unknown> = {
    ...core,
    console_: pluginConsole.consolePlugin(),
    ...consoleRest,
    consoleInterpreter: fakeConsoleInterpreter,
    defaults: (app: any, ...args: any[]) => {
      // Merge mock overrides into any user-provided overrides
      const userOverrides = (args[0] ?? {}) as Record<string, unknown>;
      const merged = { ...mockOverrides, ...userOverrides };
      const interp = realDefaults(app, merged);
      Object.assign(interp, fakeConsoleInterpreter);
      return interp;
    },
  };
  return {
    paramNames: ["console", ...Object.keys(injected)],
    paramValues: [fakeConsole, ...Object.values(injected)],
  };
}
