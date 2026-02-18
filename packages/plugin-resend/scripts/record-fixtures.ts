import { execSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRecordingClient } from "../tests/6.9.2/fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../tests/6.9.2/fixtures");
const PRISM_PORT = 4010;
const PRISM_URL = `http://127.0.0.1:${PRISM_PORT}`;
const RESEND_SPEC =
  "https://raw.githubusercontent.com/resend/resend-openapi/main/resend.yaml";

// Ensure prism is installed
try {
  execSync("npx @stoplight/prism-cli --version", { stdio: "ignore" });
} catch {
  console.error("Error: @stoplight/prism-cli not found. Install with: npm i -D @stoplight/prism-cli");
  process.exit(1);
}

console.log("Starting Prism mock server...");
const prism = spawn("npx", ["@stoplight/prism-cli", "mock", "-p", String(PRISM_PORT), RESEND_SPEC], {
  stdio: ["ignore", "pipe", "pipe"],
});

// Wait for Prism to be ready
await new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Prism failed to start within 30s")), 30000);
  prism.stderr?.on("data", (data: Buffer) => {
    const line = data.toString();
    if (line.includes("Prism is listening")) {
      clearTimeout(timeout);
      resolve();
    }
  });
  prism.on("error", (err) => {
    clearTimeout(timeout);
    reject(err);
  });
});

console.log(`Prism listening on ${PRISM_URL}`);

const client = createRecordingClient(PRISM_URL, fixturesDir);

try {
  console.log("Recording send_email...");
  await client.request("POST", "/emails", {
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Hello",
    html: "<p>World</p>",
  });

  console.log("Recording get_email...");
  await client.request("GET", "/emails/email_abc");

  console.log("Recording send_batch...");
  await client.request("POST", "/emails/batch", [
    { from: "a@example.com", to: "b@example.com", subject: "One", html: "<p>1</p>" },
    { from: "a@example.com", to: "c@example.com", subject: "Two", html: "<p>2</p>" },
  ]);

  console.log("Recording create_contact...");
  await client.request("POST", "/contacts", {
    email: "user@example.com",
  });

  console.log("Recording get_contact...");
  await client.request("GET", "/contacts/contact_xyz");

  console.log("Recording list_contacts...");
  await client.request("GET", "/contacts");

  console.log("Recording remove_contact...");
  await client.request("DELETE", "/contacts/contact_del");

  client.save();
  console.log(`Fixtures saved to ${fixturesDir}`);
} finally {
  prism.kill();
  console.log("Prism stopped.");
}
