import { describe, test } from "vitest";

describe("koan gates", () => {
  test("00-expr", async () => { await import("../src/__koans__/00-expr"); });
  test("01-increment", async () => { await import("../src/__koans__/01-increment"); });
  test("02-build", async () => { await import("../src/__koans__/02-build"); });
  test("03-traits", async () => { await import("../src/__koans__/03-traits"); });
  test("03a-composition", async () => { await import("../src/__koans__/03a-composition"); });
  test("04-normalize", async () => { await import("../src/__koans__/04-normalize"); });
  test("04a-structural", async () => { await import("../src/__koans__/04a-structural"); });
  test("04b-accessor", async () => { await import("../src/__koans__/04b-accessor"); });
  test("05-predicates", async () => { await import("../src/__koans__/05-predicates"); });
  test("06-select", async () => { await import("../src/__koans__/06-select"); });
  test("07-map", async () => { await import("../src/__koans__/07-map"); });
  test("08-replace", async () => { await import("../src/__koans__/08-replace"); });
  test("09-gc", async () => { await import("../src/__koans__/09-gc"); });
  test("10-dirty", async () => { await import("../src/__koans__/10-dirty"); });
  test("11-commit", async () => { await import("../src/__koans__/11-commit"); });
  test("12-wrap", async () => { await import("../src/__koans__/12-wrap"); });
  test("13-splice", async () => { await import("../src/__koans__/13-splice"); });
  test("14-named", async () => { await import("../src/__koans__/14-named"); });
  test("15-dagql", async () => { await import("../src/__koans__/15-dagql"); });
  test("16-bridge", async () => { await import("../src/__koans__/16-bridge"); });
});
