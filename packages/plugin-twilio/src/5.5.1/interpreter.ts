import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { wrapTwilioSdk } from "./client-twilio-sdk";

/**
 * Twilio client interface consumed by the twilio handler.
 *
 * Abstracts over the actual Twilio SDK so handlers can be
 * tested with mock clients.
 */
export interface TwilioClient {
  /** Execute a Twilio API request and return the parsed response. */
  request(method: string, path: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Creates an interpreter for `twilio/*` node kinds using the new
 * RuntimeEntry + positional yield pattern.
 *
 * Config (accountSid, authToken) is captured in the closure,
 * not stored on AST nodes.
 *
 * @param client - The {@link TwilioClient} to execute against.
 * @param accountSid - The Twilio Account SID (string or lazy getter) for URL construction.
 * @returns An Interpreter handling all twilio node kinds.
 */
export function createTwilioInterpreter(
  client: TwilioClient,
  accountSid: string | (() => string),
): Interpreter {
  const getSid = typeof accountSid === "function" ? accountSid : () => accountSid;
  const getBase = () => `/2010-04-01/Accounts/${getSid()}`;

  return {
    "twilio/create_message": async function* (_entry: RuntimeEntry) {
      const params = yield 0;
      return await client.request(
        "POST",
        `${getBase()}/Messages.json`,
        params as Record<string, unknown>,
      );
    },

    "twilio/fetch_message": async function* (_entry: RuntimeEntry) {
      const sid = yield 0;
      return await client.request("GET", `${getBase()}/Messages/${sid}.json`);
    },

    "twilio/list_messages": async function* (entry: RuntimeEntry) {
      const params = entry.children.length > 0 ? ((yield 0) as Record<string, unknown>) : undefined;
      return await client.request("GET", `${getBase()}/Messages.json`, params);
    },

    "twilio/create_call": async function* (_entry: RuntimeEntry) {
      const params = yield 0;
      return await client.request(
        "POST",
        `${getBase()}/Calls.json`,
        params as Record<string, unknown>,
      );
    },

    "twilio/fetch_call": async function* (_entry: RuntimeEntry) {
      const sid = yield 0;
      return await client.request("GET", `${getBase()}/Calls/${sid}.json`);
    },

    "twilio/list_calls": async function* (entry: RuntimeEntry) {
      const params = entry.children.length > 0 ? ((yield 0) as Record<string, unknown>) : undefined;
      return await client.request("GET", `${getBase()}/Calls.json`, params);
    },

    "twilio/record": async function* (entry: RuntimeEntry) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < entry.children.length; i += 2) {
        const key = (yield i) as string;
        const value = yield i + 1;
        result[key] = value;
      }
      return result;
    },

    "twilio/array": async function* (entry: RuntimeEntry) {
      const result: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        result.push(yield i);
      }
      return result;
    },
  };
}

function requiredEnv(name: "TWILIO_ACCOUNT_SID" | "TWILIO_AUTH_TOKEN"): string {
  const env = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  const value = env?.[name];
  if (!value) {
    throw new Error(
      `@mvfm/plugin-twilio: missing ${name}. Set ${name} or use createTwilioInterpreter(...)`,
    );
  }
  return value;
}

function _lazyInterpreter(factory: () => Interpreter): Interpreter {
  let cached: Interpreter | undefined;
  const get = () => (cached ??= factory());
  return new Proxy({} as Interpreter, {
    get(_target, property) {
      return get()[property as keyof Interpreter];
    },
    has(_target, property) {
      return property in get();
    },
    ownKeys() {
      return Reflect.ownKeys(get());
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Object.getOwnPropertyDescriptor(get(), property);
      return descriptor
        ? descriptor
        : {
            configurable: true,
            enumerable: true,
            writable: false,
            value: undefined,
          };
    },
  });
}

function createDefaultTwilioSdkClient(
  accountSid: string,
  authToken: string,
): {
  request(opts: {
    method: string;
    uri: string;
    data?: Record<string, unknown>;
  }): Promise<{ body: unknown }>;
} {
  return {
    async request(opts) {
      const encodedAuth = btoa(`${accountSid}:${authToken}`);
      const response = await fetch(opts.uri, {
        method: opts.method,
        headers: {
          Authorization: `Basic ${encodedAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body:
          opts.data == null
            ? undefined
            : new URLSearchParams(
                Object.entries(opts.data).map(([key, value]) => [key, String(value)]),
              ).toString(),
      });
      return { body: await response.json() };
    },
  };
}

/**
 * Default Twilio interpreter that uses `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
 *
 * Env vars are read lazily on first request, not at import time.
 */
export const twilioInterpreter: Interpreter = (() => {
  let clientPromise: Promise<TwilioClient> | undefined;
  const getClient = async (): Promise<TwilioClient> => {
    if (!clientPromise) {
      const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
      const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
      clientPromise = Promise.resolve(
        wrapTwilioSdk(createDefaultTwilioSdkClient(accountSid, authToken)),
      );
    }
    return clientPromise;
  };

  const lazyClient: TwilioClient = {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const client = await getClient();
      return client.request(method, path, params);
    },
  };

  return createTwilioInterpreter(lazyClient, () => requiredEnv("TWILIO_ACCOUNT_SID"));
})();
