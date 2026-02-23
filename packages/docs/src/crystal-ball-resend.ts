/** Crystal-ball mock client for the Resend plugin. */

let resendIdCounter = 0;
function nextResendId(prefix: string): string {
  return `${prefix}_crystal_ball_${String(++resendIdCounter).padStart(3, "0")}`;
}

/** Creates a Resend mock client returning prefab crystal-ball responses. */
export function createCrystalBallResendClient(): import("@mvfm/plugin-resend").ResendClient {
  return {
    async request(method: string, path: string, params?: unknown) {
      // Send email
      if (method === "POST" && path === "/emails") {
        return { id: nextResendId("email"), object: "email" };
      }
      // Get email
      if (method === "GET" && /^\/emails\/[^/]+$/.test(path)) {
        return {
          id: path.split("/").pop(),
          object: "email",
          from: "sender@example.com",
          to: ["recipient@example.com"],
          subject: "Test",
          created_at: "2026-01-01T00:00:00Z",
        };
      }
      // Send batch emails
      if (method === "POST" && path === "/emails/batch") {
        const emails = Array.isArray(params) ? params : [];
        return { data: emails.map(() => ({ id: nextResendId("email") })) };
      }
      // Create contact
      if (method === "POST" && path === "/contacts") {
        return { id: nextResendId("contact"), object: "contact" };
      }
      // Get contact
      if (method === "GET" && /^\/contacts\/[^/]+$/.test(path)) {
        return { id: path.split("/").pop(), object: "contact", email: "user@example.com" };
      }
      // List contacts
      if (method === "GET" && path === "/contacts") {
        return {
          object: "list",
          data: [{ id: "contact_crystal_ball_001", email: "crystal@example.com" }],
        };
      }
      // Delete contact
      if (method === "DELETE" && /^\/contacts\/[^/]+$/.test(path)) {
        return { object: "contact", id: path.split("/").pop(), deleted: true };
      }

      throw new Error(`Crystal ball Resend client: unhandled ${method} ${path}`);
    },
  };
}
