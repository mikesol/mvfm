import type { Interpreter, RuntimeEntry } from "@mvfm/core";
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

// ctors.fetch is callable
const _fetchExpr = plugin.ctors.fetch("url");
const _fetchWithInit = plugin.ctors.fetch("url", { method: "POST" });
const _jsonExpr = plugin.ctors.fetch.json(_fetchExpr);
const _textExpr = plugin.ctors.fetch.text(_fetchExpr);
const _statusExpr = plugin.ctors.fetch.status(_fetchExpr);
const _headersExpr = plugin.ctors.fetch.headers(_fetchExpr);

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
