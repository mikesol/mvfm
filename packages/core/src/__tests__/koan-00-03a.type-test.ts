/**
 * Compile-time koan 00-03a gate checks against @mvfm/core koan namespace.
 */

import { koan } from "../koan";
import type { CKindOf, COutOf } from "../koan/expr";

const e = koan.add(1, 2);

const _out: COutOf<typeof e> = 3;
// @ts-expect-error add returns number output, not string
const _outBad: COutOf<typeof e> = "x";

const _kind: CKindOf<typeof e> = "num/add";
// @ts-expect-error add kind is num/add
const _kindBad: CKindOf<typeof e> = "num/mul";

const $ = koan.mvfmU(...koan.stdPlugins, koan.ordPlugin);

const kEq = $.eq(1, 2);
const kLt = $.lt(1, 2);

const _eqKind: CKindOf<typeof kEq> = "eq";
const _ltKind: CKindOf<typeof kLt> = "lt";
