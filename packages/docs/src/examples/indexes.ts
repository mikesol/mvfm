import { coreIndexes } from "./indexes-core";
import { externalIndexes } from "./indexes-external";
import type { NamespaceIndex } from "./types";

const indexes: Record<string, NamespaceIndex> = {
  ...coreIndexes,
  ...externalIndexes,
};

export { indexes };
