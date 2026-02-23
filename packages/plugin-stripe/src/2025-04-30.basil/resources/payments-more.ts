import type { ResourceDef } from "../registry";

/** SetupIntents: create, retrieve, update, list, confirm, cancel, verifyMicrodeposits */
export const setupIntents: ResourceDef = {
  create: {
    kind: "stripe/create_setup_intent",
    httpMethod: "POST",
    path: "/v1/setup_intents",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_setup_intent",
    httpMethod: "GET",
    path: "/v1/setup_intents/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_setup_intent",
    httpMethod: "POST",
    path: "/v1/setup_intents/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_setup_intents",
    httpMethod: "GET",
    path: "/v1/setup_intents",
    argPattern: "params?",
  },
  confirm: {
    kind: "stripe/confirm_setup_intent",
    httpMethod: "POST",
    path: "/v1/setup_intents/{0}/confirm",
    argPattern: "id,params?",
  },
  cancel: {
    kind: "stripe/cancel_setup_intent",
    httpMethod: "POST",
    path: "/v1/setup_intents/{0}/cancel",
    argPattern: "id,params?",
  },
  verifyMicrodeposits: {
    kind: "stripe/verify_microdeposits_setup_intent",
    httpMethod: "POST",
    path: "/v1/setup_intents/{0}/verify_microdeposits",
    argPattern: "id,params?",
  },
};

/** SetupAttempts: list */
export const setupAttempts: ResourceDef = {
  list: {
    kind: "stripe/list_setup_attempts",
    httpMethod: "GET",
    path: "/v1/setup_attempts",
    argPattern: "params",
  },
};

/** Sources: create, retrieve, update */
export const sources: ResourceDef = {
  create: {
    kind: "stripe/create_source",
    httpMethod: "POST",
    path: "/v1/sources",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_source",
    httpMethod: "GET",
    path: "/v1/sources/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_source",
    httpMethod: "POST",
    path: "/v1/sources/{0}",
    argPattern: "id,params",
  },
};

/** Tokens: create, retrieve */
export const tokens: ResourceDef = {
  create: {
    kind: "stripe/create_token",
    httpMethod: "POST",
    path: "/v1/tokens",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_token",
    httpMethod: "GET",
    path: "/v1/tokens/{0}",
    argPattern: "id",
  },
};

/** ConfirmationTokens: retrieve */
export const confirmationTokens: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_confirmation_token",
    httpMethod: "GET",
    path: "/v1/confirmation_tokens/{0}",
    argPattern: "id",
  },
};

/** PaymentMethodConfigurations: create, retrieve, update, list */
export const paymentMethodConfigurations: ResourceDef = {
  create: {
    kind: "stripe/create_payment_method_configuration",
    httpMethod: "POST",
    path: "/v1/payment_method_configurations",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_payment_method_configuration",
    httpMethod: "GET",
    path: "/v1/payment_method_configurations/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_payment_method_configuration",
    httpMethod: "POST",
    path: "/v1/payment_method_configurations/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_payment_method_configurations",
    httpMethod: "GET",
    path: "/v1/payment_method_configurations",
    argPattern: "params?",
  },
};

/** PaymentMethodDomains: create, retrieve, update, list, validate */
export const paymentMethodDomains: ResourceDef = {
  create: {
    kind: "stripe/create_payment_method_domain",
    httpMethod: "POST",
    path: "/v1/payment_method_domains",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_payment_method_domain",
    httpMethod: "GET",
    path: "/v1/payment_method_domains/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_payment_method_domain",
    httpMethod: "POST",
    path: "/v1/payment_method_domains/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_payment_method_domains",
    httpMethod: "GET",
    path: "/v1/payment_method_domains",
    argPattern: "params?",
  },
  validate: {
    kind: "stripe/validate_payment_method_domain",
    httpMethod: "POST",
    path: "/v1/payment_method_domains/{0}/validate",
    argPattern: "id,params?",
  },
};

/** Mandates: retrieve */
export const mandates: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_mandate",
    httpMethod: "GET",
    path: "/v1/mandates/{0}",
    argPattern: "id",
  },
};

/** Additional payment-group resource definitions. */
export const paymentResourcesB = {
  setupIntents,
  setupAttempts,
  sources,
  tokens,
  confirmationTokens,
  paymentMethodConfigurations,
  paymentMethodDomains,
  mandates,
};
