/**
 * Test helpers for the ported zod plugin.
 *
 * Provides a unified setup for the new createApp/fold/defaults API
 * and convenience functions for common test patterns.
 */

import type { CExpr } from "@mvfm/core";
import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { zod } from "../src/index";

const zodPlugin = zod();
const plugins = [numPluginU, strPluginU, boolPluginU, zodPlugin] as const;

/** The composed constructor bag with $.zod namespace. */
export const $ = mvfmU(...plugins);

/** Normalize a CExpr into an NExpr. */
export const app = createApp(...plugins);

/** The merged interpreter for fold(). */
export const interp = defaults(plugins);

/** Run a CExpr through the full pipeline (normalize + fold). */
export async function run<T>(expr: CExpr<T>): Promise<T> {
  const nexpr = app(expr);
  return (await fold(nexpr, interp)) as T;
}

/** Get the schema node from a builder (for AST structure tests). */
export function schemaOf(builder: { __schemaNode: unknown }): any {
  return builder.__schemaNode;
}
