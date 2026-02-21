/**
 * Compile-time koan 04 normalize checks.
 */

import type { IdOf, OutOf, StdRegistry } from "../koan";
import { koan } from "../koan";
import type { AppResult } from "../koan/normalize";

const p1 = koan.app(koan.add(3, 4));

type P1Out = OutOf<typeof p1>;
type P1Id = IdOf<typeof p1>;
const _p1Out: P1Out = 7;
const _p1Id: P1Id = "c";
// @ts-expect-error p1 root id is "c"
const _p1IdBad: P1Id = "b";

const pEq = koan.app(koan.eq("a", "b"));
const _pEqOut: OutOf<typeof pEq> = false;

const extApp = koan.createApp(...koan.stdPlugins, koan.ordPlugin);
const pLt = extApp(koan.lt(1, 2));
const _pLtOut: OutOf<typeof pLt> = true;

const badExpr = koan.eq(1, "x");
type Bad = AppResult<StdRegistry, typeof badExpr>;
// @ts-expect-error mismatched eq arguments should normalize to never
const _bad: Bad = 1;

// @ts-expect-error appS point input must include both x and y
koan.appS(koan.point({ x: 3 }));

const deep = koan.deepThing();
// @ts-expect-error accessor path mean is number, not string
const _wrongAccessorType: string = deep.helloRecord.boy[3].am.i[0].mean;
