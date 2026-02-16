import type { PluginContext } from "@mvfm/core";
import { z } from "zod";
import { ZodStringBuilder } from "./string";

/**
 * ISO date/time format namespace within the Zod plugin.
 */
export interface ZodIsoNamespace {
  /** ISO date format (YYYY-MM-DD). */
  date(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** ISO time format. */
  time(
    errorOrOpts?:
      | string
      | { error?: string; precision?: number; offset?: boolean; local?: boolean },
  ): ZodStringBuilder;
  /** ISO datetime format. */
  datetime(
    errorOrOpts?:
      | string
      | { error?: string; precision?: number; offset?: boolean; local?: boolean },
  ): ZodStringBuilder;
  /** ISO duration format. */
  duration(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
}

/**
 * Namespace fragment for string format constructors (#101).
 *
 * Format constructors produce `ZodStringBuilder` instances with a `format`
 * descriptor in the extra field. The interpreter uses this to pick the
 * correct Zod format method (e.g. `z.email()`, `z.uuid()`).
 */
export interface ZodStringFormatsNamespace {
  /** Email format. */
  email(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** UUID format. */
  uuid(errorOrOpts?: string | { error?: string; version?: number }): ZodStringBuilder;
  /** UUID v4 shortcut. */
  uuidv4(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** UUID v7 shortcut. */
  uuidv7(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** GUID (loose UUID). */
  guid(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** URL format. */
  url(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** HTTP URL (http/https only). */
  httpUrl(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Hostname format. */
  hostname(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Emoji format. */
  emoji(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Base64 format. */
  base64(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Base64 URL-safe format. */
  base64url(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Hexadecimal format. */
  hex(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** JWT format. */
  jwt(errorOrOpts?: string | { error?: string; alg?: string }): ZodStringBuilder;
  /** Nano ID format. */
  nanoid(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** CUID format. */
  cuid(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** CUID2 format. */
  cuid2(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** ULID format. */
  ulid(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** IPv4 format. */
  ipv4(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** IPv6 format. */
  ipv6(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** MAC address format. */
  mac(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** CIDR v4 format. */
  cidrv4(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** CIDR v6 format. */
  cidrv6(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Hash format (sha256, md5, etc). */
  hash(algorithm: string, errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** E.164 phone number format. */
  e164(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** ISO date/time formats. */
  iso: ZodIsoNamespace;
}

/** Node kinds contributed by string formats -- none; they reuse zod/string. */
export const stringFormatsNodeKinds: string[] = [];

/** Create a string builder with a format descriptor in extra. */
function formatBuilder(
  ctx: PluginContext,
  format: Record<string, unknown>,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
  errorOrOpts?: string | { error?: string },
): ZodStringBuilder {
  return new ZodStringBuilder(ctx, [], [], parseError(errorOrOpts), { format });
}

/** Build the string formats namespace factory methods. */
export function stringFormatsNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodStringFormatsNamespace {
  const fmt = (format: Record<string, unknown>, errorOrOpts?: string | { error?: string }) =>
    formatBuilder(ctx, format, parseError, errorOrOpts);

  return {
    email: (e) => fmt({ type: "email" }, e),
    uuid(errorOrOpts) {
      const opts = typeof errorOrOpts === "object" ? errorOrOpts : undefined;
      const version = (opts as any)?.version;
      return fmt({ type: "uuid", ...(version != null ? { version } : {}) }, errorOrOpts);
    },
    uuidv4: (e) => fmt({ type: "uuidv4" }, e),
    uuidv7: (e) => fmt({ type: "uuidv7" }, e),
    guid: (e) => fmt({ type: "guid" }, e),
    url: (e) => fmt({ type: "url" }, e),
    httpUrl: (e) => fmt({ type: "httpUrl" }, e),
    hostname: (e) => fmt({ type: "hostname" }, e),
    emoji: (e) => fmt({ type: "emoji" }, e),
    base64: (e) => fmt({ type: "base64" }, e),
    base64url: (e) => fmt({ type: "base64url" }, e),
    hex: (e) => fmt({ type: "hex" }, e),
    jwt(errorOrOpts) {
      const opts = typeof errorOrOpts === "object" ? errorOrOpts : undefined;
      const alg = (opts as any)?.alg;
      return fmt({ type: "jwt", ...(alg != null ? { alg } : {}) }, errorOrOpts);
    },
    nanoid: (e) => fmt({ type: "nanoid" }, e),
    cuid: (e) => fmt({ type: "cuid" }, e),
    cuid2: (e) => fmt({ type: "cuid2" }, e),
    ulid: (e) => fmt({ type: "ulid" }, e),
    ipv4: (e) => fmt({ type: "ipv4" }, e),
    ipv6: (e) => fmt({ type: "ipv6" }, e),
    mac: (e) => fmt({ type: "mac" }, e),
    cidrv4: (e) => fmt({ type: "cidrv4" }, e),
    cidrv6: (e) => fmt({ type: "cidrv6" }, e),
    hash: (algorithm, e) => fmt({ type: "hash", algorithm }, e),
    e164: (e) => fmt({ type: "e164" }, e),
    iso: {
      date: (e) => fmt({ type: "iso.date" }, e),
      time(errorOrOpts) {
        const opts = typeof errorOrOpts === "object" ? errorOrOpts : undefined;
        const f: Record<string, unknown> = { type: "iso.time" };
        if ((opts as any)?.precision != null) f.precision = (opts as any).precision;
        if ((opts as any)?.offset != null) f.offset = (opts as any).offset;
        if ((opts as any)?.local != null) f.local = (opts as any).local;
        return fmt(f, errorOrOpts);
      },
      datetime(errorOrOpts) {
        const opts = typeof errorOrOpts === "object" ? errorOrOpts : undefined;
        const f: Record<string, unknown> = { type: "iso.datetime" };
        if ((opts as any)?.precision != null) f.precision = (opts as any).precision;
        if ((opts as any)?.offset != null) f.offset = (opts as any).offset;
        if ((opts as any)?.local != null) f.local = (opts as any).local;
        return fmt(f, errorOrOpts);
      },
      duration: (e) => fmt({ type: "iso.duration" }, e),
    },
  };
}

/**
 * Build a Zod string-format schema from a format descriptor.
 * Maps format type strings to the corresponding Zod format constructors.
 */
export function buildStringFormat(
  format: Record<string, unknown>,
  errorFn?: (iss: unknown) => string,
): z.ZodString {
  const errOpt = errorFn ? { error: errorFn } : {};
  switch (format.type) {
    case "email":
      return z.email(errOpt) as unknown as z.ZodString;
    case "uuid":
      return z.uuid(
        format.version != null ? { ...errOpt, version: format.version as "v4" | "v7" } : errOpt,
      ) as unknown as z.ZodString;
    case "uuidv4":
      return z.uuidv4(errOpt) as unknown as z.ZodString;
    case "uuidv7":
      return z.uuidv7(errOpt) as unknown as z.ZodString;
    case "guid":
      return z.guid(errOpt) as unknown as z.ZodString;
    case "url":
      return z.url(errOpt) as unknown as z.ZodString;
    case "httpUrl":
      return z.httpUrl(errOpt) as unknown as z.ZodString;
    case "hostname":
      return z.hostname(errOpt) as unknown as z.ZodString;
    case "emoji":
      return z.emoji(errOpt) as unknown as z.ZodString;
    case "base64":
      return z.base64(errOpt) as unknown as z.ZodString;
    case "base64url":
      return z.base64url(errOpt) as unknown as z.ZodString;
    case "hex":
      return z.hex(errOpt) as unknown as z.ZodString;
    case "jwt":
      return z.jwt(
        format.alg != null ? { ...errOpt, alg: format.alg as string } : errOpt,
      ) as unknown as z.ZodString;
    case "nanoid":
      return z.nanoid(errOpt) as unknown as z.ZodString;
    case "cuid":
      return z.cuid(errOpt) as unknown as z.ZodString;
    case "cuid2":
      return z.cuid2(errOpt) as unknown as z.ZodString;
    case "ulid":
      return z.ulid(errOpt) as unknown as z.ZodString;
    case "ipv4":
      return z.ipv4(errOpt) as unknown as z.ZodString;
    case "ipv6":
      return z.ipv6(errOpt) as unknown as z.ZodString;
    case "mac":
      return z.mac(errOpt) as unknown as z.ZodString;
    case "cidrv4":
      return z.cidrv4(errOpt) as unknown as z.ZodString;
    case "cidrv6":
      return z.cidrv6(errOpt) as unknown as z.ZodString;
    case "hash":
      return z.hash(
        format.algorithm as "md5" | "sha1" | "sha256" | "sha384" | "sha512",
        errOpt,
      ) as unknown as z.ZodString;
    case "e164":
      return z.e164(errOpt) as unknown as z.ZodString;
    case "iso.date":
      return z.iso.date(errOpt) as unknown as z.ZodString;
    case "iso.time": {
      const opts: Record<string, unknown> = { ...errOpt };
      if (format.precision != null) opts.precision = format.precision;
      if (format.offset != null) opts.offset = format.offset;
      if (format.local != null) opts.local = format.local;
      return z.iso.time(opts as any) as unknown as z.ZodString;
    }
    case "iso.datetime": {
      const opts: Record<string, unknown> = { ...errOpt };
      if (format.precision != null) opts.precision = format.precision;
      if (format.offset != null) opts.offset = format.offset;
      if (format.local != null) opts.local = format.local;
      return z.iso.datetime(opts as any) as unknown as z.ZodString;
    }
    case "iso.duration":
      return z.iso.duration(errOpt) as unknown as z.ZodString;
    default:
      throw new Error(`Zod interpreter: unknown string format "${format.type}"`);
  }
}
