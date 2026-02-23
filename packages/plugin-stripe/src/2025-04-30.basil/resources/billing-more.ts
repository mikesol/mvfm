import type { ResourceDef } from "../registry";

/** Products: create, retrieve, update, del, list, search, createFeature, retrieveFeature, deleteFeature, listFeatures */
export const products: ResourceDef = {
  create: { kind: "stripe/create_product", httpMethod: "POST", path: "/v1/products", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_product", httpMethod: "GET", path: "/v1/products/{0}", argPattern: "id" },
  update: { kind: "stripe/update_product", httpMethod: "POST", path: "/v1/products/{0}", argPattern: "id,params" },
  del: { kind: "stripe/del_product", httpMethod: "DELETE", path: "/v1/products/{0}", argPattern: "del" },
  list: { kind: "stripe/list_products", httpMethod: "GET", path: "/v1/products", argPattern: "params?" },
  search: { kind: "stripe/search_products", httpMethod: "GET", path: "/v1/products/search", argPattern: "params" },
  createFeature: { kind: "stripe/create_product_feature", httpMethod: "POST", path: "/v1/products/{0}/features", argPattern: "id,nestedParams" },
  retrieveFeature: { kind: "stripe/retrieve_product_feature", httpMethod: "GET", path: "/v1/products/{0}/features/{1}", argPattern: "id,childId" },
  deleteFeature: { kind: "stripe/delete_product_feature", httpMethod: "DELETE", path: "/v1/products/{0}/features/{1}", argPattern: "id,childId,del" },
  listFeatures: { kind: "stripe/list_product_features", httpMethod: "GET", path: "/v1/products/{0}/features", argPattern: "id,nestedParams?" },
};

/** Coupons: create, retrieve, update, del, list */
export const coupons: ResourceDef = {
  create: { kind: "stripe/create_coupon", httpMethod: "POST", path: "/v1/coupons", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_coupon", httpMethod: "GET", path: "/v1/coupons/{0}", argPattern: "id" },
  update: { kind: "stripe/update_coupon", httpMethod: "POST", path: "/v1/coupons/{0}", argPattern: "id,params" },
  del: { kind: "stripe/del_coupon", httpMethod: "DELETE", path: "/v1/coupons/{0}", argPattern: "del" },
  list: { kind: "stripe/list_coupons", httpMethod: "GET", path: "/v1/coupons", argPattern: "params?" },
};

/** PromotionCodes: create, retrieve, update, list */
export const promotionCodes: ResourceDef = {
  create: { kind: "stripe/create_promotion_code", httpMethod: "POST", path: "/v1/promotion_codes", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_promotion_code", httpMethod: "GET", path: "/v1/promotion_codes/{0}", argPattern: "id" },
  update: { kind: "stripe/update_promotion_code", httpMethod: "POST", path: "/v1/promotion_codes/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_promotion_codes", httpMethod: "GET", path: "/v1/promotion_codes", argPattern: "params?" },
};

/** CreditNotes: create, retrieve, update, list, voidCreditNote, preview, listLineItems, listPreviewLineItems */
export const creditNotes: ResourceDef = {
  create: { kind: "stripe/create_credit_note", httpMethod: "POST", path: "/v1/credit_notes", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_credit_note", httpMethod: "GET", path: "/v1/credit_notes/{0}", argPattern: "id" },
  update: { kind: "stripe/update_credit_note", httpMethod: "POST", path: "/v1/credit_notes/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_credit_notes", httpMethod: "GET", path: "/v1/credit_notes", argPattern: "params?" },
  voidCreditNote: { kind: "stripe/void_credit_note", httpMethod: "POST", path: "/v1/credit_notes/{0}/void", argPattern: "id,params?" },
  preview: { kind: "stripe/preview_credit_note", httpMethod: "GET", path: "/v1/credit_notes/preview", argPattern: "params" },
  listLineItems: { kind: "stripe/list_credit_note_line_items", httpMethod: "GET", path: "/v1/credit_notes/{0}/lines", argPattern: "id,nestedParams?" },
  listPreviewLineItems: { kind: "stripe/list_credit_note_preview_line_items", httpMethod: "GET", path: "/v1/credit_notes/preview/lines", argPattern: "params" },
};

/** TaxRates: create, retrieve, update, list */
export const taxRates: ResourceDef = {
  create: { kind: "stripe/create_tax_rate", httpMethod: "POST", path: "/v1/tax_rates", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_tax_rate", httpMethod: "GET", path: "/v1/tax_rates/{0}", argPattern: "id" },
  update: { kind: "stripe/update_tax_rate", httpMethod: "POST", path: "/v1/tax_rates/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_tax_rates", httpMethod: "GET", path: "/v1/tax_rates", argPattern: "params?" },
};

/** TaxCodes: retrieve, list */
export const taxCodes: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_tax_code", httpMethod: "GET", path: "/v1/tax_codes/{0}", argPattern: "id" },
  list: { kind: "stripe/list_tax_codes", httpMethod: "GET", path: "/v1/tax_codes", argPattern: "params?" },
};

/** TaxIds: create, retrieve, del, list */
export const taxIds: ResourceDef = {
  create: { kind: "stripe/create_tax_id", httpMethod: "POST", path: "/v1/tax_ids", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_tax_id", httpMethod: "GET", path: "/v1/tax_ids/{0}", argPattern: "id" },
  del: { kind: "stripe/del_tax_id", httpMethod: "DELETE", path: "/v1/tax_ids/{0}", argPattern: "del" },
  list: { kind: "stripe/list_tax_ids", httpMethod: "GET", path: "/v1/tax_ids", argPattern: "params?" },
};

/** Quotes: create, retrieve, update, list, accept, cancel, finalizeQuote, listLineItems, listComputedUpfrontLineItems */
export const quotes: ResourceDef = {
  create: { kind: "stripe/create_quote", httpMethod: "POST", path: "/v1/quotes", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_quote", httpMethod: "GET", path: "/v1/quotes/{0}", argPattern: "id" },
  update: { kind: "stripe/update_quote", httpMethod: "POST", path: "/v1/quotes/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_quotes", httpMethod: "GET", path: "/v1/quotes", argPattern: "params?" },
  accept: { kind: "stripe/accept_quote", httpMethod: "POST", path: "/v1/quotes/{0}/accept", argPattern: "id,params?" },
  cancel: { kind: "stripe/cancel_quote", httpMethod: "POST", path: "/v1/quotes/{0}/cancel", argPattern: "id,params?" },
  finalizeQuote: { kind: "stripe/finalize_quote", httpMethod: "POST", path: "/v1/quotes/{0}/finalize", argPattern: "id,params?" },
  listLineItems: { kind: "stripe/list_quote_line_items", httpMethod: "GET", path: "/v1/quotes/{0}/line_items", argPattern: "id,nestedParams?" },
  listComputedUpfrontLineItems: { kind: "stripe/list_quote_computed_upfront_line_items", httpMethod: "GET", path: "/v1/quotes/{0}/computed_upfront_line_items", argPattern: "id,nestedParams?" },
};

export const billingResourcesB = {
  products, coupons, promotionCodes, creditNotes,
  taxRates, taxCodes, taxIds, quotes,
};
