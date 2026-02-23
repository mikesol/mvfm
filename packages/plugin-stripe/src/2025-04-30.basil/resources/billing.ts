import type { ResourceDef } from "../registry";

/** Subscriptions: create, retrieve, update, list, cancel, search, resume, deleteDiscount, migrate */
export const subscriptions: ResourceDef = {
  create: { kind: "stripe/create_subscription", httpMethod: "POST", path: "/v1/subscriptions", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_subscription", httpMethod: "GET", path: "/v1/subscriptions/{0}", argPattern: "id" },
  update: { kind: "stripe/update_subscription", httpMethod: "POST", path: "/v1/subscriptions/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_subscriptions", httpMethod: "GET", path: "/v1/subscriptions", argPattern: "params?" },
  cancel: { kind: "stripe/cancel_subscription", httpMethod: "DELETE", path: "/v1/subscriptions/{0}", argPattern: "del" },
  search: { kind: "stripe/search_subscriptions", httpMethod: "GET", path: "/v1/subscriptions/search", argPattern: "params" },
  resume: { kind: "stripe/resume_subscription", httpMethod: "POST", path: "/v1/subscriptions/{0}/resume", argPattern: "id,params?" },
  deleteDiscount: { kind: "stripe/delete_subscription_discount", httpMethod: "DELETE", path: "/v1/subscriptions/{0}/discount", argPattern: "del" },
};

/** SubscriptionItems: create, retrieve, update, del, list */
export const subscriptionItems: ResourceDef = {
  create: { kind: "stripe/create_subscription_item", httpMethod: "POST", path: "/v1/subscription_items", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_subscription_item", httpMethod: "GET", path: "/v1/subscription_items/{0}", argPattern: "id" },
  update: { kind: "stripe/update_subscription_item", httpMethod: "POST", path: "/v1/subscription_items/{0}", argPattern: "id,params" },
  del: { kind: "stripe/del_subscription_item", httpMethod: "DELETE", path: "/v1/subscription_items/{0}", argPattern: "del" },
  list: { kind: "stripe/list_subscription_items", httpMethod: "GET", path: "/v1/subscription_items", argPattern: "params?" },
};

/** SubscriptionSchedules: create, retrieve, update, list, cancel, release */
export const subscriptionSchedules: ResourceDef = {
  create: { kind: "stripe/create_subscription_schedule", httpMethod: "POST", path: "/v1/subscription_schedules", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_subscription_schedule", httpMethod: "GET", path: "/v1/subscription_schedules/{0}", argPattern: "id" },
  update: { kind: "stripe/update_subscription_schedule", httpMethod: "POST", path: "/v1/subscription_schedules/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_subscription_schedules", httpMethod: "GET", path: "/v1/subscription_schedules", argPattern: "params?" },
  cancel: { kind: "stripe/cancel_subscription_schedule", httpMethod: "POST", path: "/v1/subscription_schedules/{0}/cancel", argPattern: "id,params?" },
  release: { kind: "stripe/release_subscription_schedule", httpMethod: "POST", path: "/v1/subscription_schedules/{0}/release", argPattern: "id,params?" },
};

/** Invoices: create, retrieve, update, del, list, search, finalizeInvoice, pay, sendInvoice, voidInvoice, markUncollectible, addLines, removeLines, updateLines, updateLineItem, listLineItems, createPreview, attachPayment */
export const invoices: ResourceDef = {
  create: { kind: "stripe/create_invoice", httpMethod: "POST", path: "/v1/invoices", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_invoice", httpMethod: "GET", path: "/v1/invoices/{0}", argPattern: "id" },
  update: { kind: "stripe/update_invoice", httpMethod: "POST", path: "/v1/invoices/{0}", argPattern: "id,params" },
  del: { kind: "stripe/del_invoice", httpMethod: "DELETE", path: "/v1/invoices/{0}", argPattern: "del" },
  list: { kind: "stripe/list_invoices", httpMethod: "GET", path: "/v1/invoices", argPattern: "params?" },
  search: { kind: "stripe/search_invoices", httpMethod: "GET", path: "/v1/invoices/search", argPattern: "params" },
  finalizeInvoice: { kind: "stripe/finalize_invoice", httpMethod: "POST", path: "/v1/invoices/{0}/finalize", argPattern: "id,params?" },
  pay: { kind: "stripe/pay_invoice", httpMethod: "POST", path: "/v1/invoices/{0}/pay", argPattern: "id,params?" },
  sendInvoice: { kind: "stripe/send_invoice", httpMethod: "POST", path: "/v1/invoices/{0}/send", argPattern: "id,params?" },
  voidInvoice: { kind: "stripe/void_invoice", httpMethod: "POST", path: "/v1/invoices/{0}/void", argPattern: "id,params?" },
  markUncollectible: { kind: "stripe/mark_uncollectible_invoice", httpMethod: "POST", path: "/v1/invoices/{0}/mark_uncollectible", argPattern: "id,params?" },
  addLines: { kind: "stripe/add_lines_invoice", httpMethod: "POST", path: "/v1/invoices/{0}/add_lines", argPattern: "id,params" },
  removeLines: { kind: "stripe/remove_lines_invoice", httpMethod: "POST", path: "/v1/invoices/{0}/remove_lines", argPattern: "id,params" },
  updateLines: { kind: "stripe/update_lines_invoice", httpMethod: "POST", path: "/v1/invoices/{0}/update_lines", argPattern: "id,params" },
  updateLineItem: { kind: "stripe/update_invoice_line_item", httpMethod: "POST", path: "/v1/invoices/{0}/lines/{1}", argPattern: "id,childId,params" },
  listLineItems: { kind: "stripe/list_invoice_line_items", httpMethod: "GET", path: "/v1/invoices/{0}/lines", argPattern: "id,nestedParams?" },
  createPreview: { kind: "stripe/create_invoice_preview", httpMethod: "POST", path: "/v1/invoices/create_preview", argPattern: "params" },
  attachPayment: { kind: "stripe/attach_payment_invoice", httpMethod: "POST", path: "/v1/invoices/{0}/attach_payment", argPattern: "id,params" },
};

/** InvoiceItems: create, retrieve, update, del, list */
export const invoiceItems: ResourceDef = {
  create: { kind: "stripe/create_invoice_item", httpMethod: "POST", path: "/v1/invoiceitems", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_invoice_item", httpMethod: "GET", path: "/v1/invoiceitems/{0}", argPattern: "id" },
  update: { kind: "stripe/update_invoice_item", httpMethod: "POST", path: "/v1/invoiceitems/{0}", argPattern: "id,params" },
  del: { kind: "stripe/del_invoice_item", httpMethod: "DELETE", path: "/v1/invoiceitems/{0}", argPattern: "del" },
  list: { kind: "stripe/list_invoice_items", httpMethod: "GET", path: "/v1/invoiceitems", argPattern: "params?" },
};

/** InvoicePayments: retrieve, list */
export const invoicePayments: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_invoice_payment", httpMethod: "GET", path: "/v1/invoice_payments/{0}", argPattern: "id" },
  list: { kind: "stripe/list_invoice_payments", httpMethod: "GET", path: "/v1/invoice_payments", argPattern: "params?" },
};

/** InvoiceRenderingTemplates: retrieve, list, archive, unarchive */
export const invoiceRenderingTemplates: ResourceDef = {
  retrieve: { kind: "stripe/retrieve_invoice_rendering_template", httpMethod: "GET", path: "/v1/invoice_rendering_templates/{0}", argPattern: "id" },
  list: { kind: "stripe/list_invoice_rendering_templates", httpMethod: "GET", path: "/v1/invoice_rendering_templates", argPattern: "params?" },
  archive: { kind: "stripe/archive_invoice_rendering_template", httpMethod: "POST", path: "/v1/invoice_rendering_templates/{0}/archive", argPattern: "id,params?" },
  unarchive: { kind: "stripe/unarchive_invoice_rendering_template", httpMethod: "POST", path: "/v1/invoice_rendering_templates/{0}/unarchive", argPattern: "id,params?" },
};

/** Plans: create, retrieve, update, del, list */
export const plans: ResourceDef = {
  create: { kind: "stripe/create_plan", httpMethod: "POST", path: "/v1/plans", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_plan", httpMethod: "GET", path: "/v1/plans/{0}", argPattern: "id" },
  update: { kind: "stripe/update_plan", httpMethod: "POST", path: "/v1/plans/{0}", argPattern: "id,params" },
  del: { kind: "stripe/del_plan", httpMethod: "DELETE", path: "/v1/plans/{0}", argPattern: "del" },
  list: { kind: "stripe/list_plans", httpMethod: "GET", path: "/v1/plans", argPattern: "params?" },
};

/** Prices: create, retrieve, update, list, search */
export const prices: ResourceDef = {
  create: { kind: "stripe/create_price", httpMethod: "POST", path: "/v1/prices", argPattern: "params" },
  retrieve: { kind: "stripe/retrieve_price", httpMethod: "GET", path: "/v1/prices/{0}", argPattern: "id" },
  update: { kind: "stripe/update_price", httpMethod: "POST", path: "/v1/prices/{0}", argPattern: "id,params" },
  list: { kind: "stripe/list_prices", httpMethod: "GET", path: "/v1/prices", argPattern: "params?" },
  search: { kind: "stripe/search_prices", httpMethod: "GET", path: "/v1/prices/search", argPattern: "params" },
};

export const billingResourcesA = {
  subscriptions, subscriptionItems, subscriptionSchedules,
  invoices, invoiceItems, invoicePayments, invoiceRenderingTemplates,
  plans, prices,
};
