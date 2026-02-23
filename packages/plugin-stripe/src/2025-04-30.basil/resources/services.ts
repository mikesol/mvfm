import type { ResourceDef } from "../registry";

/** Checkout Sessions: create, retrieve, update, list, expire, listLineItems */
export const checkoutSessions: ResourceDef = {
  create: { kind: "stripe/create_checkout_session", httpMethod: "POST", path: "/v1/checkout/sessions", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_checkout_session", httpMethod: "GET", path: "/v1/checkout/sessions/{0}", argPattern: "id" },
  update: { kind: "stripe/update_checkout_session", httpMethod: "POST", path: "/v1/checkout/sessions/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_checkout_sessions", httpMethod: "GET", path: "/v1/checkout/sessions", argPattern: "params?" },
  expire: { kind: "stripe/expire_checkout_session", httpMethod: "POST", path: "/v1/checkout/sessions/{0}/expire", argPattern: "id,params?" },
  listLineItems: { kind: "stripe/list_checkout_session_line_items", httpMethod: "GET", path: "/v1/checkout/sessions/{0}/line_items", argPattern: "id,nestedParams?" },
};

/** BillingPortal Configurations: create, retrieve, update, list */
export const billingPortalConfigurations: ResourceDef = {
  create: { kind: "stripe/create_billing_portal_configuration", httpMethod: "POST", path: "/v1/billing_portal/configurations", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_billing_portal_configuration", httpMethod: "GET", path: "/v1/billing_portal/configurations/{0}", argPattern: "id" },
  update: { kind: "stripe/update_billing_portal_configuration", httpMethod: "POST", path: "/v1/billing_portal/configurations/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_billing_portal_configurations", httpMethod: "GET", path: "/v1/billing_portal/configurations", argPattern: "params?" },
};

/** BillingPortal Sessions: create */
export const billingPortalSessions: ResourceDef = {
  create: { kind: "stripe/create_billing_portal_session", httpMethod: "POST", path: "/v1/billing_portal/sessions", argPattern: "params" },
};

/** Billing Alerts: create, retrieve, list, activate, archive, deactivate */
export const billingAlerts: ResourceDef = {
  create: { kind: "stripe/create_billing_alert", httpMethod: "POST", path: "/v1/billing/alerts", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_billing_alert", httpMethod: "GET", path: "/v1/billing/alerts/{0}", argPattern: "id" },
  list: { kind: "stripe/list_billing_alerts", httpMethod: "GET", path: "/v1/billing/alerts", argPattern: "params?" },
  activate: { kind: "stripe/activate_billing_alert", httpMethod: "POST", path: "/v1/billing/alerts/{0}/activate", argPattern: "id,params?" },
  archive: { kind: "stripe/archive_billing_alert", httpMethod: "POST", path: "/v1/billing/alerts/{0}/archive", argPattern: "id,params?" },
  deactivate: { kind: "stripe/deactivate_billing_alert", httpMethod: "POST", path: "/v1/billing/alerts/{0}/deactivate", argPattern: "id,params?" },
};

/** Billing CreditBalanceSummary: retrieve (singleton) */
export const billingCreditBalanceSummary: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_billing_credit_balance_summary", httpMethod: "GET", path: "/v1/billing/credit_balance_summary", argPattern: "" },
};

/** Billing CreditBalanceTransactions: retrieve, list */
export const billingCreditBalanceTransactions: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_billing_credit_balance_transaction", httpMethod: "GET", path: "/v1/billing/credit_balance_transactions/{0}", argPattern: "id" },
  list: { kind: "stripe/list_billing_credit_balance_transactions", httpMethod: "GET", path: "/v1/billing/credit_balance_transactions", argPattern: "params?" },
};

/** Billing CreditGrants: create, retrieve, update, list, expire, voidGrant */
export const billingCreditGrants: ResourceDef = {
  create: { kind: "stripe/create_billing_credit_grant", httpMethod: "POST", path: "/v1/billing/credit_grants", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_billing_credit_grant", httpMethod: "GET", path: "/v1/billing/credit_grants/{0}", argPattern: "id" },
  update: { kind: "stripe/update_billing_credit_grant", httpMethod: "POST", path: "/v1/billing/credit_grants/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_billing_credit_grants", httpMethod: "GET", path: "/v1/billing/credit_grants", argPattern: "params?" },
  expire: { kind: "stripe/expire_billing_credit_grant", httpMethod: "POST", path: "/v1/billing/credit_grants/{0}/expire", argPattern: "id,params?" },
  voidGrant: { kind: "stripe/void_billing_credit_grant", httpMethod: "POST", path: "/v1/billing/credit_grants/{0}/void", argPattern: "id,params?" },
};

/** Billing Meters: create, retrieve, update, list, deactivate, reactivate, listEventSummaries */
export const billingMeters: ResourceDef = {
  create: { kind: "stripe/create_billing_meter", httpMethod: "POST", path: "/v1/billing/meters", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_billing_meter", httpMethod: "GET", path: "/v1/billing/meters/{0}", argPattern: "id" },
  update: { kind: "stripe/update_billing_meter", httpMethod: "POST", path: "/v1/billing/meters/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_billing_meters", httpMethod: "GET", path: "/v1/billing/meters", argPattern: "params?" },
  deactivate: { kind: "stripe/deactivate_billing_meter", httpMethod: "POST", path: "/v1/billing/meters/{0}/deactivate", argPattern: "id,params?" },
  reactivate: { kind: "stripe/reactivate_billing_meter", httpMethod: "POST", path: "/v1/billing/meters/{0}/reactivate", argPattern: "id,params?" },
  listEventSummaries: { kind: "stripe/list_billing_meter_event_summaries", httpMethod: "GET", path: "/v1/billing/meters/{0}/event_summaries", argPattern: "id,nestedParams?" },
};

/** Billing MeterEvents: create */
export const billingMeterEvents: ResourceDef = {
  create: { kind: "stripe/create_billing_meter_event", httpMethod: "POST", path: "/v1/billing/meter_events", argPattern: "params" },
};

/** Billing MeterEventAdjustments: create */
export const billingMeterEventAdjustments: ResourceDef = {
  create: { kind: "stripe/create_billing_meter_event_adjustment", httpMethod: "POST", path: "/v1/billing/meter_event_adjustments", argPattern: "params" },
};

/** ShippingRates: create, retrieve, update, list */
export const shippingRates: ResourceDef = {
  create: { kind: "stripe/create_shipping_rate", httpMethod: "POST", path: "/v1/shipping_rates", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_shipping_rate", httpMethod: "GET", path: "/v1/shipping_rates/{0}", argPattern: "id" },
  update: { kind: "stripe/update_shipping_rate", httpMethod: "POST", path: "/v1/shipping_rates/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_shipping_rates", httpMethod: "GET", path: "/v1/shipping_rates", argPattern: "params?" },
};

/** Reviews: retrieve, list, approve */
export const reviews: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_review", httpMethod: "GET", path: "/v1/reviews/{0}", argPattern: "id" },
  list: { kind: "stripe/list_reviews", httpMethod: "GET", path: "/v1/reviews", argPattern: "params?" },
  approve: { kind: "stripe/approve_review", httpMethod: "POST", path: "/v1/reviews/{0}/approve", argPattern: "id,params?" },
};

/** EphemeralKeys: create, del */
export const ephemeralKeys: ResourceDef = {
  create: { kind: "stripe/create_ephemeral_key", httpMethod: "POST", path: "/v1/ephemeral_keys", argPattern: "params" },
  del: { kind: "stripe/del_ephemeral_key", httpMethod: "DELETE", path: "/v1/ephemeral_keys/{0}", argPattern: "del" },
};

/** Events: retrieve, list */
export const events: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_event", httpMethod: "GET", path: "/v1/events/{0}", argPattern: "id" },
  list: { kind: "stripe/list_events", httpMethod: "GET", path: "/v1/events", argPattern: "params?" },
};

export const serviceResources = {
  checkout: { sessions: checkoutSessions },
  billingPortal: { configurations: billingPortalConfigurations, sessions: billingPortalSessions },
  billing: {
    alerts: billingAlerts,
    creditBalanceSummary: billingCreditBalanceSummary,
    creditBalanceTransactions: billingCreditBalanceTransactions,
    creditGrants: billingCreditGrants,
    meters: billingMeters,
    meterEvents: billingMeterEvents,
    meterEventAdjustments: billingMeterEventAdjustments,
  },
  shippingRates,
  reviews,
  ephemeralKeys,
  events,
};
