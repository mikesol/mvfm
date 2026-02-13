import type { ResendClient } from "./interpreter";

/** Minimal interface for the Resend SDK methods used by this adapter. */
interface ResendSdk {
  post<T>(path: string, entity?: unknown): Promise<{ data: T; error: unknown }>;
  get<T>(path: string): Promise<{ data: T; error: unknown }>;
  delete<T>(path: string): Promise<{ data: T; error: unknown }>;
  patch<T>(path: string, entity?: unknown): Promise<{ data: T; error: unknown }>;
}

/**
 * Wraps the official Resend SDK into a {@link ResendClient}.
 *
 * Uses the SDK's typed HTTP methods (`post`, `get`, `delete`, `patch`)
 * to send requests, preserving the SDK's built-in authentication and
 * error handling.
 *
 * @param resend - A configured Resend SDK instance.
 * @returns A {@link ResendClient} adapter.
 */
export function wrapResendSdk(resend: ResendSdk): ResendClient {
  return {
    async request(method: string, path: string, params?: unknown): Promise<unknown> {
      const upperMethod = method.toUpperCase();
      let response: { data: unknown; error: unknown };

      switch (upperMethod) {
        case "POST":
          response = await resend.post(path, params);
          break;
        case "GET":
          response = await resend.get(path);
          break;
        case "DELETE":
          response = await resend.delete(path);
          break;
        case "PATCH":
          response = await resend.patch(path, params);
          break;
        default:
          throw new Error(`wrapResendSdk: unsupported method "${method}"`);
      }

      if (response.error) {
        throw new Error(
          typeof response.error === "object" &&
            response.error !== null &&
            "message" in response.error
            ? String((response.error as { message: string }).message)
            : `Resend API error on ${upperMethod} ${path}`,
        );
      }

      return response.data;
    },
  };
}
