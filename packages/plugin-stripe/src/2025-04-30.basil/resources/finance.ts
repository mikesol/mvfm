import type { ResourceDef } from "../registry";

// ---- Issuing ----

/** Issuing Authorizations: retrieve, update, list, approve, decline */
export const issuingAuthorizations: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_issuing_authorization", httpMethod: "GET", path: "/v1/issuing/authorizations/{0}", argPattern: "id" },
  update: { kind: "stripe/update_issuing_authorization", httpMethod: "POST", path: "/v1/issuing/authorizations/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_issuing_authorizations", httpMethod: "GET", path: "/v1/issuing/authorizations", argPattern: "params?" },
  approve: { kind: "stripe/approve_issuing_authorization", httpMethod: "POST", path: "/v1/issuing/authorizations/{0}/approve", argPattern: "id,params?" },
  decline: { kind: "stripe/decline_issuing_authorization", httpMethod: "POST", path: "/v1/issuing/authorizations/{0}/decline", argPattern: "id,params?" },
};

/** Issuing Cardholders: create, retrieve, update, list */
export const issuingCardholders: ResourceDef = {
  create: { kind: "stripe/create_issuing_cardholder", httpMethod: "POST", path: "/v1/issuing/cardholders", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_issuing_cardholder", httpMethod: "GET", path: "/v1/issuing/cardholders/{0}", argPattern: "id" },
  update: { kind: "stripe/update_issuing_cardholder", httpMethod: "POST", path: "/v1/issuing/cardholders/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_issuing_cardholders", httpMethod: "GET", path: "/v1/issuing/cardholders", argPattern: "params?" },
};

/** Issuing Cards: create, retrieve, update, list */
export const issuingCards: ResourceDef = {
  create: { kind: "stripe/create_issuing_card", httpMethod: "POST", path: "/v1/issuing/cards", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_issuing_card", httpMethod: "GET", path: "/v1/issuing/cards/{0}", argPattern: "id" },
  update: { kind: "stripe/update_issuing_card", httpMethod: "POST", path: "/v1/issuing/cards/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_issuing_cards", httpMethod: "GET", path: "/v1/issuing/cards", argPattern: "params?" },
};

/** Issuing Disputes: create, retrieve, update, list, submit */
export const issuingDisputes: ResourceDef = {
  create: { kind: "stripe/create_issuing_dispute", httpMethod: "POST", path: "/v1/issuing/disputes", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_issuing_dispute", httpMethod: "GET", path: "/v1/issuing/disputes/{0}", argPattern: "id" },
  update: { kind: "stripe/update_issuing_dispute", httpMethod: "POST", path: "/v1/issuing/disputes/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_issuing_disputes", httpMethod: "GET", path: "/v1/issuing/disputes", argPattern: "params?" },
  submit: { kind: "stripe/submit_issuing_dispute", httpMethod: "POST", path: "/v1/issuing/disputes/{0}/submit", argPattern: "id,params?" },
};

/** Issuing PersonalizationDesigns: create, retrieve, update, list */
export const issuingPersonalizationDesigns: ResourceDef = {
  create: { kind: "stripe/create_issuing_personalization_design", httpMethod: "POST", path: "/v1/issuing/personalization_designs", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_issuing_personalization_design", httpMethod: "GET", path: "/v1/issuing/personalization_designs/{0}", argPattern: "id" },
  update: { kind: "stripe/update_issuing_personalization_design", httpMethod: "POST", path: "/v1/issuing/personalization_designs/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_issuing_personalization_designs", httpMethod: "GET", path: "/v1/issuing/personalization_designs", argPattern: "params?" },
};

/** Issuing PhysicalBundles: retrieve, list */
export const issuingPhysicalBundles: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_issuing_physical_bundle", httpMethod: "GET", path: "/v1/issuing/physical_bundles/{0}", argPattern: "id" },
  list: { kind: "stripe/list_issuing_physical_bundles", httpMethod: "GET", path: "/v1/issuing/physical_bundles", argPattern: "params?" },
};

/** Issuing Tokens: retrieve, update, list */
export const issuingTokens: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_issuing_token", httpMethod: "GET", path: "/v1/issuing/tokens/{0}", argPattern: "id" },
  update: { kind: "stripe/update_issuing_token", httpMethod: "POST", path: "/v1/issuing/tokens/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_issuing_tokens", httpMethod: "GET", path: "/v1/issuing/tokens", argPattern: "params?" },
};

/** Issuing Transactions: retrieve, update, list */
export const issuingTransactions: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_issuing_transaction", httpMethod: "GET", path: "/v1/issuing/transactions/{0}", argPattern: "id" },
  update: { kind: "stripe/update_issuing_transaction", httpMethod: "POST", path: "/v1/issuing/transactions/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_issuing_transactions", httpMethod: "GET", path: "/v1/issuing/transactions", argPattern: "params?" },
};

// ---- Treasury ----

/** Treasury CreditReversals: create, retrieve, list */
export const treasuryCreditReversals: ResourceDef = {
  create: { kind: "stripe/create_treasury_credit_reversal", httpMethod: "POST", path: "/v1/treasury/credit_reversals", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_treasury_credit_reversal", httpMethod: "GET", path: "/v1/treasury/credit_reversals/{0}", argPattern: "id" },
  list: { kind: "stripe/list_treasury_credit_reversals", httpMethod: "GET", path: "/v1/treasury/credit_reversals", argPattern: "params?" },
};

/** Treasury DebitReversals: create, retrieve, list */
export const treasuryDebitReversals: ResourceDef = {
  create: { kind: "stripe/create_treasury_debit_reversal", httpMethod: "POST", path: "/v1/treasury/debit_reversals", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_treasury_debit_reversal", httpMethod: "GET", path: "/v1/treasury/debit_reversals/{0}", argPattern: "id" },
  list: { kind: "stripe/list_treasury_debit_reversals", httpMethod: "GET", path: "/v1/treasury/debit_reversals", argPattern: "params?" },
};

/** Treasury FinancialAccounts: create, retrieve, update, list, close, retrieveFeatures, updateFeatures */
export const treasuryFinancialAccounts: ResourceDef = {
  create: { kind: "stripe/create_treasury_financial_account", httpMethod: "POST", path: "/v1/treasury/financial_accounts", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_treasury_financial_account", httpMethod: "GET", path: "/v1/treasury/financial_accounts/{0}", argPattern: "id" },
  update: { kind: "stripe/update_treasury_financial_account", httpMethod: "POST", path: "/v1/treasury/financial_accounts/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_treasury_financial_accounts", httpMethod: "GET", path: "/v1/treasury/financial_accounts", argPattern: "params?" },
  close: { kind: "stripe/close_treasury_financial_account", httpMethod: "POST", path: "/v1/treasury/financial_accounts/{0}/close", argPattern: "id,params?" },
  retrieveFeatures: { kind: "stripe/retrieve_treasury_financial_account_features", httpMethod: "GET", path: "/v1/treasury/financial_accounts/{0}/features", argPattern: "id" },
  updateFeatures: { kind: "stripe/update_treasury_financial_account_features", httpMethod: "POST", path: "/v1/treasury/financial_accounts/{0}/features", argPattern: "id,params" },
};

/** Treasury InboundTransfers: create, retrieve, list, cancel */
export const treasuryInboundTransfers: ResourceDef = {
  create: { kind: "stripe/create_treasury_inbound_transfer", httpMethod: "POST", path: "/v1/treasury/inbound_transfers", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_treasury_inbound_transfer", httpMethod: "GET", path: "/v1/treasury/inbound_transfers/{0}", argPattern: "id" },
  list: { kind: "stripe/list_treasury_inbound_transfers", httpMethod: "GET", path: "/v1/treasury/inbound_transfers", argPattern: "params?" },
  cancel: { kind: "stripe/cancel_treasury_inbound_transfer", httpMethod: "POST", path: "/v1/treasury/inbound_transfers/{0}/cancel", argPattern: "id,params?" },
};

/** Treasury OutboundPayments: create, retrieve, list, cancel */
export const treasuryOutboundPayments: ResourceDef = {
  create: { kind: "stripe/create_treasury_outbound_payment", httpMethod: "POST", path: "/v1/treasury/outbound_payments", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_treasury_outbound_payment", httpMethod: "GET", path: "/v1/treasury/outbound_payments/{0}", argPattern: "id" },
  list: { kind: "stripe/list_treasury_outbound_payments", httpMethod: "GET", path: "/v1/treasury/outbound_payments", argPattern: "params?" },
  cancel: { kind: "stripe/cancel_treasury_outbound_payment", httpMethod: "POST", path: "/v1/treasury/outbound_payments/{0}/cancel", argPattern: "id,params?" },
};

/** Treasury OutboundTransfers: create, retrieve, list, cancel */
export const treasuryOutboundTransfers: ResourceDef = {
  create: { kind: "stripe/create_treasury_outbound_transfer", httpMethod: "POST", path: "/v1/treasury/outbound_transfers", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_treasury_outbound_transfer", httpMethod: "GET", path: "/v1/treasury/outbound_transfers/{0}", argPattern: "id" },
  list: { kind: "stripe/list_treasury_outbound_transfers", httpMethod: "GET", path: "/v1/treasury/outbound_transfers", argPattern: "params?" },
  cancel: { kind: "stripe/cancel_treasury_outbound_transfer", httpMethod: "POST", path: "/v1/treasury/outbound_transfers/{0}/cancel", argPattern: "id,params?" },
};

/** Treasury ReceivedCredits: retrieve, list */
export const treasuryReceivedCredits: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_treasury_received_credit", httpMethod: "GET", path: "/v1/treasury/received_credits/{0}", argPattern: "id" },
  list: { kind: "stripe/list_treasury_received_credits", httpMethod: "GET", path: "/v1/treasury/received_credits", argPattern: "params?" },
};

/** Treasury ReceivedDebits: retrieve, list */
export const treasuryReceivedDebits: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_treasury_received_debit", httpMethod: "GET", path: "/v1/treasury/received_debits/{0}", argPattern: "id" },
  list: { kind: "stripe/list_treasury_received_debits", httpMethod: "GET", path: "/v1/treasury/received_debits", argPattern: "params?" },
};

/** Treasury TransactionEntries: retrieve, list */
export const treasuryTransactionEntries: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_treasury_transaction_entry", httpMethod: "GET", path: "/v1/treasury/transaction_entries/{0}", argPattern: "id" },
  list: { kind: "stripe/list_treasury_transaction_entries", httpMethod: "GET", path: "/v1/treasury/transaction_entries", argPattern: "params?" },
};

/** Treasury Transactions: retrieve, list */
export const treasuryTransactions: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_treasury_transaction", httpMethod: "GET", path: "/v1/treasury/transactions/{0}", argPattern: "id" },
  list: { kind: "stripe/list_treasury_transactions", httpMethod: "GET", path: "/v1/treasury/transactions", argPattern: "params?" },
};

export const financeResources = {
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
