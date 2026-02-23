import type { ResourceDef } from "../registry";

// ---- Issuing ----

/** Issuing Authorizations: retrieve, update, list, approve, decline */
export const issuingAuthorizations: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_issuing_authorization",
    httpMethod: "GET",
    path: "/v1/issuing/authorizations/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_issuing_authorization",
    httpMethod: "POST",
    path: "/v1/issuing/authorizations/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_issuing_authorizations",
    httpMethod: "GET",
    path: "/v1/issuing/authorizations",
    argPattern: "params?",
  },
  approve: {
    kind: "stripe/approve_issuing_authorization",
    httpMethod: "POST",
    path: "/v1/issuing/authorizations/{0}/approve",
    argPattern: "id,params?",
  },
  decline: {
    kind: "stripe/decline_issuing_authorization",
    httpMethod: "POST",
    path: "/v1/issuing/authorizations/{0}/decline",
    argPattern: "id,params?",
  },
};

/** Issuing Cardholders: create, retrieve, update, list */
export const issuingCardholders: ResourceDef = {
  create: {
    kind: "stripe/create_issuing_cardholder",
    httpMethod: "POST",
    path: "/v1/issuing/cardholders",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_issuing_cardholder",
    httpMethod: "GET",
    path: "/v1/issuing/cardholders/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_issuing_cardholder",
    httpMethod: "POST",
    path: "/v1/issuing/cardholders/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_issuing_cardholders",
    httpMethod: "GET",
    path: "/v1/issuing/cardholders",
    argPattern: "params?",
  },
};

/** Issuing Cards: create, retrieve, update, list */
export const issuingCards: ResourceDef = {
  create: {
    kind: "stripe/create_issuing_card",
    httpMethod: "POST",
    path: "/v1/issuing/cards",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_issuing_card",
    httpMethod: "GET",
    path: "/v1/issuing/cards/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_issuing_card",
    httpMethod: "POST",
    path: "/v1/issuing/cards/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_issuing_cards",
    httpMethod: "GET",
    path: "/v1/issuing/cards",
    argPattern: "params?",
  },
};

/** Issuing Disputes: create, retrieve, update, list, submit */
export const issuingDisputes: ResourceDef = {
  create: {
    kind: "stripe/create_issuing_dispute",
    httpMethod: "POST",
    path: "/v1/issuing/disputes",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_issuing_dispute",
    httpMethod: "GET",
    path: "/v1/issuing/disputes/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_issuing_dispute",
    httpMethod: "POST",
    path: "/v1/issuing/disputes/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_issuing_disputes",
    httpMethod: "GET",
    path: "/v1/issuing/disputes",
    argPattern: "params?",
  },
  submit: {
    kind: "stripe/submit_issuing_dispute",
    httpMethod: "POST",
    path: "/v1/issuing/disputes/{0}/submit",
    argPattern: "id,params?",
  },
};

/** Issuing PersonalizationDesigns: create, retrieve, update, list */
export const issuingPersonalizationDesigns: ResourceDef = {
  create: {
    kind: "stripe/create_issuing_personalization_design",
    httpMethod: "POST",
    path: "/v1/issuing/personalization_designs",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_issuing_personalization_design",
    httpMethod: "GET",
    path: "/v1/issuing/personalization_designs/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_issuing_personalization_design",
    httpMethod: "POST",
    path: "/v1/issuing/personalization_designs/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_issuing_personalization_designs",
    httpMethod: "GET",
    path: "/v1/issuing/personalization_designs",
    argPattern: "params?",
  },
};

/** Issuing PhysicalBundles: retrieve, list */
export const issuingPhysicalBundles: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_issuing_physical_bundle",
    httpMethod: "GET",
    path: "/v1/issuing/physical_bundles/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_issuing_physical_bundles",
    httpMethod: "GET",
    path: "/v1/issuing/physical_bundles",
    argPattern: "params?",
  },
};

/** Issuing Tokens: retrieve, update, list */
export const issuingTokens: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_issuing_token",
    httpMethod: "GET",
    path: "/v1/issuing/tokens/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_issuing_token",
    httpMethod: "POST",
    path: "/v1/issuing/tokens/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_issuing_tokens",
    httpMethod: "GET",
    path: "/v1/issuing/tokens",
    argPattern: "params?",
  },
};

/** Issuing Transactions: retrieve, update, list */
export const issuingTransactions: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_issuing_transaction",
    httpMethod: "GET",
    path: "/v1/issuing/transactions/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_issuing_transaction",
    httpMethod: "POST",
    path: "/v1/issuing/transactions/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_issuing_transactions",
    httpMethod: "GET",
    path: "/v1/issuing/transactions",
    argPattern: "params?",
  },
};

export const financeIssuingResources = {
  issuing: {
    authorizations: issuingAuthorizations,
    cardholders: issuingCardholders,
    cards: issuingCards,
    disputes: issuingDisputes,
    personalizationDesigns: issuingPersonalizationDesigns,
    physicalBundles: issuingPhysicalBundles,
    tokens: issuingTokens,
    transactions: issuingTransactions,
  },
};
