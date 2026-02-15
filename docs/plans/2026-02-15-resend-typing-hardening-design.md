# Resend Typing Hardening Design

**Date:** 2026-02-15
**Issue:** #84
**Status:** Approved

## Scope
Harden typing only for currently implemented resend operations in `@mvfm/plugin-resend`:
- `emails.send`
- `emails.get`
- `batch.send`
- `contacts.create`
- `contacts.get`
- `contacts.list`
- `contacts.remove`

No new resend operations are added in this issue.

## Source of truth
Type surfaces are aligned to resend-node `v6.9.2`, validated by checking `/tmp/resend-node` at tag `v6.9.2`:
- `src/emails/interfaces/create-email-options.interface.ts`
- `src/emails/interfaces/get-email-options.interface.ts`
- `src/batch/interfaces/create-batch-options.interface.ts`
- `src/contacts/interfaces/create-contact-options.interface.ts`
- `src/contacts/interfaces/get-contact.interface.ts`
- `src/contacts/interfaces/list-contacts.interface.ts`
- `src/contacts/interfaces/remove-contact.interface.ts`

## Decision
Use official resend SDK types directly by adding `resend@6.9.2` as a plugin devDependency and importing concrete request/response types in `packages/plugin-resend/src/6.9.2/index.ts`.

## API surface changes
Replace generic `Record<string, unknown>` signatures with resend-node-aligned types:
- `emails.send`: `CreateEmailOptions` -> `CreateEmailResponseSuccess`
- `emails.get`: `string` -> `GetEmailResponseSuccess`
- `batch.send`: `CreateBatchOptions` -> `CreateBatchSuccessResponse`
- `contacts.create`: `CreateContactOptions | LegacyCreateContactOptions` -> `CreateContactResponseSuccess`
- `contacts.get`: `GetContactOptions` -> `GetContactResponseSuccess`
- `contacts.list`: no params -> `ListContactsResponseSuccess`
- `contacts.remove`: `RemoveContactOptions` -> `RemoveContactsResponseSuccess`

## Non-goals
- Adding support for deferred resend operations.
- Changing runtime interpreter/handler behavior.
- Modifying AST node shapes.

## Validation
Run:
- `pnpm --filter @mvfm/core run build`
- `pnpm --filter @mvfm/plugin-resend run build`
- `pnpm --filter @mvfm/plugin-resend run check`
- `pnpm --filter @mvfm/plugin-resend run test`

Note: integration tests that spin up localhost may fail in restricted sandboxes with `listen EPERM`; report that as environment constraint when present.
