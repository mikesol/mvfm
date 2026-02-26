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

import type { CExpr, KindSpec, Liftable, Plugin } from "@mvfm/core";
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

// ---- Plugin definition ------------------------------------

/**
 * The resend plugin definition (unified Plugin type).
 *
 * Contributes `$.resend` with emails, batch, and contacts API.
 * Requires an interpreter provided via
 * `defaults(plugins, { resend: createResendInterpreter(client) })`.
 */
export const resend = {
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
} satisfies Plugin;

/**
 * Alias for {@link resend}, kept for readability at call sites.
 */
export const resendPlugin = resend;
