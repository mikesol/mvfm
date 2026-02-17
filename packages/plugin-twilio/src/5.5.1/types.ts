/**
 * Re-exports of twilio-node SDK types used by the twilio plugin.
 *
 * Centralizes deep import paths so the rest of the plugin imports from `./types`.
 * All imports are type-only — zero runtime cost.
 */

export type {
  CallInstance,
  CallListInstanceCreateOptions,
  CallListInstanceOptions,
} from "twilio/lib/rest/api/v2010/account/call";
export type {
  MessageInstance,
  MessageListInstanceCreateOptions,
  MessageListInstanceOptions,
} from "twilio/lib/rest/api/v2010/account/message";
