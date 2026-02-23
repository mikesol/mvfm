import type { ResourceDef } from "../registry";

// ---- Treasury ----

/** Treasury CreditReversals: create, retrieve, list */
export const treasuryCreditReversals: ResourceDef = {
  create: {
    kind: "stripe/create_treasury_credit_reversal",
    httpMethod: "POST",
    path: "/v1/treasury/credit_reversals",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_treasury_credit_reversal",
    httpMethod: "GET",
    path: "/v1/treasury/credit_reversals/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_treasury_credit_reversals",
    httpMethod: "GET",
    path: "/v1/treasury/credit_reversals",
    argPattern: "params?",
  },
};

/** Treasury DebitReversals: create, retrieve, list */
export const treasuryDebitReversals: ResourceDef = {
  create: {
    kind: "stripe/create_treasury_debit_reversal",
    httpMethod: "POST",
    path: "/v1/treasury/debit_reversals",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_treasury_debit_reversal",
    httpMethod: "GET",
    path: "/v1/treasury/debit_reversals/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_treasury_debit_reversals",
    httpMethod: "GET",
    path: "/v1/treasury/debit_reversals",
    argPattern: "params?",
  },
};

/** Treasury FinancialAccounts: create, retrieve, update, list, close, retrieveFeatures, updateFeatures */
export const treasuryFinancialAccounts: ResourceDef = {
  create: {
    kind: "stripe/create_treasury_financial_account",
    httpMethod: "POST",
    path: "/v1/treasury/financial_accounts",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_treasury_financial_account",
    httpMethod: "GET",
    path: "/v1/treasury/financial_accounts/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_treasury_financial_account",
    httpMethod: "POST",
    path: "/v1/treasury/financial_accounts/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_treasury_financial_accounts",
    httpMethod: "GET",
    path: "/v1/treasury/financial_accounts",
    argPattern: "params?",
  },
  close: {
    kind: "stripe/close_treasury_financial_account",
    httpMethod: "POST",
    path: "/v1/treasury/financial_accounts/{0}/close",
    argPattern: "id,params?",
  },
  retrieveFeatures: {
    kind: "stripe/retrieve_treasury_financial_account_features",
    httpMethod: "GET",
    path: "/v1/treasury/financial_accounts/{0}/features",
    argPattern: "id",
  },
  updateFeatures: {
    kind: "stripe/update_treasury_financial_account_features",
    httpMethod: "POST",
    path: "/v1/treasury/financial_accounts/{0}/features",
    argPattern: "id,params",
  },
};

/** Treasury InboundTransfers: create, retrieve, list, cancel */
export const treasuryInboundTransfers: ResourceDef = {
  create: {
    kind: "stripe/create_treasury_inbound_transfer",
    httpMethod: "POST",
    path: "/v1/treasury/inbound_transfers",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_treasury_inbound_transfer",
    httpMethod: "GET",
    path: "/v1/treasury/inbound_transfers/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_treasury_inbound_transfers",
    httpMethod: "GET",
    path: "/v1/treasury/inbound_transfers",
    argPattern: "params?",
  },
  cancel: {
    kind: "stripe/cancel_treasury_inbound_transfer",
    httpMethod: "POST",
    path: "/v1/treasury/inbound_transfers/{0}/cancel",
    argPattern: "id,params?",
  },
};

/** Treasury OutboundPayments: create, retrieve, list, cancel */
export const treasuryOutboundPayments: ResourceDef = {
  create: {
    kind: "stripe/create_treasury_outbound_payment",
    httpMethod: "POST",
    path: "/v1/treasury/outbound_payments",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_treasury_outbound_payment",
    httpMethod: "GET",
    path: "/v1/treasury/outbound_payments/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_treasury_outbound_payments",
    httpMethod: "GET",
    path: "/v1/treasury/outbound_payments",
    argPattern: "params?",
  },
  cancel: {
    kind: "stripe/cancel_treasury_outbound_payment",
    httpMethod: "POST",
    path: "/v1/treasury/outbound_payments/{0}/cancel",
    argPattern: "id,params?",
  },
};

/** Treasury OutboundTransfers: create, retrieve, list, cancel */
export const treasuryOutboundTransfers: ResourceDef = {
  create: {
    kind: "stripe/create_treasury_outbound_transfer",
    httpMethod: "POST",
    path: "/v1/treasury/outbound_transfers",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_treasury_outbound_transfer",
    httpMethod: "GET",
    path: "/v1/treasury/outbound_transfers/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_treasury_outbound_transfers",
    httpMethod: "GET",
    path: "/v1/treasury/outbound_transfers",
    argPattern: "params?",
  },
  cancel: {
    kind: "stripe/cancel_treasury_outbound_transfer",
    httpMethod: "POST",
    path: "/v1/treasury/outbound_transfers/{0}/cancel",
    argPattern: "id,params?",
  },
};

/** Treasury ReceivedCredits: retrieve, list */
export const treasuryReceivedCredits: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_treasury_received_credit",
    httpMethod: "GET",
    path: "/v1/treasury/received_credits/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_treasury_received_credits",
    httpMethod: "GET",
    path: "/v1/treasury/received_credits",
    argPattern: "params?",
  },
};

/** Treasury ReceivedDebits: retrieve, list */
export const treasuryReceivedDebits: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_treasury_received_debit",
    httpMethod: "GET",
    path: "/v1/treasury/received_debits/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_treasury_received_debits",
    httpMethod: "GET",
    path: "/v1/treasury/received_debits",
    argPattern: "params?",
  },
};

/** Treasury TransactionEntries: retrieve, list */
export const treasuryTransactionEntries: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_treasury_transaction_entry",
    httpMethod: "GET",
    path: "/v1/treasury/transaction_entries/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_treasury_transaction_entries",
    httpMethod: "GET",
    path: "/v1/treasury/transaction_entries",
    argPattern: "params?",
  },
};

/** Treasury Transactions: retrieve, list */
export const treasuryTransactions: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_treasury_transaction",
    httpMethod: "GET",
    path: "/v1/treasury/transactions/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_treasury_transactions",
    httpMethod: "GET",
    path: "/v1/treasury/transactions",
    argPattern: "params?",
  },
};

export const financeTreasuryResources = {
  treasury: {
    creditReversals: treasuryCreditReversals,
    debitReversals: treasuryDebitReversals,
    financialAccounts: treasuryFinancialAccounts,
    inboundTransfers: treasuryInboundTransfers,
    outboundPayments: treasuryOutboundPayments,
    outboundTransfers: treasuryOutboundTransfers,
    receivedCredits: treasuryReceivedCredits,
    receivedDebits: treasuryReceivedDebits,
    transactionEntries: treasuryTransactionEntries,
    transactions: treasuryTransactions,
  },
};
