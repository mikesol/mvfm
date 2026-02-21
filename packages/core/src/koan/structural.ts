import { type Plugin, stdPlugins } from "./composition";
import { add, type CExpr, type KindSpec, makeCExpr } from "./expr";
import { createApp } from "./normalize";

/** Point constructor for koan 04a structural elaboration. */
export function point<A extends { x: unknown; y: unknown }>(
  a: A,
): CExpr<{ x: number; y: number }, "geom/point", [A]> {
  return makeCExpr("geom/point", [a]);
}

/** Line constructor (structural nested records). */
export function line<
  A extends { start: { x: unknown; y: unknown }; end: { x: unknown; y: unknown } },
>(
  a: A,
): CExpr<{ start: { x: number; y: number }; end: { x: number; y: number } }, "geom/line", [A]> {
  return makeCExpr("geom/line", [a]);
}

/** Pair constructor (structural tuple). */
export function pair<A extends [unknown, unknown]>(
  a: A,
): CExpr<[number, number], "data/pair", [A]> {
  return makeCExpr("data/pair", [a]);
}

const structuralPlugin = {
  name: "structural",
  ctors: { point, line, pair, add },
  kinds: {
    "geom/point": { inputs: [{ x: 0, y: 0 }], output: { x: 0, y: 0 } } as KindSpec<
      [{ x: number; y: number }],
      { x: number; y: number }
    >,
    "geom/line": {
      inputs: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
      output: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
    } as KindSpec<
      [{ start: { x: number; y: number }; end: { x: number; y: number } }],
      { start: { x: number; y: number }; end: { x: number; y: number } }
    >,
    "data/pair": { inputs: [[0, 0]], output: [0, 0] } as KindSpec<
      [[number, number]],
      [number, number]
    >,
  },
  traits: {},
  lifts: {},
  nodeKinds: ["geom/point", "geom/line", "data/pair"],
} as const satisfies Plugin;

/** Structural normalize app (04a). */
export const appS = createApp(...stdPlugins, structuralPlugin);
