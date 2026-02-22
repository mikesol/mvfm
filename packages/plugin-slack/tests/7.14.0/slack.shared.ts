import { boolPluginU, createApp, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { slack } from "../../src/7.14.0";

const plugin = slack({ token: "xoxb-test-token" });
export const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
export const $ = mvfmU(...plugins);
export const app = createApp(...plugins);
