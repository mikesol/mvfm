import { type AccessorOverlay, type CExpr, makeCExpr } from "./expr";

type AccessExpr<O, Kind extends string, Args extends readonly unknown[]> = CExpr<O, Kind, Args> &
  AccessorOverlay<O>;

type DeepRecord = {
  helloRecord: {
    boy: { am: { i: { mean: number }[] } }[];
  };
};

/** Deep structural value constructor used to verify accessor chains. */
export function deepThing(): AccessExpr<DeepRecord, "test/deep", []> {
  return makeCExpr("test/deep", [] as const) as AccessExpr<DeepRecord, "test/deep", []>;
}
