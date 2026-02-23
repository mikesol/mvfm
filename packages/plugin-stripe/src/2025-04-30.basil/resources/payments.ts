import type { ResourceDef } from "../registry";

/** PaymentIntents: create, retrieve, update, list, confirm, capture, cancel, search, applyCustomerBalance, incrementAuthorization, verifyMicrodeposits */
export const paymentIntents: ResourceDef = {
  create: {
    kind: "stripe/create_payment_intent",
    httpMethod: "POST",
    path: "/v1/payment_intents",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_payment_intent",
    httpMethod: "GET",
    path: "/v1/payment_intents/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_payment_intent",
    httpMethod: "POST",
    path: "/v1/payment_intents/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_payment_intents",
    httpMethod: "GET",
    path: "/v1/payment_intents",
    argPattern: "params?",
  },
  confirm: {
    kind: "stripe/confirm_payment_intent",
    httpMethod: "POST",
    path: "/v1/payment_intents/{0}/confirm",
    argPattern: "id,params?",
  },
  capture: {
    kind: "stripe/capture_payment_intent",
    httpMethod: "POST",
    path: "/v1/payment_intents/{0}/capture",
    argPattern: "id,params?",
  },
  cancel: {
    kind: "stripe/cancel_payment_intent",
    httpMethod: "POST",
    path: "/v1/payment_intents/{0}/cancel",
    argPattern: "id,params?",
  },
  search: {
    kind: "stripe/search_payment_intents",
    httpMethod: "GET",
    path: "/v1/payment_intents/search",
    argPattern: "params",
  },
  applyCustomerBalance: {
    kind: "stripe/apply_customer_balance_payment_intent",
    httpMethod: "POST",
    path: "/v1/payment_intents/{0}/apply_customer_balance",
    argPattern: "id,params?",
  },
  incrementAuthorization: {
    kind: "stripe/increment_authorization_payment_intent",
    httpMethod: "POST",
    path: "/v1/payment_intents/{0}/increment_authorization",
    argPattern: "id,params",
  },
  verifyMicrodeposits: {
    kind: "stripe/verify_microdeposits_payment_intent",
    httpMethod: "POST",
    path: "/v1/payment_intents/{0}/verify_microdeposits",
    argPattern: "id,params?",
  },
};

/** Charges: create, retrieve, update, list, capture, search */
export const charges: ResourceDef = {
  create: {
    kind: "stripe/create_charge",
    httpMethod: "POST",
    path: "/v1/charges",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_charge",
    httpMethod: "GET",
    path: "/v1/charges/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_charge",
    httpMethod: "POST",
    path: "/v1/charges/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_charges",
    httpMethod: "GET",
    path: "/v1/charges",
    argPattern: "params?",
  },
  capture: {
    kind: "stripe/capture_charge",
    httpMethod: "POST",
    path: "/v1/charges/{0}/capture",
    argPattern: "id,params?",
  },
  search: {
    kind: "stripe/search_charges",
    httpMethod: "GET",
    path: "/v1/charges/search",
    argPattern: "params",
  },
};

/** Refunds: create, retrieve, update, list, cancel */
export const refunds: ResourceDef = {
  create: {
    kind: "stripe/create_refund",
    httpMethod: "POST",
    path: "/v1/refunds",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_refund",
    httpMethod: "GET",
    path: "/v1/refunds/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_refund",
    httpMethod: "POST",
    path: "/v1/refunds/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_refunds",
    httpMethod: "GET",
    path: "/v1/refunds",
    argPattern: "params?",
  },
  cancel: {
    kind: "stripe/cancel_refund",
    httpMethod: "POST",
    path: "/v1/refunds/{0}/cancel",
    argPattern: "id,params?",
  },
};

/** Disputes: retrieve, update, list, close */
export const disputes: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_dispute",
    httpMethod: "GET",
    path: "/v1/disputes/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_dispute",
    httpMethod: "POST",
    path: "/v1/disputes/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_disputes",
    httpMethod: "GET",
    path: "/v1/disputes",
    argPattern: "params?",
  },
  close: {
    kind: "stripe/close_dispute",
    httpMethod: "POST",
    path: "/v1/disputes/{0}/close",
    argPattern: "id,params?",
  },
};

/** PaymentMethods: create, retrieve, update, list, attach, detach */
export const paymentMethods: ResourceDef = {
  create: {
    kind: "stripe/create_payment_method",
    httpMethod: "POST",
    path: "/v1/payment_methods",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_payment_method",
    httpMethod: "GET",
    path: "/v1/payment_methods/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_payment_method",
    httpMethod: "POST",
    path: "/v1/payment_methods/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_payment_methods",
    httpMethod: "GET",
    path: "/v1/payment_methods",
    argPattern: "params?",
  },
  attach: {
    kind: "stripe/attach_payment_method",
    httpMethod: "POST",
    path: "/v1/payment_methods/{0}/attach",
    argPattern: "id,params",
  },
  detach: {
    kind: "stripe/detach_payment_method",
    httpMethod: "POST",
    path: "/v1/payment_methods/{0}/detach",
    argPattern: "id,params?",
  },
};

/** PaymentLinks: create, retrieve, update, list, listLineItems */
export const paymentLinks: ResourceDef = {
  create: {
    kind: "stripe/create_payment_link",
    httpMethod: "POST",
    path: "/v1/payment_links",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_payment_link",
    httpMethod: "GET",
    path: "/v1/payment_links/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_payment_link",
    httpMethod: "POST",
    path: "/v1/payment_links/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_payment_links",
    httpMethod: "GET",
    path: "/v1/payment_links",
    argPattern: "params?",
  },
  listLineItems: {
    kind: "stripe/list_payment_link_line_items",
    httpMethod: "GET",
    path: "/v1/payment_links/{0}/line_items",
    argPattern: "id,nestedParams?",
  },
};

/** All core payment-group resource definitions. */
export const paymentResourcesA = {
  paymentIntents,
  charges,
  refunds,
  disputes,
  paymentMethods,
  paymentLinks,
};
