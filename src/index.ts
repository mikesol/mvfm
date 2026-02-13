// Public API

export type {
  ASTNode,
  Expr,
  GeneratorInterpreterFragment,
  Interpreter,
  InterpreterFragment,
  LegacyInterpreterFragment,
  MissingTraitError,
  Plugin,
  PluginContext,
  PluginDefinition,
  Program,
  RecurseFn,
  Step,
  StepContext,
  StepEffect,
  StepHandler,
  TraitImpl,
  TypeclassMapping,
  TypeclassSlot,
} from "./core";
// Note: GeneratorInterpreterFragment is kept as an export for backward
// compatibility — it is now a type alias for InterpreterFragment.
export { adaptLegacy, composeInterpreters, foldAST, ilo, runAST, Stepper } from "./core";
export { coreInterpreter } from "./interpreters/core";
export type { BooleanMethods } from "./plugins/boolean";
export { boolean } from "./plugins/boolean";
export { booleanInterpreter } from "./plugins/boolean/interpreter";
export type { BoundedFor } from "./plugins/bounded";
export { bounded } from "./plugins/bounded";
export type { ControlMethods } from "./plugins/control";
export { control } from "./plugins/control";
export type { EqFor } from "./plugins/eq";
export { eq } from "./plugins/eq";
export { eqInterpreter } from "./plugins/eq/interpreter";
export type { ErrorMethods } from "./plugins/error";
export { error } from "./plugins/error";
export { errorInterpreter } from "./plugins/error/interpreter";
export type { FiberMethods } from "./plugins/fiber";
export { fiber } from "./plugins/fiber";
export { fiberInterpreter } from "./plugins/fiber/interpreter";
export type { HeytingAlgebraFor } from "./plugins/heyting-algebra";
export { heytingAlgebra } from "./plugins/heyting-algebra";
export type { MonoidFor } from "./plugins/monoid";
export { monoid } from "./plugins/monoid";
export type { NumMethods } from "./plugins/num";
export { num } from "./plugins/num";
export { numInterpreter } from "./plugins/num/interpreter";
export type { OrdFor } from "./plugins/ord";
export { ord } from "./plugins/ord";
export { ordInterpreter } from "./plugins/ord/interpreter";
export type { PostgresConfig, PostgresMethods } from "./plugins/postgres/3.4.8";
export { postgres } from "./plugins/postgres/3.4.8";
export { wrapPostgresJs } from "./plugins/postgres/3.4.8/client-postgres-js";
export type {
  ClientHandlerOptions,
  ClientHandlerState,
} from "./plugins/postgres/3.4.8/handler.client";
export { clientHandler } from "./plugins/postgres/3.4.8/handler.client";
export { serverEvaluate, serverHandler } from "./plugins/postgres/3.4.8/handler.server";
export type { PostgresClient } from "./plugins/postgres/3.4.8/interpreter";
export {
  escapeIdentifier,
  findCursorBatch,
  postgresInterpreter,
} from "./plugins/postgres/3.4.8/interpreter";
export type { SemigroupFor } from "./plugins/semigroup";
export { semigroup } from "./plugins/semigroup";
export type { SemiringFor } from "./plugins/semiring";
export { semiring } from "./plugins/semiring";
export type { ShowFor } from "./plugins/show";
export { show } from "./plugins/show";
export type { StMethods } from "./plugins/st";
export { st } from "./plugins/st";
export type { StrMethods } from "./plugins/str";
export { str } from "./plugins/str";
export { strInterpreter } from "./plugins/str/interpreter";
export type { StripeConfig, StripeMethods } from "./plugins/stripe/2025-04-30.basil";
export { stripe } from "./plugins/stripe/2025-04-30.basil";
export { wrapStripeSdk } from "./plugins/stripe/2025-04-30.basil/client-stripe-sdk";
export type {
  ClientHandlerOptions as StripeClientHandlerOptions,
  ClientHandlerState as StripeClientHandlerState,
} from "./plugins/stripe/2025-04-30.basil/handler.client";
export { clientHandler as stripeClientHandler } from "./plugins/stripe/2025-04-30.basil/handler.client";
export {
  serverEvaluate as stripeServerEvaluate,
  serverHandler as stripeServerHandler,
} from "./plugins/stripe/2025-04-30.basil/handler.server";
export type { StripeClient } from "./plugins/stripe/2025-04-30.basil/interpreter";
export { stripeInterpreter } from "./plugins/stripe/2025-04-30.basil/interpreter";
export type {
  ArraySchema,
  InferSchema,
  NullableSchema,
  SchemaShape,
  SchemaTag,
  SchemaType,
} from "./schema";
export { array, nullable } from "./schema";
export { inferType, resolveSchemaType } from "./trait-utils";
