import type { ResourceDef } from "../registry";

/** Invoices: create, retrieve, update, del, list, search, finalizeInvoice, pay, sendInvoice, voidInvoice, markUncollectible, addLines, removeLines, updateLines, updateLineItem, listLineItems, createPreview, attachPayment */
export const invoices: ResourceDef = {
  create: {
    kind: "stripe/create_invoice",
    httpMethod: "POST",
    path: "/v1/invoices",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_invoice",
    httpMethod: "GET",
    path: "/v1/invoices/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_invoice",
    httpMethod: "POST",
    path: "/v1/invoices/{0}",
    argPattern: "id,params",
  },
  del: {
    kind: "stripe/del_invoice",
    httpMethod: "DELETE",
    path: "/v1/invoices/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_invoices",
    httpMethod: "GET",
    path: "/v1/invoices",
    argPattern: "params?",
  },
  search: {
    kind: "stripe/search_invoices",
    httpMethod: "GET",
    path: "/v1/invoices/search",
    argPattern: "params",
  },
  finalizeInvoice: {
    kind: "stripe/finalize_invoice",
    httpMethod: "POST",
    path: "/v1/invoices/{0}/finalize",
    argPattern: "id,params?",
  },
  pay: {
    kind: "stripe/pay_invoice",
    httpMethod: "POST",
    path: "/v1/invoices/{0}/pay",
    argPattern: "id,params?",
  },
  sendInvoice: {
    kind: "stripe/send_invoice",
    httpMethod: "POST",
    path: "/v1/invoices/{0}/send",
    argPattern: "id,params?",
  },
  voidInvoice: {
    kind: "stripe/void_invoice",
    httpMethod: "POST",
    path: "/v1/invoices/{0}/void",
    argPattern: "id,params?",
  },
  markUncollectible: {
    kind: "stripe/mark_uncollectible_invoice",
    httpMethod: "POST",
    path: "/v1/invoices/{0}/mark_uncollectible",
    argPattern: "id,params?",
  },
  addLines: {
    kind: "stripe/add_lines_invoice",
    httpMethod: "POST",
    path: "/v1/invoices/{0}/add_lines",
    argPattern: "id,params",
  },
  removeLines: {
    kind: "stripe/remove_lines_invoice",
    httpMethod: "POST",
    path: "/v1/invoices/{0}/remove_lines",
    argPattern: "id,params",
  },
  updateLines: {
    kind: "stripe/update_lines_invoice",
    httpMethod: "POST",
    path: "/v1/invoices/{0}/update_lines",
    argPattern: "id,params",
  },
  updateLineItem: {
    kind: "stripe/update_invoice_line_item",
    httpMethod: "POST",
    path: "/v1/invoices/{0}/lines/{1}",
    argPattern: "id,childId,params",
  },
  listLineItems: {
    kind: "stripe/list_invoice_line_items",
    httpMethod: "GET",
    path: "/v1/invoices/{0}/lines",
    argPattern: "id,nestedParams?",
  },
  createPreview: {
    kind: "stripe/create_invoice_preview",
    httpMethod: "POST",
    path: "/v1/invoices/create_preview",
    argPattern: "params",
  },
  attachPayment: {
    kind: "stripe/attach_payment_invoice",
    httpMethod: "POST",
    path: "/v1/invoices/{0}/attach_payment",
    argPattern: "id,params",
  },
};

/** InvoiceItems: create, retrieve, update, del, list */
export const invoiceItems: ResourceDef = {
  create: {
    kind: "stripe/create_invoice_item",
    httpMethod: "POST",
    path: "/v1/invoiceitems",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_invoice_item",
    httpMethod: "GET",
    path: "/v1/invoiceitems/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_invoice_item",
    httpMethod: "POST",
    path: "/v1/invoiceitems/{0}",
    argPattern: "id,params",
  },
  del: {
    kind: "stripe/del_invoice_item",
    httpMethod: "DELETE",
    path: "/v1/invoiceitems/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_invoice_items",
    httpMethod: "GET",
    path: "/v1/invoiceitems",
    argPattern: "params?",
  },
};

/** InvoicePayments: retrieve, list */
export const invoicePayments: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_invoice_payment",
    httpMethod: "GET",
    path: "/v1/invoice_payments/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_invoice_payments",
    httpMethod: "GET",
    path: "/v1/invoice_payments",
    argPattern: "params?",
  },
};

/** InvoiceRenderingTemplates: retrieve, list, archive, unarchive */
export const invoiceRenderingTemplates: ResourceDef = {
  retrieve: {
    kind: "stripe/retrieve_invoice_rendering_template",
    httpMethod: "GET",
    path: "/v1/invoice_rendering_templates/{0}",
    argPattern: "id",
  },
  list: {
    kind: "stripe/list_invoice_rendering_templates",
    httpMethod: "GET",
    path: "/v1/invoice_rendering_templates",
    argPattern: "params?",
  },
  archive: {
    kind: "stripe/archive_invoice_rendering_template",
    httpMethod: "POST",
    path: "/v1/invoice_rendering_templates/{0}/archive",
    argPattern: "id,params?",
  },
  unarchive: {
    kind: "stripe/unarchive_invoice_rendering_template",
    httpMethod: "POST",
    path: "/v1/invoice_rendering_templates/{0}/unarchive",
    argPattern: "id,params?",
  },
};

export const billingInvoiceResources = {
  invoices,
  invoiceItems,
  invoicePayments,
  invoiceRenderingTemplates,
};
