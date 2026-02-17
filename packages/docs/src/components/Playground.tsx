import { useState, useCallback, useEffect, useRef } from "react";
import _Editor from "react-simple-code-editor";
// Handle CJS default export
const Editor = (_Editor as any).default || _Editor;
import { createHighlighter, type Highlighter } from "shiki";

import { MONO_THEME } from "../themes/mono";

interface PlaygroundProps {
  code: string;
}

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

export default function Playground({ code: initialCode }: PlaygroundProps) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<string>("");
  const [isError, setIsError] = useState(false);
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getHighlighter().then(setHighlighter);
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

  const run = useCallback(async () => {
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

    try {
      const { createPlaygroundScope } = await import("../playground-scope");
      const scope = await createPlaygroundScope(fakeConsole);
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
        parts.push(`→ ${formatted}`);
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
  }, [code]);

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
