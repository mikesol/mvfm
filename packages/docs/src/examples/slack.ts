import type { ExampleEntry } from "./types";
import { generateSlackExamples } from "./slack/index.js";

const examples: Record<string, ExampleEntry> = {
  ...generateSlackExamples(),
};

export default examples;
