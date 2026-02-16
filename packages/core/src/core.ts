// ============================================================
// MVFM — Barrel re-export for backward compatibility
// ============================================================
//
// core.ts is now a barrel that re-exports from the split modules.
// Internal code can import from here or from the specific modules.
//

export { mvfm } from "./builder";
export {
  type CompleteInterpreter,
  checkCompleteness,
  createFoldState,
  eval_,
  type FoldState,
  foldAST,
  type Handler,
  type Interpreter,
  type TypedNode,
  type TypedProgram,
  typedFoldAST,
  VOLATILE_KINDS,
} from "./fold";
export { autoLift, isExpr, makeExprProxy } from "./proxy";
export {
  type CollectTrait,
  type CoreDollar,
  type Expr,
  type ExprBase,
  type ExprFields,
  type ExtractPluginTraits,
  type ExtractPluginType,
  type FlattenPluginInput,
  type FlattenPluginInputs,
  type MergePlugins,
  type MissingTraitError,
  MVFM,
  type Plugin,
  type PluginContext,
  type PluginDefinition,
  type PluginInput,
  type Program,
  type ResolvePlugin,
  type TraitImpl,
  type TypeclassMapping,
  type TypeclassSlot,
  type UnionToIntersection,
} from "./types";
export { injectLambdaParam, isInternalNode, nextNodeId, simpleHash } from "./utils";
