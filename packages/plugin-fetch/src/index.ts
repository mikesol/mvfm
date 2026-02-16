export type { FetchConfig, FetchMethods, FetchRequestInit } from "./whatwg";
export { fetch } from "./whatwg";
export { wrapFetch } from "./whatwg/client-fetch";
export type { ClientHandlerOptions } from "./whatwg/handler.client";
export { clientInterpreter } from "./whatwg/handler.client";
export { serverEvaluate, serverInterpreter } from "./whatwg/handler.server";
export type { FetchClient } from "./whatwg/interpreter";
export { createFetchInterpreter, fetchInterpreter } from "./whatwg/interpreter";
