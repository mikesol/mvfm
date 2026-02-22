import type { CExpr, Interpreter, RuntimeEntry } from "@mvfm/core";
import { fetch } from "../whatwg";

// Verify the plugin returns the correct shape
const plugin = fetch();

// Name is the literal "fetch"
const _name: "fetch" = plugin.name;

// kinds includes all expected kind specs
const _kinds: string[] = Object.keys(plugin.kinds);

// defaultInterpreter returns an Interpreter
const _interp: Interpreter = plugin.defaultInterpreter();

// Each handler accepts RuntimeEntry
const _handler: (entry: RuntimeEntry) => AsyncGenerator<unknown, unknown, unknown> =
  _interp["fetch/request"];

// ctors.fetch is callable with kind strings in return types
const _fetchExpr: CExpr<unknown, "fetch/request", [string]> = plugin.ctors.fetch("url");
const _fetchWithInit: CExpr<unknown, "fetch/request", [string, { method: string }]> =
  plugin.ctors.fetch("url", { method: "POST" });
const _jsonExpr: CExpr<unknown, "fetch/json", [typeof _fetchExpr]> =
  plugin.ctors.fetch.json(_fetchExpr);
const _textExpr: CExpr<string, "fetch/text", [typeof _fetchExpr]> =
  plugin.ctors.fetch.text(_fetchExpr);
const _statusExpr: CExpr<number, "fetch/status", [typeof _fetchExpr]> =
  plugin.ctors.fetch.status(_fetchExpr);
const _headersExpr: CExpr<Record<string, string>, "fetch/headers", [typeof _fetchExpr]> =
  plugin.ctors.fetch.headers(_fetchExpr);

// Suppress unused variable warnings
void _name;
void _kinds;
void _interp;
void _handler;
void _fetchExpr;
void _fetchWithInit;
void _jsonExpr;
void _textExpr;
void _statusExpr;
void _headersExpr;
