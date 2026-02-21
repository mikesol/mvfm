/**
 * 04-normalize shared utility type.
 */

/**
 * Replace `never` with a fallback to keep diagnostic output readable.
 */
export type NeverGuard<T, Fallback = never> = [T] extends [never] ? Fallback : T;
