import { generateSlackExamples } from "./slack/index.js";
import type { ExampleEntry } from "./types";

const examples: Record<string, ExampleEntry> = {
  ...generateSlackExamples(),
};

export { examples };
