// Public API — DAG-based core

// DAG primitives, builder, fold, and core interpreter
export * from "./dag/index";

// Plugins — definitions
export { numDagPlugin } from "./plugins/num/index";
export type { NumDollar } from "./plugins/num/index";
export { strDagPlugin } from "./plugins/str/index";
export { booleanDagPlugin } from "./plugins/boolean/index";
export { eqDagPlugin } from "./plugins/eq/index";
export { ordDagPlugin } from "./plugins/ord/index";
export { stDagPlugin } from "./plugins/st/index";
export { errorDagPlugin } from "./plugins/error/index";
export { fiberDagPlugin } from "./plugins/fiber/index";
export { controlDagPlugin } from "./plugins/control/index";

// Plugins — interpreters
export { createNumDagInterpreter } from "./plugins/num/interpreter";
export { createStrDagInterpreter } from "./plugins/str/interpreter";
export { createBooleanDagInterpreter } from "./plugins/boolean/interpreter";
export { createEqDagInterpreter } from "./plugins/eq/interpreter";
export { createOrdDagInterpreter } from "./plugins/ord/interpreter";
export { createStDagInterpreter } from "./plugins/st/interpreter";
export { createErrorDagInterpreter } from "./plugins/error/interpreter";
export { createFiberDagInterpreter } from "./plugins/fiber/interpreter";
export { createControlDagInterpreter } from "./plugins/control/interpreter";
