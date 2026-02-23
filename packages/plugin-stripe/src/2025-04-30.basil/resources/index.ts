import type { ResourceDef } from "../registry";
import { paymentResources } from "./payments";
import { customerResources } from "./customers";
import { billingResourcesA } from "./billing";
import { billingResourcesB } from "./billing-more";
import { connectResources } from "./connect";
import { serviceResources } from "./services";
import { financeResources } from "./finance";
import { miscResourcesA } from "./misc";
import { miscResourcesB } from "./misc-more";
import { miscResourcesC } from "./misc-terminal";

/** All resource definitions, organized to mirror Stripe SDK structure. */
export const allResources = {
  ...paymentResources,
  ...customerResources,
  ...billingResourcesA,
  ...billingResourcesB,
  ...connectResources,
  ...serviceResources,
  ...financeResources,
  ...miscResourcesA,
  ...miscResourcesB,
  ...miscResourcesC,
};

/** Flat list of all ResourceDefs for generating kinds and handlers. */
export function flatResourceDefs(): ResourceDef[] {
  const result: ResourceDef[] = [];
  function collect(obj: unknown) {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const values = Object.values(obj);
      if (values.length > 0 && values[0] && typeof values[0] === "object" && "kind" in (values[0] as object)) {
        result.push(obj as ResourceDef);
      } else {
        for (const v of values) collect(v);
      }
    }
  }
  collect(allResources);
  return result;
}

export { paymentResources } from "./payments";
export { customerResources } from "./customers";
export { billingResourcesA } from "./billing";
export { billingResourcesB } from "./billing-more";
export { connectResources } from "./connect";
export { serviceResources } from "./services";
export { financeResources } from "./finance";
export { miscResourcesA } from "./misc";
export { miscResourcesB } from "./misc-more";
export { miscResourcesC } from "./misc-terminal";
