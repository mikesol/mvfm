import { useState, useCallback, useEffect, useRef } from "react";
import _Editor from "react-simple-code-editor";
// Handle CJS default export
const Editor = (_Editor as any).default || _Editor;
import { createHighlighter, type Highlighter } from "shiki";
import type { ConsoleInstance } from "@mvfm/plugin-console";

import { MONO_THEME } from "../themes/mono";

interface PlaygroundProps {
  code: string;
  pglite?: { seedSQL: string };
  mockInterpreter?: string;
  redis?: true;
  s3?: true;
  cloudflareKv?: true;
}

type DbState = "idle" | "loading" | "ready" | "error";

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [MONO_THEME],
      langs: ["typescript"],
    });
  }
  return highlighterPromise;
}

export default function Playground({ code: initialCode, pglite, mockInterpreter, redis, s3, cloudflareKv }: PlaygroundProps) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<string>("");
  const [isError, setIsError] = useState(false);
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [dbState, setDbState] = useState<DbState>(pglite ? "loading" : "idle");
  const [dbError, setDbError] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const dbRef = useRef<unknown>(null);

  useEffect(() => {
    getHighlighter().then(setHighlighter);
  }, []);

  // PGLite initialization
  useEffect(() => {
    if (!pglite) return;
    let cancelled = false;
    (async () => {
      try {
        const { PGlite } = await import("@electric-sql/pglite");
        const db = new PGlite();
        await db.exec(pglite.seedSQL);
        if (!cancelled) {
          dbRef.current = db;
          setDbState("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setDbState("error");
          setDbError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const highlight = useCallback(
    (value: string) => {
      if (!highlighter) return value;
      return highlighter.codeToHtml(value, {
        lang: "typescript",
        theme: "mvfm-mono",
      }).replace(/^<pre[^>]*><code[^>]*>/, "").replace(/<\/code><\/pre>$/, "");
    },
    [highlighter],
  );

  const parsedMockInterpreter = useRef<Record<string, unknown> | undefined>(undefined);
  if (mockInterpreter && !parsedMockInterpreter.current) {
    try {
      parsedMockInterpreter.current = new Function(`return (${mockInterpreter})`)();
    } catch { /* ignore parse errors */ }
  }

  const resetDb = useCallback(async () => {
    if (!dbRef.current || !pglite) return;
    await (dbRef.current as any).exec(pglite.seedSQL);
    setOutput("");
    setIsError(false);
  }, [pglite]);

  const run = useCallback(async () => {
    if (pglite && dbState !== "ready") return;

    const logs: string[] = [];
    const noop = (...args: unknown[]) =>
      logs.push(args.map((a) => typeof a === "string" ? a : JSON.stringify(a, null, 2)).join(" "));
    const fakeConsole: Record<string, (...args: unknown[]) => void> = {};
    for (const m of [
      "assert", "clear", "count", "countReset", "debug", "dir", "dirxml",
      "error", "group", "groupCollapsed", "groupEnd", "info", "log",
      "table", "time", "timeEnd", "timeLog", "trace", "warn",
    ]) {
      fakeConsole[m] = noop;
    }
    const typedConsole = fakeConsole as unknown as ConsoleInstance;

    try {
      const { createPlaygroundScope } = await import("../playground-scope");
      const scope = await createPlaygroundScope(
        typedConsole,
        parsedMockInterpreter.current,
        pglite ? (dbRef.current as import("../pglite-adapter").PgLiteQueryable) : undefined,
        redis,
        s3,
        cloudflareKv,
      );
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction(...scope.paramNames, code);
      await fn(...scope.paramValues);
      setIsError(false);
      const parts: string[] = [];
      if (logs.length > 0) parts.push(logs.join("\n"));
      if (scope.lastFoldResult !== undefined) {
        const formatted = typeof scope.lastFoldResult === "string"
          ? scope.lastFoldResult
          : JSON.stringify(scope.lastFoldResult, null, 2);
        parts.push(`\u2192 ${formatted}`);
      }
      setOutput(parts.join("\n"));
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      let line: number | null = null;
      if (err.stack) {
        const m = err.stack.match(/<anonymous>:(\d+):\d+/);
        if (m) {
          const raw = parseInt(m[1], 10);
          line = raw > 2 ? raw - 2 : null;
        }
      }
      setIsError(true);
      const prefix = line != null ? `Line ${line}: ` : "";
      setOutput(prefix + err.message);
    }
  }, [code, pglite, dbState, redis, s3, cloudflareKv]);

  if (dbState === "loading") {
    return (
      <div className="flex items-center gap-3 py-12">
        <div className="h-4 w-4 border-2 border-base-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-base-500 tracking-wide">Initializing database...</span>
      </div>
    );
  }

  if (dbState === "error") {
    return (
      <div className="py-12">
        <pre className="text-sm text-base-500">Failed to load PGLite: {dbError}</pre>
      </div>
    );
  }

  return (
    <>
      <div className={`playground-editor${highlighter ? " playground-ready" : ""}`}>
        <div
          ref={editorRef}
          className="border border-base-800 focus-within:border-base-600 transition-colors"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
        >
          <Editor
            value={code}
            onValueChange={setCode}
            highlight={highlight}
            padding={16}
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
              fontSize: "0.875rem",
              lineHeight: "1.625",
              backgroundColor: "#0a0a0a",
              color: "#a3a3a3",
              tabSize: 2,
            }}
            textareaClassName="outline-none"
          />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={run}
          type="button"
          className="px-4 py-1.5 text-sm tracking-widest font-medium bg-base-50 text-base-950 hover:bg-base-200 transition-colors cursor-pointer"
        >
          RUN
        </button>
        {pglite && (
          <button
            onClick={resetDb}
            type="button"
            className="px-4 py-1.5 text-sm tracking-widest font-medium border border-base-700 text-base-400 hover:border-base-500 hover:text-base-300 transition-colors cursor-pointer"
          >
            RESET DB
          </button>
        )}
        <span className="text-xs text-base-600">Ctrl+Enter</span>
      </div>
      {output && (
        <pre className="mt-4 p-4 bg-base-900 border border-base-800 font-mono text-sm leading-relaxed text-base-300 whitespace-pre-wrap break-words overflow-auto">
          {isError && <span className="text-base-500">error — </span>}{output}
        </pre>
      )}
    </>
  );
}
