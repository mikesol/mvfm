import type { ResourceDef } from "../registry";

/** Transfers: create, retrieve, update, list + reversals */
export const transfers: ResourceDef = {
  create: {
    kind: "stripe/create_transfer",
    httpMethod: "POST",
    path: "/v1/transfers",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_transfer",
    httpMethod: "GET",
    path: "/v1/transfers/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_transfer",
    httpMethod: "POST",
    path: "/v1/transfers/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_transfers",
    httpMethod: "GET",
    path: "/v1/transfers",
    argPattern: "params?",
  },
  createReversal: {
    kind: "stripe/create_transfer_reversal",
    httpMethod: "POST",
    path: "/v1/transfers/{0}/reversals",
    argPattern: "id,nestedParams",
  },
  retrieveReversal: {
    kind: "stripe/retrieve_transfer_reversal",
    httpMethod: "GET",
    path: "/v1/transfers/{0}/reversals/{1}",
    argPattern: "id,childId",
  },
  updateReversal: {
    kind: "stripe/update_transfer_reversal",
    httpMethod: "POST",
    path: "/v1/transfers/{0}/reversals/{1}",
    argPattern: "id,childId,params",
  },
  listReversals: {
    kind: "stripe/list_transfer_reversals",
    httpMethod: "GET",
    path: "/v1/transfers/{0}/reversals",
    argPattern: "id,nestedParams?",
  },
};

/** Payouts: create, retrieve, update, list, cancel, reverse */
export const payouts: ResourceDef = {
  create: {
    kind: "stripe/create_payout",
    httpMethod: "POST",
    path: "/v1/payouts",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_payout",
    httpMethod: "GET",
    path: "/v1/payouts/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_payout",
    httpMethod: "POST",
    path: "/v1/payouts/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_payouts",
    httpMethod: "GET",
    path: "/v1/payouts",
    argPattern: "params?",
  },
  cancel: {
    kind: "stripe/cancel_payout",
    httpMethod: "POST",
    path: "/v1/payouts/{0}/cancel",
    argPattern: "id,params?",
  },
  reverse: {
    kind: "stripe/reverse_payout",
    httpMethod: "POST",
    path: "/v1/payouts/{0}/reverse",
    argPattern: "id,params?",
  },
};

/** ApplicationFees: retrieve, list + refunds */
export const applicationFees: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_application_fee",
    httpMethod: "GET",
    path: "/v1/application_fees/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_application_fees",
    httpMethod: "GET",
    path: "/v1/application_fees",
    argPattern: "params?",
  },
  createRefund: {
    kind: "stripe/create_application_fee_refund",
    httpMethod: "POST",
    path: "/v1/application_fees/{0}/refunds",
    argPattern: "id,nestedParams",
  },
  retrieveRefund: {
    kind: "stripe/retrieve_application_fee_refund",
    httpMethod: "GET",
    path: "/v1/application_fees/{0}/refunds/{1}",
    argPattern: "id,childId",
  },
  updateRefund: {
    kind: "stripe/update_application_fee_refund",
    httpMethod: "POST",
    path: "/v1/application_fees/{0}/refunds/{1}",
    argPattern: "id,childId,params",
  },
  listRefunds: {
    kind: "stripe/list_application_fee_refunds",
    httpMethod: "GET",
    path: "/v1/application_fees/{0}/refunds",
    argPattern: "id,nestedParams?",
  },
};

/** Topups: create, retrieve, update, list, cancel */
export const topups: ResourceDef = {
  create: {
    kind: "stripe/create_topup",
    httpMethod: "POST",
    path: "/v1/topups",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_topup",
    httpMethod: "GET",
    path: "/v1/topups/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_topup",
    httpMethod: "POST",
    path: "/v1/topups/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_topups",
    httpMethod: "GET",
    path: "/v1/topups",
    argPattern: "params?",
  },
  cancel: {
    kind: "stripe/cancel_topup",
    httpMethod: "POST",
    path: "/v1/topups/{0}/cancel",
    argPattern: "id,params?",
  },
};

/** CountrySpecs: retrieve, list */
export const countrySpecs: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_country_spec",
    httpMethod: "GET",
    path: "/v1/country_specs/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_country_specs",
    httpMethod: "GET",
    path: "/v1/country_specs",
    argPattern: "params?",
  },
};

/** ExchangeRates: retrieve, list */
export const exchangeRates: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_exchange_rate",
    httpMethod: "GET",
    path: "/v1/exchange_rates/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_exchange_rates",
    httpMethod: "GET",
    path: "/v1/exchange_rates",
    argPattern: "params?",
  },
};

export const connectResourcesB = {
  transfers,
  payouts,
  applicationFees,
  topups,
  countrySpecs,
  exchangeRates,
};
