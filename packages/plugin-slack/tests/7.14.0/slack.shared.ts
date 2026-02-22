import { boolPlugin, createApp, composeDollar, numPlugin, strPlugin } from "@mvfm/core";
import { slack } from "../../src/7.14.0";

const plugin = slack({ token: "xoxb-test-token" });
export const plugins = [numPlugin, strPlugin, boolPlugin, plugin] as const;
export const $ = composeDollar(...plugins);
export const app = createApp(...plugins);
