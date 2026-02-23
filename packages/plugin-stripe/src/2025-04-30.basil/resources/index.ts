import type { ResourceDef } from "../registry";
import { billingResourcesA } from "./billing";
import { billingInvoiceResources } from "./billing-invoices";
import { billingResourcesB } from "./billing-more";
import { billingResourcesC } from "./billing-tax";
import { connectResourcesA } from "./connect";
import { connectResourcesB } from "./connect-more";
import { customerResources } from "./customers";
import { financeIssuingResources } from "./finance";
import { financeTreasuryResources } from "./finance-treasury";
import { miscResourcesA } from "./misc";
import { miscResourcesE } from "./misc-apps";
import { miscResourcesB } from "./misc-more";
import { miscResourcesD } from "./misc-reporting";
import { miscResourcesC } from "./misc-terminal";
import { paymentResourcesA } from "./payments";
import { paymentResourcesB } from "./payments-more";
import { serviceResourcesA } from "./services";
import { serviceResourcesB } from "./services-billing";

/** All resource definitions, organized to mirror Stripe SDK structure. */
export const allResources = {
  ...paymentResourcesA,
  ...paymentResourcesB,
  ...customerResources,
  ...billingResourcesA,
  ...billingInvoiceResources,
  ...billingResourcesB,
  ...billingResourcesC,
  ...connectResourcesA,
  ...connectResourcesB,
  ...serviceResourcesA,
  ...serviceResourcesB,
  ...financeIssuingResources,
  ...financeTreasuryResources,
  ...miscResourcesA,
  ...miscResourcesD,
  ...miscResourcesB,
  ...miscResourcesE,
  ...miscResourcesC,
};

/** Flat list of all ResourceDefs for generating kinds and handlers. */
export function flatResourceDefs(): ResourceDef[] {
  const result: ResourceDef[] = [];
  function collect(obj: unknown) {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const values = Object.values(obj);
      if (
        values.length > 0 &&
        values[0] &&
        typeof values[0] === "object" &&
        "kind" in (values[0] as object)
      ) {
        result.push(obj as ResourceDef);
      } else {
        for (const v of values) collect(v);
      }
    }
  }
  collect(allResources);
  return result;
}

export { billingResourcesA } from "./billing";
export { billingInvoiceResources } from "./billing-invoices";
export { billingResourcesB } from "./billing-more";
export { billingResourcesC } from "./billing-tax";
export { connectResourcesA } from "./connect";
export { connectResourcesB } from "./connect-more";
export { customerResources } from "./customers";
export { financeIssuingResources } from "./finance";
export { financeTreasuryResources } from "./finance-treasury";
export { miscResourcesA } from "./misc";
export { miscResourcesE } from "./misc-apps";
export { miscResourcesB } from "./misc-more";
export { miscResourcesD } from "./misc-reporting";
export { miscResourcesC } from "./misc-terminal";
export { paymentResourcesA } from "./payments";
export { paymentResourcesB } from "./payments-more";
export { serviceResourcesA } from "./services";
export { serviceResourcesB } from "./services-billing";
