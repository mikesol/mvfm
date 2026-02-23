import type { ResourceDef } from "../registry";

/** TaxRates: create, retrieve, update, list */
export const taxRates: ResourceDef = {
  create: {
    kind: "stripe/create_tax_rate",
    httpMethod: "POST",
    path: "/v1/tax_rates",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_tax_rate",
    httpMethod: "GET",
    path: "/v1/tax_rates/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_tax_rate",
    httpMethod: "POST",
    path: "/v1/tax_rates/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_tax_rates",
    httpMethod: "GET",
    path: "/v1/tax_rates",
    argPattern: "params?",
  },
};

/** TaxCodes: retrieve, list */
export const taxCodes: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_tax_code",
    httpMethod: "GET",
    path: "/v1/tax_codes/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_tax_codes",
    httpMethod: "GET",
    path: "/v1/tax_codes",
    argPattern: "params?",
  },
};

/** TaxIds: create, retrieve, del, list */
export const taxIds: ResourceDef = {
  create: {
    kind: "stripe/create_tax_id",
    httpMethod: "POST",
    path: "/v1/tax_ids",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_tax_id",
    httpMethod: "GET",
    path: "/v1/tax_ids/{0}",
    argPattern: "id",
  },
  del: {
    kind: "stripe/del_tax_id",
    httpMethod: "DELETE",
    path: "/v1/tax_ids/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_tax_ids",
    httpMethod: "GET",
    path: "/v1/tax_ids",
    argPattern: "params?",
  },
};

/** Quotes: create, retrieve, update, list, accept, cancel, finalizeQuote, listLineItems, listComputedUpfrontLineItems */
export const quotes: ResourceDef = {
  create: {
    kind: "stripe/create_quote",
    httpMethod: "POST",
    path: "/v1/quotes",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_quote",
    httpMethod: "GET",
    path: "/v1/quotes/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_quote",
    httpMethod: "POST",
    path: "/v1/quotes/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_quotes",
    httpMethod: "GET",
    path: "/v1/quotes",
    argPattern: "params?",
  },
  accept: {
    kind: "stripe/accept_quote",
    httpMethod: "POST",
    path: "/v1/quotes/{0}/accept",
    argPattern: "id,params?",
  },
  cancel: {
    kind: "stripe/cancel_quote",
    httpMethod: "POST",
    path: "/v1/quotes/{0}/cancel",
    argPattern: "id,params?",
  },
  finalizeQuote: {
    kind: "stripe/finalize_quote",
    httpMethod: "POST",
    path: "/v1/quotes/{0}/finalize",
    argPattern: "id,params?",
  },
  listLineItems: {
    kind: "stripe/list_quote_line_items",
    httpMethod: "GET",
    path: "/v1/quotes/{0}/line_items",
    argPattern: "id,nestedParams?",
  },
  listComputedUpfrontLineItems: {
    kind: "stripe/list_quote_computed_upfront_line_items",
    httpMethod: "GET",
    path: "/v1/quotes/{0}/computed_upfront_line_items",
    argPattern: "id,nestedParams?",
  },
};

export const billingResourcesC = {
  taxRates,
  taxCodes,
  taxIds,
  quotes,
};
