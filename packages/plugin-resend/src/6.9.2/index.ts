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

import type { CExpr, Interpreter, KindSpec } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import type {
  CreateBatchOptions,
  CreateBatchSuccessResponse,
  CreateContactOptions,
  CreateContactResponseSuccess,
  CreateEmailOptions,
  CreateEmailResponseSuccess,
  GetContactResponseSuccess,
  GetEmailResponseSuccess,
  LegacyCreateContactOptions,
  ListContactsResponseSuccess,
  RemoveContactsResponseSuccess,
} from "resend";
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

// ---- What the plugin adds to $ ----------------------------

/**
 * Resend operations added to the DSL context by the resend plugin.
 *
 * Mirrors the resend-node SDK resource API: emails, batch, and
 * contacts. Each resource exposes methods that produce CExpr nodes.
 */
export interface ResendMethods {
  /** Resend API operations, namespaced under `$.resend`. */
  resend: {
    emails: {
      /** Send an email. */
      send(
        params: CreateEmailOptions | CExpr<CreateEmailOptions>,
      ): CExpr<CreateEmailResponseSuccess>;
      /** Get an email by ID. */
      get(id: string | CExpr<string>): CExpr<GetEmailResponseSuccess>;
    };
    batch: {
      /** Send a batch of emails. */
      send(
        emails: CreateBatchOptions | CExpr<CreateBatchOptions>,
      ): CExpr<CreateBatchSuccessResponse>;
    };
    contacts: {
      /** Create a contact. */
      create(
        params:
          | CreateContactOptions
          | LegacyCreateContactOptions
          | CExpr<CreateContactOptions | LegacyCreateContactOptions>,
      ): CExpr<CreateContactResponseSuccess>;
      /** Get a contact by ID. */
      get(id: string | CExpr<string>): CExpr<GetContactResponseSuccess>;
      /** List all contacts. */
      list(): CExpr<ListContactsResponseSuccess>;
      /** Remove a contact by ID. */
      remove(id: string | CExpr<string>): CExpr<RemoveContactsResponseSuccess>;
    };
  };
}

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

// ---- Node kinds -------------------------------------------

const NODE_KINDS = [
  "resend/send_email",
  "resend/get_email",
  "resend/send_batch",
  "resend/create_contact",
  "resend/get_contact",
  "resend/list_contacts",
  "resend/remove_contact",
  "resend/record",
  "resend/array",
] as const;

function buildKinds(): Record<string, KindSpec<unknown[], unknown>> {
  const kinds: Record<string, KindSpec<unknown[], unknown>> = {};
  for (const kind of NODE_KINDS) {
    kinds[kind] = {
      inputs: [] as unknown[],
      output: undefined as unknown,
    } as KindSpec<unknown[], unknown>;
  }
  return kinds;
}

// ---- Constructor builder ----------------------------------

function buildResendApi(): ResendMethods["resend"] {
  return {
    emails: {
      send(params) {
        return makeCExpr("resend/send_email", [liftArg(params)]);
      },
      get(id) {
        return makeCExpr("resend/get_email", [id]);
      },
    },
    batch: {
      send(emails) {
        if (isCExpr(emails)) {
          return makeCExpr("resend/send_batch", [emails]);
        }
        const lifted = makeCExpr(
          "resend/array",
          (emails as CreateBatchOptions).map((e) => liftArg(e)),
        );
        return makeCExpr("resend/send_batch", [lifted]);
      },
    },
    contacts: {
      create(params) {
        return makeCExpr("resend/create_contact", [liftArg(params)]);
      },
      get(id) {
        return makeCExpr("resend/get_contact", [id]);
      },
      list() {
        return makeCExpr("resend/list_contacts", []);
      },
      remove(id) {
        return makeCExpr("resend/remove_contact", [id]);
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
        return wrapResendSdk(new Resend(config.apiKey) as Parameters<typeof wrapResendSdk>[0]);
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
    kinds: buildKinds(),
    traits: {},
    lifts: {},
    nodeKinds: [...NODE_KINDS],
    defaultInterpreter: (): Interpreter => createDefaultInterpreter(config),
  };
}

/**
 * Alias for {@link resend}, kept for readability at call sites.
 */
export const resendPlugin = resend;
