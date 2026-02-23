import type { ResourceDef } from "../registry";

/** Billing Alerts: create, retrieve, list, activate, archive, deactivate */
export const billingAlerts: ResourceDef = {
  create: {
    kind: "stripe/create_billing_alert",
    httpMethod: "POST",
    path: "/v1/billing/alerts",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_billing_alert",
    httpMethod: "GET",
    path: "/v1/billing/alerts/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_billing_alerts",
    httpMethod: "GET",
    path: "/v1/billing/alerts",
    argPattern: "params?",
  },
  activate: {
    kind: "stripe/activate_billing_alert",
    httpMethod: "POST",
    path: "/v1/billing/alerts/{0}/activate",
    argPattern: "id,params?",
  },
  archive: {
    kind: "stripe/archive_billing_alert",
    httpMethod: "POST",
    path: "/v1/billing/alerts/{0}/archive",
    argPattern: "id,params?",
  },
  deactivate: {
    kind: "stripe/deactivate_billing_alert",
    httpMethod: "POST",
    path: "/v1/billing/alerts/{0}/deactivate",
    argPattern: "id,params?",
  },
};

/** Billing CreditBalanceSummary: retrieve (singleton) */
export const billingCreditBalanceSummary: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_billing_credit_balance_summary",
    httpMethod: "GET",
    path: "/v1/billing/credit_balance_summary",
    argPattern: "",
  },
};

/** Billing CreditBalanceTransactions: retrieve, list */
export const billingCreditBalanceTransactions: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_billing_credit_balance_transaction",
    httpMethod: "GET",
    path: "/v1/billing/credit_balance_transactions/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_billing_credit_balance_transactions",
    httpMethod: "GET",
    path: "/v1/billing/credit_balance_transactions",
    argPattern: "params?",
  },
};

/** Billing CreditGrants: create, retrieve, update, list, expire, voidGrant */
export const billingCreditGrants: ResourceDef = {
  create: {
    kind: "stripe/create_billing_credit_grant",
    httpMethod: "POST",
    path: "/v1/billing/credit_grants",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_billing_credit_grant",
    httpMethod: "GET",
    path: "/v1/billing/credit_grants/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_billing_credit_grant",
    httpMethod: "POST",
    path: "/v1/billing/credit_grants/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_billing_credit_grants",
    httpMethod: "GET",
    path: "/v1/billing/credit_grants",
    argPattern: "params?",
  },
  expire: {
    kind: "stripe/expire_billing_credit_grant",
    httpMethod: "POST",
    path: "/v1/billing/credit_grants/{0}/expire",
    argPattern: "id,params?",
  },
  voidGrant: {
    kind: "stripe/void_billing_credit_grant",
    httpMethod: "POST",
    path: "/v1/billing/credit_grants/{0}/void",
    argPattern: "id,params?",
  },
};

/** Billing Meters: create, retrieve, update, list, deactivate, reactivate, listEventSummaries */
export const billingMeters: ResourceDef = {
  create: {
    kind: "stripe/create_billing_meter",
    httpMethod: "POST",
    path: "/v1/billing/meters",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_billing_meter",
    httpMethod: "GET",
    path: "/v1/billing/meters/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_billing_meter",
    httpMethod: "POST",
    path: "/v1/billing/meters/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_billing_meters",
    httpMethod: "GET",
    path: "/v1/billing/meters",
    argPattern: "params?",
  },
  deactivate: {
    kind: "stripe/deactivate_billing_meter",
    httpMethod: "POST",
    path: "/v1/billing/meters/{0}/deactivate",
    argPattern: "id,params?",
  },
  reactivate: {
    kind: "stripe/reactivate_billing_meter",
    httpMethod: "POST",
    path: "/v1/billing/meters/{0}/reactivate",
    argPattern: "id,params?",
  },
  listEventSummaries: {
    kind: "stripe/list_billing_meter_event_summaries",
    httpMethod: "GET",
    path: "/v1/billing/meters/{0}/event_summaries",
    argPattern: "id,nestedParams?",
  },
};

/** Billing MeterEvents: create */
export const billingMeterEvents: ResourceDef = {
  create: {
    kind: "stripe/create_billing_meter_event",
    httpMethod: "POST",
    path: "/v1/billing/meter_events",
    argPattern: "params",
  },
};

/** Billing MeterEventAdjustments: create */
export const billingMeterEventAdjustments: ResourceDef = {
  create: {
    kind: "stripe/create_billing_meter_event_adjustment",
    httpMethod: "POST",
    path: "/v1/billing/meter_event_adjustments",
    argPattern: "params",
  },
};

export const serviceResourcesB = {
  billing: {
    alerts: billingAlerts,
    creditBalanceSummary: billingCreditBalanceSummary,
    creditBalanceTransactions: billingCreditBalanceTransactions,
    creditGrants: billingCreditGrants,
    meters: billingMeters,
    meterEvents: billingMeterEvents,
    meterEventAdjustments: billingMeterEventAdjustments,
  },
};
