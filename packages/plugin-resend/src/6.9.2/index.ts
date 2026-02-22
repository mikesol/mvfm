// ============================================================
// MVFM PLUGIN: resend (resend-node compatible API) — unified Plugin
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// Implemented:
//   - Emails: send, get
//   - Batch: send
//   - Contacts: create, get, list, remove
// ============================================================

import type { CExpr, Interpreter, KindSpec, Plugin } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { wrapResendSdk } from "./client-resend-sdk";
import { createResendInterpreter, type ResendClient } from "./interpreter";

// ---- liftArg: recursive plain-value → CExpr lifting --------

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives are returned as-is (elaborate lifts them).
 * - Plain objects become `resend/record` CExprs with key-value child pairs.
 * - Arrays become `resend/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("resend/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("resend/record", pairs);
  }
  return value;
}

// liftArg erases generic type info at runtime (returns unknown).
// Cast helper restores the declared CExpr Args types for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

// ---- Configuration ----------------------------------------

/**
 * Configuration for the resend plugin.
 *
 * Requires an API key. The key is captured in the interpreter closure,
 * not stored on AST nodes.
 */
export interface ResendConfig {
  /** Resend API key (e.g. `re_123...`). */
  apiKey: string;
}

// ---- Constructor builder ----------------------------------

/**
 * Builds the resend constructor methods using makeCExpr + liftArg.
 *
 * Each method produces a CExpr node with positional children.
 * Config is NOT stored on AST nodes — it's captured by the interpreter.
 *
 * Constructors use permissive generics so any argument type is accepted
 * at construction time. Validation happens at `app()` time via KindSpec.
 */
function buildResendApi() {
  return {
    emails: {
      /** Send an email. */
      send<A>(params: A): CExpr<unknown, "resend/send_email", [A]> {
        return mk("resend/send_email", [liftArg(params)]);
      },
      /** Get an email by ID. */
      get<A>(id: A): CExpr<unknown, "resend/get_email", [A]> {
        return mk("resend/get_email", [id]);
      },
    },
    batch: {
      /** Send a batch of emails. */
      send<A>(emails: A): CExpr<unknown, "resend/send_batch", [A]> {
        if (isCExpr(emails)) {
          return mk("resend/send_batch", [emails]);
        }
        const lifted = makeCExpr(
          "resend/array",
          (emails as unknown[]).map((e) => liftArg(e)),
        );
        return mk("resend/send_batch", [lifted]);
      },
    },
    contacts: {
      /** Create a contact. */
      create<A>(params: A): CExpr<unknown, "resend/create_contact", [A]> {
        return mk("resend/create_contact", [liftArg(params)]);
      },
      /** Get a contact by ID. */
      get<A>(id: A): CExpr<unknown, "resend/get_contact", [A]> {
        return mk("resend/get_contact", [id]);
      },
      /** List all contacts. */
      list(): CExpr<unknown, "resend/list_contacts", []> {
        return mk("resend/list_contacts", []);
      },
      /** Remove a contact by ID. */
      remove<A>(id: A): CExpr<unknown, "resend/remove_contact", [A]> {
        return mk("resend/remove_contact", [id]);
      },
    },
  };
}

// ---- Default interpreter wiring ---------------------------

const dynamicImport = new Function("m", "return import(m)") as (
  moduleName: string,
) => Promise<Record<string, unknown>>;

function createDefaultInterpreter(config: ResendConfig): Interpreter {
  let clientPromise: Promise<ResendClient> | undefined;
  const getClient = async (): Promise<ResendClient> => {
    if (!clientPromise) {
      clientPromise = dynamicImport("resend").then((moduleValue) => {
        const Resend = moduleValue.Resend as new (key: string) => Record<string, unknown>;
        return wrapResendSdk(
          new Resend(config.apiKey) as unknown as Parameters<typeof wrapResendSdk>[0],
        );
      });
    }
    return clientPromise;
  };

  const lazyClient: ResendClient = {
    async request(method: string, path: string, params?: unknown): Promise<unknown> {
      const client = await getClient();
      return client.request(method, path, params);
    },
  };

  return createResendInterpreter(lazyClient);
}

// ---- Plugin factory ---------------------------------------

/**
 * Creates the resend plugin definition (unified Plugin type).
 *
 * @param config - A {@link ResendConfig} with apiKey.
 * @returns A unified Plugin that contributes `$.resend`.
 */
export function resend(config: ResendConfig) {
  return {
    name: "resend" as const,
    ctors: { resend: buildResendApi() },
    kinds: {
      "resend/send_email": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "resend/get_email": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "resend/send_batch": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "resend/create_contact": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "resend/get_contact": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "resend/list_contacts": {
        inputs: [] as [],
        output: undefined as unknown,
      } as KindSpec<[], unknown>,
      "resend/remove_contact": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "resend/record": {
        inputs: [] as unknown[],
        output: {} as Record<string, unknown>,
      } as KindSpec<unknown[], Record<string, unknown>>,
      "resend/array": {
        inputs: [] as unknown[],
        output: [] as unknown[],
      } as KindSpec<unknown[], unknown[]>,
    },
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => createDefaultInterpreter(config),
  } satisfies Plugin;
}

/**
 * Alias for {@link resend}, kept for readability at call sites.
 */
export const resendPlugin = resend;
