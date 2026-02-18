import type { CheckDescriptor } from "./types";

function readCheckDef(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as { _zod?: { def?: Record<string, unknown> }; def?: Record<string, unknown> };
  return value._zod?.def ?? value.def;
}

type Unsupported = (message: string) => void;

function extractNormalizeForm(tx: string): "NFC" | "NFD" | "NFKC" | "NFKD" {
  const match = tx.match(/\.normalize\(\s*(['"]?)(NFC|NFD|NFKC|NFKD)\1\s*\)/);
  return (match?.[2] as "NFC" | "NFD" | "NFKC" | "NFKD" | undefined) ?? "NFC";
}

export function mapStringChecks(
  checks: unknown[],
  onUnsupported: Unsupported,
): { checks: CheckDescriptor[]; format?: Record<string, unknown> } {
  const out: CheckDescriptor[] = [];
  let format: Record<string, unknown> | undefined;
  for (const raw of checks) {
    const def = readCheckDef(raw);
    const kind = def?.check;
    if (!kind) continue;
    if (kind === "min_length") out.push({ kind: "min_length", value: def.minimum });
    else if (kind === "max_length") out.push({ kind: "max_length", value: def.maximum });
    else if (kind === "length_equals") out.push({ kind: "length", value: def.length });
    else if (kind === "string_format") {
      const f = String(def.format);
      if (f === "starts_with") out.push({ kind: "starts_with", value: def.prefix });
      else if (f === "ends_with") out.push({ kind: "ends_with", value: def.suffix });
      else if (f === "includes") out.push({ kind: "includes", value: def.includes });
      else if (f === "regex") {
        const pattern = def.pattern as RegExp;
        out.push({ kind: "regex", pattern: pattern.source, flags: pattern.flags });
      } else if (f === "lowercase" || f === "uppercase") out.push({ kind: f });
      else if (f === "date" || f === "time" || f === "datetime" || f === "duration")
        format = { type: `iso.${f}` };
      else if (
        [
          "email",
          "url",
          "uuid",
          "uuidv4",
          "uuidv7",
          "guid",
          "hostname",
          "emoji",
          "base64",
          "base64url",
          "hex",
          "jwt",
          "nanoid",
          "cuid",
          "cuid2",
          "ulid",
          "ipv4",
          "ipv6",
          "cidrv4",
          "cidrv6",
          "e164",
        ].includes(f)
      )
        format = { type: f };
      else onUnsupported(`unsupported string format "${f}"`);
    } else if (kind === "overwrite") {
      const tx = String(def.tx);
      if (tx.includes(".trim()")) out.push({ kind: "trim" });
      else if (tx.includes(".toLowerCase()")) out.push({ kind: "to_lower_case" });
      else if (tx.includes(".toUpperCase()")) out.push({ kind: "to_upper_case" });
      else if (tx.includes(".normalize("))
        out.push({ kind: "normalize", form: extractNormalizeForm(tx) });
      else onUnsupported("unsupported overwrite transform closure");
    } else if (kind === "custom") onUnsupported("cannot convert custom/refinement closure");
    else onUnsupported(`unsupported string check "${String(kind)}"`);
  }
  return { checks: out, format };
}

export function mapLengthChecks(checks: unknown[], onUnsupported: Unsupported): CheckDescriptor[] {
  const out: CheckDescriptor[] = [];
  for (const raw of checks) {
    const def = readCheckDef(raw);
    const kind = def?.check;
    if (!kind) continue;
    if (kind === "min_length") out.push({ kind: "min_length", value: def.minimum });
    else if (kind === "max_length") out.push({ kind: "max_length", value: def.maximum });
    else if (kind === "length_equals") out.push({ kind: "length", value: def.length });
    else onUnsupported(`unsupported length check "${String(kind)}"`);
  }
  return out;
}

export function mapSizeChecks(checks: unknown[], onUnsupported: Unsupported): CheckDescriptor[] {
  const out: CheckDescriptor[] = [];
  for (const raw of checks) {
    const def = readCheckDef(raw);
    const kind = def?.check;
    if (!kind) continue;
    if (kind === "min_size") out.push({ kind: "min_size", value: def.minimum });
    else if (kind === "max_size") out.push({ kind: "max_size", value: def.maximum });
    else if (kind === "size_equals") out.push({ kind: "size", value: def.size });
    else onUnsupported(`unsupported size check "${String(kind)}"`);
  }
  return out;
}

export function mapComparableChecks(
  checks: unknown[],
  bigintMode: boolean,
  onUnsupported: Unsupported,
): CheckDescriptor[] {
  const out: CheckDescriptor[] = [];
  for (const raw of checks) {
    const def = readCheckDef(raw);
    const kind = def?.check;
    if (!kind) continue;
    const value = bigintMode ? String(def?.value) : def?.value;
    if (kind === "greater_than") out.push({ kind: def?.inclusive ? "gte" : "gt", value });
    else if (kind === "less_than") out.push({ kind: def?.inclusive ? "lte" : "lt", value });
    else if (kind === "multiple_of") out.push({ kind: "multiple_of", value });
    else if (kind === "number_format" && def?.format === "safeint") out.push({ kind: "int" });
    else if (kind === "custom") onUnsupported("cannot convert custom/refinement closure");
    else onUnsupported(`unsupported numeric check "${String(kind)}"`);
  }
  return out;
}
