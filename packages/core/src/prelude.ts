import { boolean } from "./plugins/boolean";
import { bounded } from "./plugins/bounded";
import { eq } from "./plugins/eq";
import { heytingAlgebra } from "./plugins/heyting-algebra";
import { monoid } from "./plugins/monoid";
import { num } from "./plugins/num";
import { ord } from "./plugins/ord";
import { semigroup } from "./plugins/semigroup";
import { semiring } from "./plugins/semiring";
import { show } from "./plugins/show";
import { str } from "./plugins/str";

/**
 * Default core plugin group for common pure operations.
 *
 * Includes numeric/string primitives, standard typeclass dispatch,
 * and boolean algebra plugins, while excluding effect/control plugins.
 *
 * @example
 * ```ts
 * const app = mvfm(prelude)
 * ```
 *
 * @example
 * ```ts
 * const app = mvfm(...prelude)
 * ```
 */
export const prelude = [
  num,
  str,
  semiring,
  eq,
  ord,
  show,
  boolean,
  bounded,
  heytingAlgebra,
  semigroup,
  monoid,
] as const;
