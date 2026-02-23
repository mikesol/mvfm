import type { ResourceDef } from "../registry";

/** Balance: retrieve (singleton) */
export const balance: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_balance",
    httpMethod: "GET",
    path: "/v1/balance",
    argPattern: "",
  },
};

/** BalanceSettings: retrieve (singleton), update (singleton) */
export const balanceSettings: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_balance_settings",
    httpMethod: "GET",
    path: "/v1/balance/settings",
    argPattern: "",
  },
  update: {
    kind: "stripe/update_balance_settings",
    httpMethod: "POST",
    path: "/v1/balance/settings",
    argPattern: "singleton,params",
  },
};

/** BalanceTransactions: retrieve, list */
export const balanceTransactions: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_balance_transaction",
    httpMethod: "GET",
    path: "/v1/balance_transactions/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_balance_transactions",
    httpMethod: "GET",
    path: "/v1/balance_transactions",
    argPattern: "params?",
  },
};

/** Files: retrieve, list (skip create — multipart upload) */
export const files: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_file",
    httpMethod: "GET",
    path: "/v1/files/{0}",
    argPattern: "id",
  },
  list: { kind: "stripe/list_files", httpMethod: "GET", path: "/v1/files", argPattern: "params?" },
};

/** FileLinks: create, retrieve, update, list */
export const fileLinks: ResourceDef = {
  create: {
    kind: "stripe/create_file_link",
    httpMethod: "POST",
    path: "/v1/file_links",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_file_link",
    httpMethod: "GET",
    path: "/v1/file_links/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_file_link",
    httpMethod: "POST",
    path: "/v1/file_links/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_file_links",
    httpMethod: "GET",
    path: "/v1/file_links",
    argPattern: "params?",
  },
};

/** WebhookEndpoints: create, retrieve, update, del, list */
export const webhookEndpoints: ResourceDef = {
  create: {
    kind: "stripe/create_webhook_endpoint",
    httpMethod: "POST",
    path: "/v1/webhook_endpoints",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_webhook_endpoint",
    httpMethod: "GET",
    path: "/v1/webhook_endpoints/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_webhook_endpoint",
    httpMethod: "POST",
    path: "/v1/webhook_endpoints/{0}",
    argPattern: "id,params",
  },
  del: {
    kind: "stripe/del_webhook_endpoint",
    httpMethod: "DELETE",
    path: "/v1/webhook_endpoints/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_webhook_endpoints",
    httpMethod: "GET",
    path: "/v1/webhook_endpoints",
    argPattern: "params?",
  },
};

/** Radar EarlyFraudWarnings: retrieve, list */
export const radarEarlyFraudWarnings: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_radar_early_fraud_warning",
    httpMethod: "GET",
    path: "/v1/radar/early_fraud_warnings/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_radar_early_fraud_warnings",
    httpMethod: "GET",
    path: "/v1/radar/early_fraud_warnings",
    argPattern: "params?",
  },
};

/** Radar ValueListItems: create, retrieve, del, list */
export const radarValueListItems: ResourceDef = {
  create: {
    kind: "stripe/create_radar_value_list_item",
    httpMethod: "POST",
    path: "/v1/radar/value_list_items",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_radar_value_list_item",
    httpMethod: "GET",
    path: "/v1/radar/value_list_items/{0}",
    argPattern: "id",
  },
  del: {
    kind: "stripe/del_radar_value_list_item",
    httpMethod: "DELETE",
    path: "/v1/radar/value_list_items/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_radar_value_list_items",
    httpMethod: "GET",
    path: "/v1/radar/value_list_items",
    argPattern: "params?",
  },
};

/** Radar ValueLists: create, retrieve, update, del, list */
export const radarValueLists: ResourceDef = {
  create: {
    kind: "stripe/create_radar_value_list",
    httpMethod: "POST",
    path: "/v1/radar/value_lists",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_radar_value_list",
    httpMethod: "GET",
    path: "/v1/radar/value_lists/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_radar_value_list",
    httpMethod: "POST",
    path: "/v1/radar/value_lists/{0}",
    argPattern: "id,params",
  },
  del: {
    kind: "stripe/del_radar_value_list",
    httpMethod: "DELETE",
    path: "/v1/radar/value_lists/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_radar_value_lists",
    httpMethod: "GET",
    path: "/v1/radar/value_lists",
    argPattern: "params?",
  },
};

export const miscResourcesA = {
  balance,
  balanceSettings,
  balanceTransactions,
  files,
  fileLinks,
  webhookEndpoints,
  radar: {
    earlyFraudWarnings: radarEarlyFraudWarnings,
    valueListItems: radarValueListItems,
    valueLists: radarValueLists,
  },
};
