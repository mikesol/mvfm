/** Builds the injected scope for playground code execution. */
export async function createPlaygroundScope(
  fakeConsole: Record<string, (...args: unknown[]) => void>,
  mockInterpreter?: Record<string, unknown>,
  pgliteDb?: unknown,
) {
  const core = await import("@mvfm/core");
  const pluginConsole = await import("@mvfm/plugin-console");
  const pluginZod = await import("@mvfm/plugin-zod");
  const { console: _drop, consoleInterpreter: _defaultInterp, ...consoleRest } = pluginConsole;
  const fakeConsoleInterpreter = pluginConsole.createConsoleInterpreter(
    pluginConsole.wrapConsole(fakeConsole as any),
  );
  const realDefaults = core.defaults;
  const realFoldAST = core.foldAST;

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

  // Track the last foldAST return value for display in the playground.
  let lastFoldResult: unknown;

  const injected: Record<string, unknown> = {
    ...core,
    console_: pluginConsole.consolePlugin(),
    ...consoleRest,
    zod: pluginZod.zod,
    z: pluginZod.z,
    createZodInterpreter: pluginZod.createZodInterpreter,
    consoleInterpreter: fakeConsoleInterpreter,
  };

  // Wire PGLite-backed postgres when a db instance is provided
  if (pgliteDb) {
    const pluginPostgres = await import("@mvfm/plugin-postgres");
    const { wrapPgLite } = await import("./pglite-adapter");
    const pg = pluginPostgres.postgres();
    const client = wrapPgLite(pgliteDb as any);
    injected.pg = pg;

    // Build the WASM postgres interpreter eagerly so examples pass it
    // explicitly: defaults(app, { postgres: wasmPgInterpreter })
    const baseInterp: Record<string, unknown> = {
      ...(core.coreInterpreter as any),
      ...fakeConsoleInterpreter,
    };
    injected.wasmPgInterpreter = pluginPostgres.serverInterpreter(client, baseInterp as any);

    injected.defaults = (app: any, ...args: any[]) => {
      const userOverrides = (args[0] ?? {}) as Record<string, unknown>;
      const interp = realDefaults(app, {
        ...mockOverrides,
        ...userOverrides,
      });
      Object.assign(interp, fakeConsoleInterpreter);
      return interp;
    };
  } else {
    injected.defaults = (app: any, ...args: any[]) => {
      const userOverrides = (args[0] ?? {}) as Record<string, unknown>;
      const merged = { ...mockOverrides, ...userOverrides };
      const interp = realDefaults(app, merged);
      Object.assign(interp, fakeConsoleInterpreter);
      return interp;
    };
  }

  injected.foldAST = async (...args: any[]) => {
    const result = await (realFoldAST as any)(...args);
    lastFoldResult = result;
    return result;
  };

  return {
    paramNames: ["console", ...Object.keys(injected)],
    paramValues: [fakeConsole, ...Object.values(injected)],
    get lastFoldResult() {
      return lastFoldResult;
    },
  };
}
