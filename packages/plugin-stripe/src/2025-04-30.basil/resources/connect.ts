import type { ResourceDef } from "../registry";

/** Accounts: create, retrieve, retrieveCurrent, update, del, list, reject + nested sub-resources */
export const accounts: ResourceDef = {
  create: {
    kind: "stripe/create_account",
    httpMethod: "POST",
    path: "/v1/accounts",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_account",
    httpMethod: "GET",
    path: "/v1/accounts/{0}",
    argPattern: "id",
  },
  retrieveCurrent: {
    kind: "stripe/retrieve_current_account",
    httpMethod: "GET",
    path: "/v1/account",
    argPattern: "",
  },
  update: {
    kind: "stripe/update_account",
    httpMethod: "POST",
    path: "/v1/accounts/{0}",
    argPattern: "id,params",
  },
  del: {
    kind: "stripe/del_account",
    httpMethod: "DELETE",
    path: "/v1/accounts/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_accounts",
    httpMethod: "GET",
    path: "/v1/accounts",
    argPattern: "params?",
  },
  reject: {
    kind: "stripe/reject_account",
    httpMethod: "POST",
    path: "/v1/accounts/{0}/reject",
    argPattern: "id,params",
  },
  // External accounts
  createExternalAccount: {
    kind: "stripe/create_account_external_account",
    httpMethod: "POST",
    path: "/v1/accounts/{0}/external_accounts",
    argPattern: "id,nestedParams",
  },
  retrieveExternalAccount: {
    kind: "stripe/retrieve_account_external_account",
    httpMethod: "GET",
    path: "/v1/accounts/{0}/external_accounts/{1}",
    argPattern: "id,childId",
  },
  updateExternalAccount: {
    kind: "stripe/update_account_external_account",
    httpMethod: "POST",
    path: "/v1/accounts/{0}/external_accounts/{1}",
    argPattern: "id,childId,params",
  },
  deleteExternalAccount: {
    kind: "stripe/delete_account_external_account",
    httpMethod: "DELETE",
    path: "/v1/accounts/{0}/external_accounts/{1}",
    argPattern: "id,childId,del",
  },
  listExternalAccounts: {
    kind: "stripe/list_account_external_accounts",
    httpMethod: "GET",
    path: "/v1/accounts/{0}/external_accounts",
    argPattern: "id,nestedParams?",
  },
  // Persons
  createPerson: {
    kind: "stripe/create_account_person",
    httpMethod: "POST",
    path: "/v1/accounts/{0}/persons",
    argPattern: "id,nestedParams",
  },
  retrievePerson: {
    kind: "stripe/retrieve_account_person",
    httpMethod: "GET",
    path: "/v1/accounts/{0}/persons/{1}",
    argPattern: "id,childId",
  },
  updatePerson: {
    kind: "stripe/update_account_person",
    httpMethod: "POST",
    path: "/v1/accounts/{0}/persons/{1}",
    argPattern: "id,childId,params",
  },
  deletePerson: {
    kind: "stripe/delete_account_person",
    httpMethod: "DELETE",
    path: "/v1/accounts/{0}/persons/{1}",
    argPattern: "id,childId,del",
  },
  listPersons: {
    kind: "stripe/list_account_persons",
    httpMethod: "GET",
    path: "/v1/accounts/{0}/persons",
    argPattern: "id,nestedParams?",
  },
  // Capabilities
  retrieveCapability: {
    kind: "stripe/retrieve_account_capability",
    httpMethod: "GET",
    path: "/v1/accounts/{0}/capabilities/{1}",
    argPattern: "id,childId",
  },
  updateCapability: {
    kind: "stripe/update_account_capability",
    httpMethod: "POST",
    path: "/v1/accounts/{0}/capabilities/{1}",
    argPattern: "id,childId,params",
  },
  listCapabilities: {
    kind: "stripe/list_account_capabilities",
    httpMethod: "GET",
    path: "/v1/accounts/{0}/capabilities",
    argPattern: "id,nestedParams?",
  },
  // Login links
  createLoginLink: {
    kind: "stripe/create_account_login_link",
    httpMethod: "POST",
    path: "/v1/accounts/{0}/login_links",
    argPattern: "id,nestedParams",
  },
};

/** AccountLinks: create */
export const accountLinks: ResourceDef = {
  create: {
    kind: "stripe/create_account_link",
    httpMethod: "POST",
    path: "/v1/account_links",
    argPattern: "params",
  },
};

/** AccountSessions: create */
export const accountSessions: ResourceDef = {
  create: {
    kind: "stripe/create_account_session",
    httpMethod: "POST",
    path: "/v1/account_sessions",
    argPattern: "params",
  },
};

export const connectResourcesA = {
  accounts,
  accountLinks,
  accountSessions,
};
