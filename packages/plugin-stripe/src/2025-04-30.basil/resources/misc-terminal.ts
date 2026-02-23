import type { ResourceDef } from "../registry";

/** Terminal Configurations: create, retrieve, update, del, list */
export const terminalConfigurations: ResourceDef = {
  create: {
    kind: "stripe/create_terminal_configuration",
    httpMethod: "POST",
    path: "/v1/terminal/configurations",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_terminal_configuration",
    httpMethod: "GET",
    path: "/v1/terminal/configurations/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_terminal_configuration",
    httpMethod: "POST",
    path: "/v1/terminal/configurations/{0}",
    argPattern: "id,params",
  },
  del: {
    kind: "stripe/del_terminal_configuration",
    httpMethod: "DELETE",
    path: "/v1/terminal/configurations/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_terminal_configurations",
    httpMethod: "GET",
    path: "/v1/terminal/configurations",
    argPattern: "params?",
  },
};

/** Terminal ConnectionTokens: create */
export const terminalConnectionTokens: ResourceDef = {
  create: {
    kind: "stripe/create_terminal_connection_token",
    httpMethod: "POST",
    path: "/v1/terminal/connection_tokens",
    argPattern: "params",
  },
};

/** Terminal Locations: create, retrieve, update, del, list */
export const terminalLocations: ResourceDef = {
  create: {
    kind: "stripe/create_terminal_location",
    httpMethod: "POST",
    path: "/v1/terminal/locations",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_terminal_location",
    httpMethod: "GET",
    path: "/v1/terminal/locations/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_terminal_location",
    httpMethod: "POST",
    path: "/v1/terminal/locations/{0}",
    argPattern: "id,params",
  },
  del: {
    kind: "stripe/del_terminal_location",
    httpMethod: "DELETE",
    path: "/v1/terminal/locations/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_terminal_locations",
    httpMethod: "GET",
    path: "/v1/terminal/locations",
    argPattern: "params?",
  },
};

/** Terminal Readers: create, retrieve, update, del, list */
export const terminalReaders: ResourceDef = {
  create: {
    kind: "stripe/create_terminal_reader",
    httpMethod: "POST",
    path: "/v1/terminal/readers",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_terminal_reader",
    httpMethod: "GET",
    path: "/v1/terminal/readers/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_terminal_reader",
    httpMethod: "POST",
    path: "/v1/terminal/readers/{0}",
    argPattern: "id,params",
  },
  del: {
    kind: "stripe/del_terminal_reader",
    httpMethod: "DELETE",
    path: "/v1/terminal/readers/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_terminal_readers",
    httpMethod: "GET",
    path: "/v1/terminal/readers",
    argPattern: "params?",
  },
};

/** Tax Calculations: create, retrieve, listLineItems */
export const taxCalculations: ResourceDef = {
  create: {
    kind: "stripe/create_tax_calculation",
    httpMethod: "POST",
    path: "/v1/tax/calculations",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_tax_calculation",
    httpMethod: "GET",
    path: "/v1/tax/calculations/{0}",
    argPattern: "id",
  },
  listLineItems: {
    kind: "stripe/list_tax_calculation_line_items",
    httpMethod: "GET",
    path: "/v1/tax/calculations/{0}/line_items",
    argPattern: "id,nestedParams?",
  },
};

/** Tax Registrations: create, retrieve, update, list */
export const taxRegistrations: ResourceDef = {
  create: {
    kind: "stripe/create_tax_registration",
    httpMethod: "POST",
    path: "/v1/tax/registrations",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_tax_registration",
    httpMethod: "GET",
    path: "/v1/tax/registrations/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_tax_registration",
    httpMethod: "POST",
    path: "/v1/tax/registrations/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_tax_registrations",
    httpMethod: "GET",
    path: "/v1/tax/registrations",
    argPattern: "params?",
  },
};

/** Tax Settings: retrieve (singleton), update (singleton) */
export const taxSettings: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_tax_settings",
    httpMethod: "GET",
    path: "/v1/tax/settings",
    argPattern: "",
  },
  update: {
    kind: "stripe/update_tax_settings",
    httpMethod: "POST",
    path: "/v1/tax/settings",
    argPattern: "singleton,params",
  },
};

/** Tax Transactions: retrieve, createFromCalculation, createReversal, listLineItems */
export const taxTransactions: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_tax_transaction",
    httpMethod: "GET",
    path: "/v1/tax/transactions/{0}",
    argPattern: "id",
  },
  createFromCalculation: {
    kind: "stripe/create_tax_transaction_from_calculation",
    httpMethod: "POST",
    path: "/v1/tax/transactions/create_from_calculation",
    argPattern: "params",
  },
  createReversal: {
    kind: "stripe/create_tax_transaction_reversal",
    httpMethod: "POST",
    path: "/v1/tax/transactions/create_reversal",
    argPattern: "params",
  },
  listLineItems: {
    kind: "stripe/list_tax_transaction_line_items",
    httpMethod: "GET",
    path: "/v1/tax/transactions/{0}/line_items",
    argPattern: "id,nestedParams?",
  },
};

/** Tax Associations: find */
export const taxAssociations: ResourceDef = {
  find: {
    kind: "stripe/find_tax_association",
    httpMethod: "GET",
    path: "/v1/tax/associations/find",
    argPattern: "params",
  },
};

export const miscResourcesC = {
  terminal: {
    configurations: terminalConfigurations,
    connectionTokens: terminalConnectionTokens,
    locations: terminalLocations,
    readers: terminalReaders,
  },
  tax: {
    calculations: taxCalculations,
    registrations: taxRegistrations,
    settings: taxSettings,
    transactions: taxTransactions,
    associations: taxAssociations,
  },
};
