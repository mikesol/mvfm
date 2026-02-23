import type { ResourceDef } from "../registry";

/** Reporting ReportRuns: create, retrieve, list */
export const reportingReportRuns: ResourceDef = {
  create: {
    kind: "stripe/create_reporting_report_run",
    httpMethod: "POST",
    path: "/v1/reporting/report_runs",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_reporting_report_run",
    httpMethod: "GET",
    path: "/v1/reporting/report_runs/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_reporting_report_runs",
    httpMethod: "GET",
    path: "/v1/reporting/report_runs",
    argPattern: "params?",
  },
};

/** Reporting ReportTypes: retrieve, list */
export const reportingReportTypes: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_reporting_report_type",
    httpMethod: "GET",
    path: "/v1/reporting/report_types/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_reporting_report_types",
    httpMethod: "GET",
    path: "/v1/reporting/report_types",
    argPattern: "params?",
  },
};

/** Sigma ScheduledQueryRuns: retrieve, list */
export const sigmaScheduledQueryRuns: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_sigma_scheduled_query_run",
    httpMethod: "GET",
    path: "/v1/sigma/scheduled_query_runs/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_sigma_scheduled_query_runs",
    httpMethod: "GET",
    path: "/v1/sigma/scheduled_query_runs",
    argPattern: "params?",
  },
};

/** Identity VerificationReports: retrieve, list */
export const identityVerificationReports: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_identity_verification_report",
    httpMethod: "GET",
    path: "/v1/identity/verification_reports/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_identity_verification_reports",
    httpMethod: "GET",
    path: "/v1/identity/verification_reports",
    argPattern: "params?",
  },
};

/** Identity VerificationSessions: create, retrieve, update, list, cancel, redact */
export const identityVerificationSessions: ResourceDef = {
  create: {
    kind: "stripe/create_identity_verification_session",
    httpMethod: "POST",
    path: "/v1/identity/verification_sessions",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_identity_verification_session",
    httpMethod: "GET",
    path: "/v1/identity/verification_sessions/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_identity_verification_session",
    httpMethod: "POST",
    path: "/v1/identity/verification_sessions/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_identity_verification_sessions",
    httpMethod: "GET",
    path: "/v1/identity/verification_sessions",
    argPattern: "params?",
  },
  cancel: {
    kind: "stripe/cancel_identity_verification_session",
    httpMethod: "POST",
    path: "/v1/identity/verification_sessions/{0}/cancel",
    argPattern: "id,params?",
  },
  redact: {
    kind: "stripe/redact_identity_verification_session",
    httpMethod: "POST",
    path: "/v1/identity/verification_sessions/{0}/redact",
    argPattern: "id,params?",
  },
};

export const miscResourcesD = {
  reporting: { reportRuns: reportingReportRuns, reportTypes: reportingReportTypes },
  sigma: { scheduledQueryRuns: sigmaScheduledQueryRuns },
  identity: {
    verificationReports: identityVerificationReports,
    verificationSessions: identityVerificationSessions,
  },
};
