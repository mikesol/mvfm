import type { ResourceDef } from "../registry";

/** FinancialConnections Accounts: retrieve, list, disconnect, refresh, subscribe, unsubscribe, listOwners */
export const financialConnectionsAccounts: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_financial_connections_account",
    httpMethod: "GET",
    path: "/v1/financial_connections/accounts/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_financial_connections_accounts",
    httpMethod: "GET",
    path: "/v1/financial_connections/accounts",
    argPattern: "params?",
  },
  disconnect: {
    kind: "stripe/disconnect_financial_connections_account",
    httpMethod: "POST",
    path: "/v1/financial_connections/accounts/{0}/disconnect",
    argPattern: "id,params?",
  },
  refresh: {
    kind: "stripe/refresh_financial_connections_account",
    httpMethod: "POST",
    path: "/v1/financial_connections/accounts/{0}/refresh",
    argPattern: "id,params",
  },
  subscribe: {
    kind: "stripe/subscribe_financial_connections_account",
    httpMethod: "POST",
    path: "/v1/financial_connections/accounts/{0}/subscribe",
    argPattern: "id,params",
  },
  unsubscribe: {
    kind: "stripe/unsubscribe_financial_connections_account",
    httpMethod: "POST",
    path: "/v1/financial_connections/accounts/{0}/unsubscribe",
    argPattern: "id,params",
  },
  listOwners: {
    kind: "stripe/list_financial_connections_account_owners",
    httpMethod: "GET",
    path: "/v1/financial_connections/accounts/{0}/owners",
    argPattern: "id,nestedParams?",
  },
};

/** FinancialConnections Sessions: create, retrieve */
export const financialConnectionsSessions: ResourceDef = {
  create: {
    kind: "stripe/create_financial_connections_session",
    httpMethod: "POST",
    path: "/v1/financial_connections/sessions",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_financial_connections_session",
    httpMethod: "GET",
    path: "/v1/financial_connections/sessions/{0}",
    argPattern: "id",
  },
};

/** FinancialConnections Transactions: retrieve, list */
export const financialConnectionsTransactions: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_financial_connections_transaction",
    httpMethod: "GET",
    path: "/v1/financial_connections/transactions/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_financial_connections_transactions",
    httpMethod: "GET",
    path: "/v1/financial_connections/transactions",
    argPattern: "params?",
  },
};

/** Climate Orders: create, retrieve, update, list, cancel */
export const climateOrders: ResourceDef = {
  create: {
    kind: "stripe/create_climate_order",
    httpMethod: "POST",
    path: "/v1/climate/orders",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_climate_order",
    httpMethod: "GET",
    path: "/v1/climate/orders/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_climate_order",
    httpMethod: "POST",
    path: "/v1/climate/orders/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_climate_orders",
    httpMethod: "GET",
    path: "/v1/climate/orders",
    argPattern: "params?",
  },
  cancel: {
    kind: "stripe/cancel_climate_order",
    httpMethod: "POST",
    path: "/v1/climate/orders/{0}/cancel",
    argPattern: "id,params?",
  },
};

/** Climate Products: retrieve, list */
export const climateProducts: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_climate_product",
    httpMethod: "GET",
    path: "/v1/climate/products/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_climate_products",
    httpMethod: "GET",
    path: "/v1/climate/products",
    argPattern: "params?",
  },
};

/** Climate Suppliers: retrieve, list */
export const climateSuppliers: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_climate_supplier",
    httpMethod: "GET",
    path: "/v1/climate/suppliers/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_climate_suppliers",
    httpMethod: "GET",
    path: "/v1/climate/suppliers",
    argPattern: "params?",
  },
};

/** Entitlements ActiveEntitlements: retrieve, list */
export const entitlementsActiveEntitlements: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_entitlements_active_entitlement",
    httpMethod: "GET",
    path: "/v1/entitlements/active_entitlements/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_entitlements_active_entitlements",
    httpMethod: "GET",
    path: "/v1/entitlements/active_entitlements",
    argPattern: "params?",
  },
};

/** Entitlements Features: create, retrieve, update, list */
export const entitlementsFeatures: ResourceDef = {
  create: {
    kind: "stripe/create_entitlements_feature",
    httpMethod: "POST",
    path: "/v1/entitlements/features",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_entitlements_feature",
    httpMethod: "GET",
    path: "/v1/entitlements/features/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_entitlements_feature",
    httpMethod: "POST",
    path: "/v1/entitlements/features/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_entitlements_features",
    httpMethod: "GET",
    path: "/v1/entitlements/features",
    argPattern: "params?",
  },
};

/** Forwarding Requests: create, retrieve, list */
export const forwardingRequests: ResourceDef = {
  create: {
    kind: "stripe/create_forwarding_request",
    httpMethod: "POST",
    path: "/v1/forwarding/requests",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_forwarding_request",
    httpMethod: "GET",
    path: "/v1/forwarding/requests/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_forwarding_requests",
    httpMethod: "GET",
    path: "/v1/forwarding/requests",
    argPattern: "params?",
  },
};

export const miscResourcesB = {
  financialConnections: {
    accounts: financialConnectionsAccounts,
    sessions: financialConnectionsSessions,
    transactions: financialConnectionsTransactions,
  },
  climate: { orders: climateOrders, products: climateProducts, suppliers: climateSuppliers },
  entitlements: {
    activeEntitlements: entitlementsActiveEntitlements,
    features: entitlementsFeatures,
  },
  forwarding: { requests: forwardingRequests },
};
