// ============================================================
// MVFM PLUGIN: resend (resend-node compatible API)
// ============================================================
//
// Implementation status: PARTIAL (3 of 11 resources)
// Plugin size: MEDIUM — at pass 1 of 75/25 split
//
// Implemented:
//   - Emails: send, get
//   - Batch: send
//   - Contacts: create, get, list, remove
//
// Not doable (fundamental mismatch with AST model):
//   - Webhooks: push-based event model, not request/response
//   - React email rendering: build-time side effect (JSX → HTML),
//     not representable as an AST node
//
// Remaining (same pattern, add as needed):
//   emails.cancel, emails.update, emails.list,
//   domains (create, get, list, update, delete, verify),
//   segments, broadcasts, apiKeys,
//   templates, topics, contactProperties
//
//   Each resource follows the same pattern: add node kinds,
//   add methods to ResendMethods, add switch cases to the
//   interpreter. The interpreter/handler architecture does
//   not need to change — resend/api_call covers everything.
//
// ============================================================
//
// Goal: An LLM that knows resend-node should be able to write
// Mvfm programs with near-zero learning curve. The API should
// look like the real resend-node SDK as closely as possible.
//
// Real resend-node API (v6.9.2):
//   const resend = new Resend('re_123...')
//   const { data } = await resend.emails.send({ from: '...', to: '...', subject: '...', html: '...' })
//   const { data } = await resend.emails.get('email_123')
//   const { data } = await resend.batch.send([{ from: '...', to: '...', ... }, ...])
//   const { data } = await resend.contacts.create({ email: '...' })
//   const { data } = await resend.contacts.get('contact_id')
//   const { data } = await resend.contacts.list()
//   const { data } = await resend.contacts.remove('contact_id')
//
// Based on source-level analysis of resend-node
// (github.com/resend/resend-node). The SDK uses a class-based
// resource pattern with each resource (Emails, Batch, Contacts,
// etc.) as a separate class instantiated with the Resend client.
//
// ============================================================

import type { Expr, PluginContext } from "@mvfm/core";
import { definePlugin } from "@mvfm/core";
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
import { resendInterpreter } from "./interpreter";

export type ExprOrValue<T> = Expr<T> | T;

// ---- What the plugin adds to $ ----------------------------

/**
 * Resend operations added to the DSL context by the resend plugin.
 *
 * Mirrors the resend-node SDK resource API: emails, batch, and
 * contacts. Each resource exposes methods that produce namespaced
 * AST nodes.
 */
export interface ResendMethods {
  /** Resend API operations, namespaced under `$.resend`. */
  resend: {
    emails: {
      /** Send an email. */
      send(params: ExprOrValue<CreateEmailOptions>): Expr<CreateEmailResponseSuccess>;
      /** Get an email by ID. */
      get(id: Expr<string> | string): Expr<GetEmailResponseSuccess>;
    };
    batch: {
      /** Send a batch of emails. */
      send(emails: ExprOrValue<CreateBatchOptions>): Expr<CreateBatchSuccessResponse>;
    };
    contacts: {
      /** Create a contact. */
      create(
        params: ExprOrValue<CreateContactOptions | LegacyCreateContactOptions>,
      ): Expr<CreateContactResponseSuccess>;
      /** Get a contact by ID. */
      get(id: Expr<string> | string): Expr<GetContactResponseSuccess>;
      /** List all contacts. */
      list(): Expr<ListContactsResponseSuccess>;
      /** Remove a contact by ID. */
      remove(id: Expr<string> | string): Expr<RemoveContactsResponseSuccess>;
    };
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the resend plugin.
 *
 * Requires an API key. The key is baked into every AST node so
 * the interpreter can authenticate requests at evaluation time.
 */
export interface ResendConfig {
  /** Resend API key (e.g. `re_123...`). */
  apiKey: string;
}

// ---- Plugin implementation --------------------------------

/**
 * Resend plugin factory. Namespace: `resend/`.
 *
 * Creates a plugin that exposes email sending, batch sending, and
 * contact management methods for building parameterized Resend API
 * call AST nodes.
 *
 * @param config - A {@link ResendConfig} with apiKey.
 * @returns A PluginDefinition for the resend plugin.
 */
export function resend(config: ResendConfig) {
  return definePlugin({
    name: "resend",
    nodeKinds: [
      "resend/send_email",
      "resend/get_email",
      "resend/send_batch",
      "resend/create_contact",
      "resend/get_contact",
      "resend/list_contacts",
      "resend/remove_contact",
    ],
    defaultInterpreter: resendInterpreter,

    build(ctx: PluginContext): ResendMethods {
      // Helper: resolve an id argument to an AST node.
      // If it's already an Expr, use its __node; otherwise lift the raw value.
      function resolveId(id: Expr<string> | string) {
        return ctx.isExpr(id) ? id.__node : ctx.lift(id).__node;
      }

      // Helper: resolve a params object to an AST node.
      // ctx.lift handles both Expr and raw objects (lifts to core/record).
      function resolveParams<T>(params: ExprOrValue<T>) {
        return ctx.lift(params).__node;
      }

      return {
        resend: {
          emails: {
            send(params) {
              return ctx.expr({
                kind: "resend/send_email",
                params: resolveParams(params),
                config,
              });
            },

            get(id) {
              return ctx.expr({
                kind: "resend/get_email",
                id: resolveId(id),
                config,
              });
            },
          },

          batch: {
            send(emails) {
              // For arrays, build the tuple manually with raw __node
              // values (same pattern as fiber/par), so the AST
              // serializes with elements as plain AST nodes.
              const emailsNode = ctx.isExpr(emails)
                ? emails.__node
                : {
                    kind: "core/tuple" as const,
                    elements: (emails as CreateBatchOptions).map((e) => ctx.lift(e).__node),
                  };
              return ctx.expr({
                kind: "resend/send_batch",
                emails: emailsNode,
                config,
              });
            },
          },

          contacts: {
            create(params) {
              return ctx.expr({
                kind: "resend/create_contact",
                params: resolveParams(params),
                config,
              });
            },

            get(id) {
              return ctx.expr({
                kind: "resend/get_contact",
                id: resolveId(id),
                config,
              });
            },

            list() {
              return ctx.expr({
                kind: "resend/list_contacts",
                config,
              });
            },

            remove(id) {
              return ctx.expr({
                kind: "resend/remove_contact",
                id: resolveId(id),
                config,
              });
            },
          },
        },
      };
    },
  });
}

// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Email sending:
//    Real:  const { data } = await resend.emails.send({ from: '...', to: '...', subject: '...', html: '...' })
//    Mvfm:   const email = $.resend.emails.send({ from: '...', to: '...', subject: '...', html: '...' })
//    Nearly identical. Only difference is $ prefix and no await/destructuring.
//
// 2. Batch sending:
//    Real:  const { data } = await resend.batch.send([{ from: '...', to: '...' }, ...])
//    Mvfm:   const batch = $.resend.batch.send([{ from: '...', to: '...' }, ...])
//    Array of email objects maps 1:1. Proxy chains capture dependencies.
//
// 3. Contact management:
//    Real:  const { data } = await resend.contacts.create({ audienceId: '...', email: '...' })
//    Mvfm:   const contact = $.resend.contacts.create({ audienceId: '...', email: '...' })
//    CRUD operations on contacts map directly.
//
// 4. Parameterized operations with proxy values:
//    const email = $.resend.emails.send({ to: $.input.recipient, subject: $.input.subject, ... })
//    Proxy chains capture the dependency graph perfectly.
//
// WORKS BUT DIFFERENT:
//
// 5. React email templates:
//    Real:  await resend.emails.send({ from: '...', to: '...', react: <EmailTemplate /> })
//    Mvfm:   $.resend.emails.send({ from: '...', to: '...', html: '<p>...</p>' })
//    React rendering is a build-time side effect — JSX must be
//    rendered to HTML before the AST is built. Use `html` instead.
//
// 6. Return types:
//    Return types use concrete resend-node response types
//    (CreateEmailResponseSuccess, GetEmailResponseSuccess, etc.).
//    Property access works via proxy (email.id, contact.email)
//    with IDE autocomplete for Resend-specific fields.
//
// DOESN'T WORK / NOT MODELED:
//
// 7. Webhooks:
//    Real:  Resend sends webhook events (email.sent, email.delivered, etc.)
//    Mvfm:   Not modeled. Webhooks are server-initiated push events,
//           not request/response operations. They belong in the
//           interpreter/runtime layer, not in the AST.
//
// 8. Buffer attachments:
//    Real:  await resend.emails.send({ ..., attachments: [{ content: Buffer.from('...') }] })
//    Mvfm:   Buffer is a runtime construct. Attachments with string
//           content or paths work; binary Buffer content does not.
//
// 9. Idempotency keys:
//    Real:  Resend supports Idempotency-Key header on email send.
//    Mvfm:   Not modeled yet. Could be added as an optional parameter
//           that becomes an AST field.
//
// ============================================================
// SUMMARY:
// Based on source-level analysis of resend-node
// (github.com/resend/resend-node, SDK version 6.9.2).
//
// For the core 80% use case of "send emails, manage contacts,
// batch send" — this is nearly identical to real resend-node.
// Resource nesting (emails, batch, contacts) maps 1:1.
// Proxy chains capture cross-operation dependencies perfectly.
//
// The main gaps are: React email templates (use html instead)
// and webhooks (push-based, not AST-modelable).
// ============================================================
