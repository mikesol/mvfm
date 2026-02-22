import { createApp, composeDollar, numPlugin, strPlugin } from "@mvfm/core";
import { redis } from "../../src/5.4.1";

const plugin = redis({ host: "127.0.0.1", port: 6379 });
export const plugins = [numPlugin, strPlugin, plugin] as const;
export const $ = composeDollar(...plugins);
export const app = createApp(...plugins);
