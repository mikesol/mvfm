import type { ResourceDef } from "../registry";

/** Checkout Sessions: create, retrieve, update, list, expire, listLineItems */
export const checkoutSessions: ResourceDef = {
  create: {
    kind: "stripe/create_checkout_session",
    httpMethod: "POST",
    path: "/v1/checkout/sessions",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_checkout_session",
    httpMethod: "GET",
    path: "/v1/checkout/sessions/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_checkout_session",
    httpMethod: "POST",
    path: "/v1/checkout/sessions/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_checkout_sessions",
    httpMethod: "GET",
    path: "/v1/checkout/sessions",
    argPattern: "params?",
  },
  expire: {
    kind: "stripe/expire_checkout_session",
    httpMethod: "POST",
    path: "/v1/checkout/sessions/{0}/expire",
    argPattern: "id,params?",
  },
  listLineItems: {
    kind: "stripe/list_checkout_session_line_items",
    httpMethod: "GET",
    path: "/v1/checkout/sessions/{0}/line_items",
    argPattern: "id,nestedParams?",
  },
};

/** BillingPortal Configurations: create, retrieve, update, list */
export const billingPortalConfigurations: ResourceDef = {
  create: {
    kind: "stripe/create_billing_portal_configuration",
    httpMethod: "POST",
    path: "/v1/billing_portal/configurations",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_billing_portal_configuration",
    httpMethod: "GET",
    path: "/v1/billing_portal/configurations/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_billing_portal_configuration",
    httpMethod: "POST",
    path: "/v1/billing_portal/configurations/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_billing_portal_configurations",
    httpMethod: "GET",
    path: "/v1/billing_portal/configurations",
    argPattern: "params?",
  },
};

/** BillingPortal Sessions: create */
export const billingPortalSessions: ResourceDef = {
  create: {
    kind: "stripe/create_billing_portal_session",
    httpMethod: "POST",
    path: "/v1/billing_portal/sessions",
    argPattern: "params",
  },
};

/** ShippingRates: create, retrieve, update, list */
export const shippingRates: ResourceDef = {
  create: {
    kind: "stripe/create_shipping_rate",
    httpMethod: "POST",
    path: "/v1/shipping_rates",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_shipping_rate",
    httpMethod: "GET",
    path: "/v1/shipping_rates/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_shipping_rate",
    httpMethod: "POST",
    path: "/v1/shipping_rates/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_shipping_rates",
    httpMethod: "GET",
    path: "/v1/shipping_rates",
    argPattern: "params?",
  },
};

/** Reviews: retrieve, list, approve */
export const reviews: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_review",
    httpMethod: "GET",
    path: "/v1/reviews/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_reviews",
    httpMethod: "GET",
    path: "/v1/reviews",
    argPattern: "params?",
  },
  approve: {
    kind: "stripe/approve_review",
    httpMethod: "POST",
    path: "/v1/reviews/{0}/approve",
    argPattern: "id,params?",
  },
};

/** EphemeralKeys: create, del */
export const ephemeralKeys: ResourceDef = {
  create: {
    kind: "stripe/create_ephemeral_key",
    httpMethod: "POST",
    path: "/v1/ephemeral_keys",
    argPattern: "params",
  },
  del: {
    kind: "stripe/del_ephemeral_key",
    httpMethod: "DELETE",
    path: "/v1/ephemeral_keys/{0}",
    argPattern: "del",
  },
};

/** Events: retrieve, list */
export const events: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_event",
    httpMethod: "GET",
    path: "/v1/events/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_events",
    httpMethod: "GET",
    path: "/v1/events",
    argPattern: "params?",
  },
};

export const serviceResourcesA = {
  checkout: { sessions: checkoutSessions },
  billingPortal: { configurations: billingPortalConfigurations, sessions: billingPortalSessions },
  shippingRates,
  reviews,
  ephemeralKeys,
  events,
};
