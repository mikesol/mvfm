import type { ResourceDef } from "../registry";

/** PaymentIntents: create, retrieve, update, list, confirm, capture, cancel, search, applyCustomerBalance, incrementAuthorization, verifyMicrodeposits */
export const paymentIntents: ResourceDef = {
  create: { kind: "stripe/create_payment_intent", httpMethod: "POST", path: "/v1/payment_intents", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_payment_intent", httpMethod: "GET", path: "/v1/payment_intents/{0}", argPattern: "id" },
  update: { kind: "stripe/update_payment_intent", httpMethod: "POST", path: "/v1/payment_intents/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_payment_intents", httpMethod: "GET", path: "/v1/payment_intents", argPattern: "params?" },
  confirm: { kind: "stripe/confirm_payment_intent", httpMethod: "POST", path: "/v1/payment_intents/{0}/confirm", argPattern: "id,params?" },
  capture: { kind: "stripe/capture_payment_intent", httpMethod: "POST", path: "/v1/payment_intents/{0}/capture", argPattern: "id,params?" },
  cancel: { kind: "stripe/cancel_payment_intent", httpMethod: "POST", path: "/v1/payment_intents/{0}/cancel", argPattern: "id,params?" },
  search: { kind: "stripe/search_payment_intents", httpMethod: "GET", path: "/v1/payment_intents/search", argPattern: "params" },
  applyCustomerBalance: { kind: "stripe/apply_customer_balance_payment_intent", httpMethod: "POST", path: "/v1/payment_intents/{0}/apply_customer_balance", argPattern: "id,params?" },
  incrementAuthorization: { kind: "stripe/increment_authorization_payment_intent", httpMethod: "POST", path: "/v1/payment_intents/{0}/increment_authorization", argPattern: "id,params" },
  verifyMicrodeposits: { kind: "stripe/verify_microdeposits_payment_intent", httpMethod: "POST", path: "/v1/payment_intents/{0}/verify_microdeposits", argPattern: "id,params?" },
};

/** Charges: create, retrieve, update, list, capture, search */
export const charges: ResourceDef = {
  create: { kind: "stripe/create_charge", httpMethod: "POST", path: "/v1/charges", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_charge", httpMethod: "GET", path: "/v1/charges/{0}", argPattern: "id" },
  update: { kind: "stripe/update_charge", httpMethod: "POST", path: "/v1/charges/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_charges", httpMethod: "GET", path: "/v1/charges", argPattern: "params?" },
  capture: { kind: "stripe/capture_charge", httpMethod: "POST", path: "/v1/charges/{0}/capture", argPattern: "id,params?" },
  search: { kind: "stripe/search_charges", httpMethod: "GET", path: "/v1/charges/search", argPattern: "params" },
};

/** Refunds: create, retrieve, update, list, cancel */
export const refunds: ResourceDef = {
  create: { kind: "stripe/create_refund", httpMethod: "POST", path: "/v1/refunds", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_refund", httpMethod: "GET", path: "/v1/refunds/{0}", argPattern: "id" },
  update: { kind: "stripe/update_refund", httpMethod: "POST", path: "/v1/refunds/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_refunds", httpMethod: "GET", path: "/v1/refunds", argPattern: "params?" },
  cancel: { kind: "stripe/cancel_refund", httpMethod: "POST", path: "/v1/refunds/{0}/cancel", argPattern: "id,params?" },
};

/** Disputes: retrieve, update, list, close */
export const disputes: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_dispute", httpMethod: "GET", path: "/v1/disputes/{0}", argPattern: "id" },
  update: { kind: "stripe/update_dispute", httpMethod: "POST", path: "/v1/disputes/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_disputes", httpMethod: "GET", path: "/v1/disputes", argPattern: "params?" },
  close: { kind: "stripe/close_dispute", httpMethod: "POST", path: "/v1/disputes/{0}/close", argPattern: "id,params?" },
};

/** PaymentMethods: create, retrieve, update, list, attach, detach */
export const paymentMethods: ResourceDef = {
  create: { kind: "stripe/create_payment_method", httpMethod: "POST", path: "/v1/payment_methods", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_payment_method", httpMethod: "GET", path: "/v1/payment_methods/{0}", argPattern: "id" },
  update: { kind: "stripe/update_payment_method", httpMethod: "POST", path: "/v1/payment_methods/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_payment_methods", httpMethod: "GET", path: "/v1/payment_methods", argPattern: "params?" },
  attach: { kind: "stripe/attach_payment_method", httpMethod: "POST", path: "/v1/payment_methods/{0}/attach", argPattern: "id,params" },
  detach: { kind: "stripe/detach_payment_method", httpMethod: "POST", path: "/v1/payment_methods/{0}/detach", argPattern: "id,params?" },
};

/** PaymentLinks: create, retrieve, update, list, listLineItems */
export const paymentLinks: ResourceDef = {
  create: { kind: "stripe/create_payment_link", httpMethod: "POST", path: "/v1/payment_links", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_payment_link", httpMethod: "GET", path: "/v1/payment_links/{0}", argPattern: "id" },
  update: { kind: "stripe/update_payment_link", httpMethod: "POST", path: "/v1/payment_links/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_payment_links", httpMethod: "GET", path: "/v1/payment_links", argPattern: "params?" },
  listLineItems: { kind: "stripe/list_payment_link_line_items", httpMethod: "GET", path: "/v1/payment_links/{0}/line_items", argPattern: "id,nestedParams?" },
};

/** SetupIntents: create, retrieve, update, list, confirm, cancel, verifyMicrodeposits */
export const setupIntents: ResourceDef = {
  create: { kind: "stripe/create_setup_intent", httpMethod: "POST", path: "/v1/setup_intents", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_setup_intent", httpMethod: "GET", path: "/v1/setup_intents/{0}", argPattern: "id" },
  update: { kind: "stripe/update_setup_intent", httpMethod: "POST", path: "/v1/setup_intents/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_setup_intents", httpMethod: "GET", path: "/v1/setup_intents", argPattern: "params?" },
  confirm: { kind: "stripe/confirm_setup_intent", httpMethod: "POST", path: "/v1/setup_intents/{0}/confirm", argPattern: "id,params?" },
  cancel: { kind: "stripe/cancel_setup_intent", httpMethod: "POST", path: "/v1/setup_intents/{0}/cancel", argPattern: "id,params?" },
  verifyMicrodeposits: { kind: "stripe/verify_microdeposits_setup_intent", httpMethod: "POST", path: "/v1/setup_intents/{0}/verify_microdeposits", argPattern: "id,params?" },
};

/** SetupAttempts: list */
export const setupAttempts: ResourceDef = {
  list: { kind: "stripe/list_setup_attempts", httpMethod: "GET", path: "/v1/setup_attempts", argPattern: "params" },
};

/** Sources: create, retrieve, update */
export const sources: ResourceDef = {
  create: { kind: "stripe/create_source", httpMethod: "POST", path: "/v1/sources", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_source", httpMethod: "GET", path: "/v1/sources/{0}", argPattern: "id" },
  update: { kind: "stripe/update_source", httpMethod: "POST", path: "/v1/sources/{0}", argPattern: "id,params" },
};

/** Tokens: create, retrieve */
export const tokens: ResourceDef = {
  create: { kind: "stripe/create_token", httpMethod: "POST", path: "/v1/tokens", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_token", httpMethod: "GET", path: "/v1/tokens/{0}", argPattern: "id" },
};

/** ConfirmationTokens: retrieve */
export const confirmationTokens: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_confirmation_token", httpMethod: "GET", path: "/v1/confirmation_tokens/{0}", argPattern: "id" },
};

/** PaymentMethodConfigurations: create, retrieve, update, list */
export const paymentMethodConfigurations: ResourceDef = {
  create: { kind: "stripe/create_payment_method_configuration", httpMethod: "POST", path: "/v1/payment_method_configurations", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_payment_method_configuration", httpMethod: "GET", path: "/v1/payment_method_configurations/{0}", argPattern: "id" },
  update: { kind: "stripe/update_payment_method_configuration", httpMethod: "POST", path: "/v1/payment_method_configurations/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_payment_method_configurations", httpMethod: "GET", path: "/v1/payment_method_configurations", argPattern: "params?" },
};

/** PaymentMethodDomains: create, retrieve, update, list, validate */
export const paymentMethodDomains: ResourceDef = {
  create: { kind: "stripe/create_payment_method_domain", httpMethod: "POST", path: "/v1/payment_method_domains", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_payment_method_domain", httpMethod: "GET", path: "/v1/payment_method_domains/{0}", argPattern: "id" },
  update: { kind: "stripe/update_payment_method_domain", httpMethod: "POST", path: "/v1/payment_method_domains/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_payment_method_domains", httpMethod: "GET", path: "/v1/payment_method_domains", argPattern: "params?" },
  validate: { kind: "stripe/validate_payment_method_domain", httpMethod: "POST", path: "/v1/payment_method_domains/{0}/validate", argPattern: "id,params?" },
};

/** Mandates: retrieve */
export const mandates: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_mandate", httpMethod: "GET", path: "/v1/mandates/{0}", argPattern: "id" },
};

/** All payment-group resource definitions. */
export const paymentResources = {
  paymentIntents,
  charges,
  refunds,
  disputes,
  paymentMethods,
  paymentLinks,
  setupIntents,
  setupAttempts,
  sources,
  tokens,
  confirmationTokens,
  paymentMethodConfigurations,
  paymentMethodDomains,
  mandates,
};
