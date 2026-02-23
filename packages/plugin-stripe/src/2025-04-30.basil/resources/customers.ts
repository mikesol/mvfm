import type { ResourceDef } from "../registry";

/** Customers: full CRUD + search + all sub-resource methods */
export const customers: ResourceDef = {
  create: { kind: "stripe/create_customer", httpMethod: "POST", path: "/v1/customers", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_customer", httpMethod: "GET", path: "/v1/customers/{0}", argPattern: "id" },
  update: { kind: "stripe/update_customer", httpMethod: "POST", path: "/v1/customers/{0}", argPattern: "id,params" },
  del: { kind: "stripe/del_customer", httpMethod: "DELETE", path: "/v1/customers/{0}", argPattern: "del" },
  list: { kind: "stripe/list_customers", httpMethod: "GET", path: "/v1/customers", argPattern: "params?" },
  search: { kind: "stripe/search_customers", httpMethod: "GET", path: "/v1/customers/search", argPattern: "params" },
  // Sub-resources: balance transactions
  createBalanceTransaction: { kind: "stripe/create_customer_balance_transaction", httpMethod: "POST", path: "/v1/customers/{0}/balance_transactions", argPattern: "id,nestedParams" },
  retrieveBalanceTransaction: { kind: "stripe/retrieve_customer_balance_transaction", httpMethod: "GET", path: "/v1/customers/{0}/balance_transactions/{1}", argPattern: "id,childId" },
  updateBalanceTransaction: { kind: "stripe/update_customer_balance_transaction", httpMethod: "POST", path: "/v1/customers/{0}/balance_transactions/{1}", argPattern: "id,childId,params" },
  listBalanceTransactions: { kind: "stripe/list_customer_balance_transactions", httpMethod: "GET", path: "/v1/customers/{0}/balance_transactions", argPattern: "id,nestedParams?" },
  // Sub-resources: cash balance
  retrieveCashBalance: { kind: "stripe/retrieve_customer_cash_balance", httpMethod: "GET", path: "/v1/customers/{0}/cash_balance", argPattern: "id" },
  updateCashBalance: { kind: "stripe/update_customer_cash_balance", httpMethod: "POST", path: "/v1/customers/{0}/cash_balance", argPattern: "id,params" },
  listCashBalanceTransactions: { kind: "stripe/list_customer_cash_balance_transactions", httpMethod: "GET", path: "/v1/customers/{0}/cash_balance_transactions", argPattern: "id,nestedParams?" },
  retrieveCashBalanceTransaction: { kind: "stripe/retrieve_customer_cash_balance_transaction", httpMethod: "GET", path: "/v1/customers/{0}/cash_balance_transactions/{1}", argPattern: "id,childId" },
  // Sub-resources: funding instructions
  createFundingInstructions: { kind: "stripe/create_customer_funding_instructions", httpMethod: "POST", path: "/v1/customers/{0}/funding_instructions", argPattern: "id,nestedParams" },
  // Sub-resources: payment methods
  listPaymentMethods: { kind: "stripe/list_customer_payment_methods", httpMethod: "GET", path: "/v1/customers/{0}/payment_methods", argPattern: "id,nestedParams?" },
  retrievePaymentMethod: { kind: "stripe/retrieve_customer_payment_method", httpMethod: "GET", path: "/v1/customers/{0}/payment_methods/{1}", argPattern: "id,childId" },
  // Sub-resources: sources
  createSource: { kind: "stripe/create_customer_source", httpMethod: "POST", path: "/v1/customers/{0}/sources", argPattern: "id,nestedParams" },
  retrieveSource: { kind: "stripe/retrieve_customer_source", httpMethod: "GET", path: "/v1/customers/{0}/sources/{1}", argPattern: "id,childId" },
  updateSource: { kind: "stripe/update_customer_source", httpMethod: "POST", path: "/v1/customers/{0}/sources/{1}", argPattern: "id,childId,params" },
  deleteSource: { kind: "stripe/delete_customer_source", httpMethod: "DELETE", path: "/v1/customers/{0}/sources/{1}", argPattern: "id,childId,del" },
  listSources: { kind: "stripe/list_customer_sources", httpMethod: "GET", path: "/v1/customers/{0}/sources", argPattern: "id,nestedParams?" },
  verifySource: { kind: "stripe/verify_customer_source", httpMethod: "POST", path: "/v1/customers/{0}/sources/{1}/verify", argPattern: "id,childId,params" },
  // Sub-resources: tax IDs
  createTaxId: { kind: "stripe/create_customer_tax_id", httpMethod: "POST", path: "/v1/customers/{0}/tax_ids", argPattern: "id,nestedParams" },
  retrieveTaxId: { kind: "stripe/retrieve_customer_tax_id", httpMethod: "GET", path: "/v1/customers/{0}/tax_ids/{1}", argPattern: "id,childId" },
  deleteTaxId: { kind: "stripe/delete_customer_tax_id", httpMethod: "DELETE", path: "/v1/customers/{0}/tax_ids/{1}", argPattern: "id,childId,del" },
  listTaxIds: { kind: "stripe/list_customer_tax_ids", httpMethod: "GET", path: "/v1/customers/{0}/tax_ids", argPattern: "id,nestedParams?" },
  // Sub-resources: discount
  deleteDiscount: { kind: "stripe/delete_customer_discount", httpMethod: "DELETE", path: "/v1/customers/{0}/discount", argPattern: "del" },
};

/** CustomerSessions: create */
export const customerSessions: ResourceDef = {
  create: { kind: "stripe/create_customer_session", httpMethod: "POST", path: "/v1/customer_sessions", argPattern: "params" },
};

export const customerResources = { customers, customerSessions };
