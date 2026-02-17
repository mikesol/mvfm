import { describe, it } from "vitest";
import { getAllExamples } from "../src/examples";
import { createPlaygroundScope } from "../src/playground-scope";

const examples = getAllExamples();

describe("docs examples", () => {
  for (const [kind, example] of Object.entries(examples)) {
    it(`${kind} runs without error`, async () => {
      const logs: string[] = [];
      const noop = (...args: unknown[]) => logs.push(args.map(String).join(" "));
      const fakeConsole = {
        assert: noop,
        clear: noop,
        count: noop,
        countReset: noop,
        debug: noop,
        dir: noop,
        dirxml: noop,
        error: noop,
        group: noop,
        groupCollapsed: noop,
        groupEnd: noop,
        info: noop,
        log: noop,
        table: noop,
        time: noop,
        timeEnd: noop,
        timeLog: noop,
        trace: noop,
        warn: noop,
      };

      // For examples with mockInterpreter, we evaluate the mock inside the
      // AsyncFunction scope where eval_ and recurseScoped are available,
      // then build a fresh playground scope with the resolved mock.
      if (example.mockInterpreter) {
        // Step 1: get a base scope to access eval_/recurseScoped
        const base = await createPlaygroundScope(fakeConsole);
        const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

        // Step 2: evaluate mock interpreter inside scope
        const mockFn = new AsyncFunction(
          ...base.paramNames,
          `return (${example.mockInterpreter});`,
        );
        const mock = await mockFn(...base.paramValues);

        // Step 3: create scope with resolved mock
        const { paramNames, paramValues } = await createPlaygroundScope(fakeConsole, mock);
        const fn = new AsyncFunction(...paramNames, example.code);
        await fn(...paramValues);
      } else if (example.pglite) {
        // PGLite examples: spin up in-browser Postgres via PGLite
        const { PGlite } = await import("@electric-sql/pglite");
        const db = new PGlite();
        await db.exec(example.pglite.seedSQL);

        const { paramNames, paramValues } = await createPlaygroundScope(fakeConsole, undefined, db);
        const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
        const fn = new AsyncFunction(...paramNames, example.code);
        await fn(...paramValues);
      } else {
        const { paramNames, paramValues } = await createPlaygroundScope(fakeConsole);
        const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
        const fn = new AsyncFunction(...paramNames, example.code);
        await fn(...paramValues);
      }
    });
  }
});
