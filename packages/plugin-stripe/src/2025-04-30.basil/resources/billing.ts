import type { ResourceDef } from "../registry";

/** Subscriptions: create, retrieve, update, list, cancel, search, resume, deleteDiscount, migrate */
export const subscriptions: ResourceDef = {
  create: {
    kind: "stripe/create_subscription",
    httpMethod: "POST",
    path: "/v1/subscriptions",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_subscription",
    httpMethod: "GET",
    path: "/v1/subscriptions/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_subscription",
    httpMethod: "POST",
    path: "/v1/subscriptions/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_subscriptions",
    httpMethod: "GET",
    path: "/v1/subscriptions",
    argPattern: "params?",
  },
  cancel: {
    kind: "stripe/cancel_subscription",
    httpMethod: "DELETE",
    path: "/v1/subscriptions/{0}",
    argPattern: "del",
  },
  search: {
    kind: "stripe/search_subscriptions",
    httpMethod: "GET",
    path: "/v1/subscriptions/search",
    argPattern: "params",
  },
  resume: {
    kind: "stripe/resume_subscription",
    httpMethod: "POST",
    path: "/v1/subscriptions/{0}/resume",
    argPattern: "id,params?",
  },
  deleteDiscount: {
    kind: "stripe/delete_subscription_discount",
    httpMethod: "DELETE",
    path: "/v1/subscriptions/{0}/discount",
    argPattern: "del",
  },
};

/** SubscriptionItems: create, retrieve, update, del, list */
export const subscriptionItems: ResourceDef = {
  create: {
    kind: "stripe/create_subscription_item",
    httpMethod: "POST",
    path: "/v1/subscription_items",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_subscription_item",
    httpMethod: "GET",
    path: "/v1/subscription_items/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_subscription_item",
    httpMethod: "POST",
    path: "/v1/subscription_items/{0}",
    argPattern: "id,params",
  },
  del: {
    kind: "stripe/del_subscription_item",
    httpMethod: "DELETE",
    path: "/v1/subscription_items/{0}",
    argPattern: "del",
  },
  list: {
    kind: "stripe/list_subscription_items",
    httpMethod: "GET",
    path: "/v1/subscription_items",
    argPattern: "params?",
  },
};

/** SubscriptionSchedules: create, retrieve, update, list, cancel, release */
export const subscriptionSchedules: ResourceDef = {
  create: {
    kind: "stripe/create_subscription_schedule",
    httpMethod: "POST",
    path: "/v1/subscription_schedules",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_subscription_schedule",
    httpMethod: "GET",
    path: "/v1/subscription_schedules/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_subscription_schedule",
    httpMethod: "POST",
    path: "/v1/subscription_schedules/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_subscription_schedules",
    httpMethod: "GET",
    path: "/v1/subscription_schedules",
    argPattern: "params?",
  },
  cancel: {
    kind: "stripe/cancel_subscription_schedule",
    httpMethod: "POST",
    path: "/v1/subscription_schedules/{0}/cancel",
    argPattern: "id,params?",
  },
  release: {
    kind: "stripe/release_subscription_schedule",
    httpMethod: "POST",
    path: "/v1/subscription_schedules/{0}/release",
    argPattern: "id,params?",
  },
};

/** Plans: create, retrieve, update, del, list */
export const plans: ResourceDef = {
  create: {
    kind: "stripe/create_plan",
    httpMethod: "POST",
    path: "/v1/plans",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_plan",
    httpMethod: "GET",
    path: "/v1/plans/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_plan",
    httpMethod: "POST",
    path: "/v1/plans/{0}",
    argPattern: "id,params",
  },
  del: { kind: "stripe/del_plan", httpMethod: "DELETE", path: "/v1/plans/{0}", argPattern: "del" },
  list: { kind: "stripe/list_plans", httpMethod: "GET", path: "/v1/plans", argPattern: "params?" },
};

/** Prices: create, retrieve, update, list, search */
export const prices: ResourceDef = {
  create: {
    kind: "stripe/create_price",
    httpMethod: "POST",
    path: "/v1/prices",
    argPattern: "params",
  },
  retrieve: {
    kind: "stripe/retrieve_price",
    httpMethod: "GET",
    path: "/v1/prices/{0}",
    argPattern: "id",
  },
  update: {
    kind: "stripe/update_price",
    httpMethod: "POST",
    path: "/v1/prices/{0}",
    argPattern: "id,params",
  },
  list: {
    kind: "stripe/list_prices",
    httpMethod: "GET",
    path: "/v1/prices",
    argPattern: "params?",
  },
  search: {
    kind: "stripe/search_prices",
    httpMethod: "GET",
    path: "/v1/prices/search",
    argPattern: "params",
  },
};

export const billingResourcesA = {
  subscriptions,
  subscriptionItems,
  subscriptionSchedules,
  plans,
  prices,
};
