import { composeDollar, createApp, numPlugin, strPlugin } from "@mvfm/core";
import { redis } from "../../src/5.4.1";

const plugin = redis;
export const plugins = [numPlugin, strPlugin, plugin] as const;
export const $ = composeDollar(...plugins);
export const app = createApp(...plugins);
