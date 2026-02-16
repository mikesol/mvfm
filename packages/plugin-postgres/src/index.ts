export type { PostgresConfig, PostgresMethods } from "./3.4.8";
export { postgres } from "./3.4.8";
export { wrapPostgresJs } from "./3.4.8/client-postgres-js";
export type { ClientHandlerOptions } from "./3.4.8/handler.client";
export { clientInterpreter } from "./3.4.8/handler.client";
export {
  createPostgresServerInterpreter,
  serverEvaluate,
  serverInterpreter,
} from "./3.4.8/handler.server";
export type { PostgresClient } from "./3.4.8/interpreter";
export {
  buildSQL,
  createPostgresInterpreter,
  escapeIdentifier,
  findCursorBatch,
} from "./3.4.8/interpreter";
