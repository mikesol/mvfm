// Public API

export { injectInput, injectLambdaParam, mvfm } from "./core";
export { defaults } from "./defaults";

export type {
  CompleteInterpreter,
  FoldState,
  FoldYield,
  Handler,
  Interpreter,
  RecurseScopedEffect,
  ScopedBinding,
  TypedNode,
  TypedProgram,
} from "./fold";
export {
  createFoldState,
  eval_,
  foldAST,
  recurseScoped,
  typedFoldAST,
  VOLATILE_KINDS,
} from "./fold";
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
export { prelude } from "./prelude";
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
export type {
  Expr,
  MissingTraitError,
  Plugin,
  PluginContext,
  PluginDefinition,
  PluginInput,
  Program,
  TraitImpl,
  TypeclassMapping,
  TypeclassSlot,
} from "./types";
export { checkCompleteness } from "./validation";
