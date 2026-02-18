import { describe, expect, it, vi } from "vitest";
import { mapComparableChecks, mapStringChecks } from "../src/from-zod-checks";

describe("from-zod check mappers", () => {
  it("skips checks that do not expose a kind", () => {
    const onUnsupported = vi.fn();
    const checks = mapComparableChecks([undefined], false, onUnsupported);

    expect(checks).toEqual([]);
    expect(onUnsupported).not.toHaveBeenCalled();
  });

  it("extracts normalize form from overwrite transforms", () => {
    const onUnsupported = vi.fn();
    const checks = mapStringChecks(
      [{ def: { check: "overwrite", tx: () => "x".normalize("NFKD") } }],
      onUnsupported,
    );

    expect(checks.checks).toEqual([{ kind: "normalize", form: "NFKD" }]);
    expect(onUnsupported).not.toHaveBeenCalled();
  });
});
