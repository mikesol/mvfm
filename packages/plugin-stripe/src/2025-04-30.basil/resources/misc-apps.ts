import type { ResourceDef } from "../registry";

/** Apps Secrets: create, list, find, deleteWhere */
export const appsSecrets: ResourceDef = {
  create: {
    kind: "stripe/create_apps_secret",
    httpMethod: "POST",
    path: "/v1/apps/secrets",
    argPattern: "params",
  },
  list: {
    kind: "stripe/list_apps_secrets",
    httpMethod: "GET",
    path: "/v1/apps/secrets",
    argPattern: "params?",
  },
  find: {
    kind: "stripe/find_apps_secret",
    httpMethod: "GET",
    path: "/v1/apps/secrets/find",
    argPattern: "params",
  },
  deleteWhere: {
    kind: "stripe/delete_where_apps_secret",
    httpMethod: "POST",
    path: "/v1/apps/secrets/delete",
    argPattern: "params",
  },
};

/** ApplePayDomains: create, retrieve, del, list */
export const applePayDomains: ResourceDef = {
  create: {
    kind: "stripe/create_apple_pay_domain",
    httpMethod: "POST",
    path: "/v1/apple_pay/domains",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_apple_pay_domain",
    httpMethod: "GET",
    path: "/v1/apple_pay/domains/{0}",
    argPattern: "id",
  },
  del: {
    kind: "stripe/del_apple_pay_domain",
    httpMethod: "DELETE",
    path: "/v1/apple_pay/domains/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_apple_pay_domains",
    httpMethod: "GET",
    path: "/v1/apple_pay/domains",
    argPattern: "params?",
  },
};

/** PaymentRecords: retrieve */
export const paymentRecords: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_payment_record",
    httpMethod: "GET",
    path: "/v1/payment_records/{0}",
    argPattern: "id",
  },
};

/** PaymentAttemptRecords: retrieve, list */
export const paymentAttemptRecords: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_payment_attempt_record",
    httpMethod: "GET",
    path: "/v1/payment_attempt_records/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_payment_attempt_records",
    httpMethod: "GET",
    path: "/v1/payment_attempt_records",
    argPattern: "params?",
  },
};

export const miscResourcesE = {
  apps: { secrets: appsSecrets },
  applePayDomains,
  paymentRecords,
  paymentAttemptRecords,
};
