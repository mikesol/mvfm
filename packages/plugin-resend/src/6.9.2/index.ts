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

import type { CExpr, Interpreter, KindSpec, Liftable, Plugin } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";
import type {
  CreateBatchOptions,
  CreateContactOptions,
  CreateContactResponseSuccess,
  CreateEmailOptions,
  CreateEmailResponseSuccess,
  GetContactResponseSuccess,
  GetEmailResponseSuccess,
  ListContactsResponseSuccess,
  RemoveContactsResponseSuccess,
} from "resend";
import { wrapResendSdk } from "./client-resend-sdk";
import { createResendInterpreter, type ResendClient } from "./interpreter";

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
 * Builds the resend constructor methods using makeCExpr.
 *
 * Constructors use Liftable<T> for object params and string | CExpr<string>
 * for ID params. Validation happens at `app()` time via KindSpec.
 */
function buildResendApi() {
  return {
    emails: {
      /** Send an email. */
      send(
        params: Liftable<CreateEmailOptions>,
      ): CExpr<CreateEmailResponseSuccess, "resend/send_email", [Liftable<CreateEmailOptions>]> {
        return makeCExpr("resend/send_email", [params]) as any;
      },
      /** Get an email by ID. */
      get(
        id: string | CExpr<string>,
      ): CExpr<GetEmailResponseSuccess, "resend/get_email", [string | CExpr<string>]> {
        return makeCExpr("resend/get_email", [id]) as any;
      },
    },
    batch: {
      /** Send a batch of emails. */
      send(
        emails: Liftable<CreateBatchOptions>,
      ): CExpr<CreateEmailResponseSuccess[], "resend/send_batch", [Liftable<CreateBatchOptions>]> {
        return makeCExpr("resend/send_batch", [emails]) as any;
      },
    },
    contacts: {
      /** Create a contact. */
      create(
        params: Liftable<CreateContactOptions>,
      ): CExpr<
        CreateContactResponseSuccess,
        "resend/create_contact",
        [Liftable<CreateContactOptions>]
      > {
        return makeCExpr("resend/create_contact", [params]) as any;
      },
      /** Get a contact by ID. */
      get(
        id: string | CExpr<string>,
      ): CExpr<GetContactResponseSuccess, "resend/get_contact", [string | CExpr<string>]> {
        return makeCExpr("resend/get_contact", [id]) as any;
      },
      /** List all contacts. */
      list(): CExpr<ListContactsResponseSuccess, "resend/list_contacts", []> {
        return makeCExpr("resend/list_contacts", []) as any;
      },
      /** Remove a contact by ID. */
      remove(
        id: string | CExpr<string>,
      ): CExpr<RemoveContactsResponseSuccess, "resend/remove_contact", [string | CExpr<string>]> {
        return makeCExpr("resend/remove_contact", [id]) as any;
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
        inputs: [undefined as unknown as CreateEmailOptions],
        output: undefined as unknown as CreateEmailResponseSuccess,
      } as KindSpec<[CreateEmailOptions], CreateEmailResponseSuccess>,
      "resend/get_email": {
        inputs: [""] as [string],
        output: undefined as unknown as GetEmailResponseSuccess,
      } as KindSpec<[string], GetEmailResponseSuccess>,
      "resend/send_batch": {
        inputs: [undefined as unknown as CreateBatchOptions],
        output: undefined as unknown as CreateEmailResponseSuccess[],
      } as KindSpec<[CreateBatchOptions], CreateEmailResponseSuccess[]>,
      "resend/create_contact": {
        inputs: [undefined as unknown as CreateContactOptions],
        output: undefined as unknown as CreateContactResponseSuccess,
      } as KindSpec<[CreateContactOptions], CreateContactResponseSuccess>,
      "resend/get_contact": {
        inputs: [""] as [string],
        output: undefined as unknown as GetContactResponseSuccess,
      } as KindSpec<[string], GetContactResponseSuccess>,
      "resend/list_contacts": {
        inputs: [] as [],
        output: undefined as unknown as ListContactsResponseSuccess,
      } as KindSpec<[], ListContactsResponseSuccess>,
      "resend/remove_contact": {
        inputs: [""] as [string],
        output: undefined as unknown as RemoveContactsResponseSuccess,
      } as KindSpec<[string], RemoveContactsResponseSuccess>,
    },
    shapes: {
      "resend/send_email": "*",
      "resend/send_batch": "*",
      "resend/create_contact": "*",
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
