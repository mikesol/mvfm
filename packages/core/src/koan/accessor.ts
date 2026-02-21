import { type CExpr, CREF } from "./expr";

/** Accessor overlay that projects deep property/tuple paths as CExpr values. */
export type AccessorOverlay<O> = O extends readonly (infer E)[]
  ? {
      readonly [k: number]: CExpr<E, "core/access", [CExpr<O, string, readonly unknown[]>, number]>;
    }
  : O extends object
    ? {
        readonly [K in keyof O]: CExpr<
          O[K],
          "core/access",
          [CExpr<O, string, readonly unknown[]>, K]
        >;
      }
    : {};

type AccessExpr<O, Kind extends string, Args extends readonly unknown[]> = CExpr<O, Kind, Args> &
  AccessorOverlay<O>;

const RESERVED = new Set<PropertyKey>([CREF, "__kind", "__args", "then"]);

function makeCExprProxy<O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: Args,
): AccessExpr<O, Kind, Args> {
  const raw = {
    [CREF]: true as const,
    __kind: kind,
    __args: args,
  } as unknown as CExpr<O, Kind, Args>;

  return new Proxy(raw as object, {
    get(target, prop, receiver) {
      if (RESERVED.has(prop) || typeof prop === "symbol") {
        return Reflect.get(target, prop, receiver);
      }
      const key = typeof prop === "string" && /^\d+$/.test(prop) ? Number(prop) : prop;
      return makeCExprProxy("core/access", [receiver as CExpr<unknown>, key] as const);
    },
  }) as AccessExpr<O, Kind, Args>;
}

type DeepRecord = {
  helloRecord: {
    boy: { am: { i: { mean: number }[] } }[];
  };
};

/** Deep structural value constructor used to verify accessor chains. */
export function deepThing(): AccessExpr<DeepRecord, "test/deep", []> {
  return makeCExprProxy("test/deep", [] as const);
}
