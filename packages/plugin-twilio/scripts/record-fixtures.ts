import { execSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRecordingClient } from "../tests/5.5.1/fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../tests/5.5.1/fixtures");
const PRISM_PORT = 4010;
const PRISM_URL = `http://127.0.0.1:${PRISM_PORT}`;
const TWILIO_SPEC =
  "https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json";

// Ensure prism is installed
try {
  execSync("npx @stoplight/prism-cli --version", { stdio: "ignore" });
} catch {
  console.error("Error: @stoplight/prism-cli not found. Install with: npm i -D @stoplight/prism-cli");
  process.exit(1);
}

console.log("Starting Prism mock server...");
const prism = spawn("npx", ["@stoplight/prism-cli", "mock", "-p", String(PRISM_PORT), TWILIO_SPEC], {
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

const accountSid = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const authToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const client = createRecordingClient(PRISM_URL, fixturesDir, { accountSid, authToken });

try {
  console.log("Recording create_message...");
  await client.request("POST", `/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    to: "+15551234567",
    from: "+15559876543",
    body: "Hello",
  });

  console.log("Recording fetch_message...");
  await client.request("GET", `/2010-04-01/Accounts/${accountSid}/Messages/SM00000000000000000000000000000001.json`);

  console.log("Recording list_messages...");
  await client.request("GET", `/2010-04-01/Accounts/${accountSid}/Messages.json`, { limit: 10 });

  console.log("Recording create_call...");
  await client.request("POST", `/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    to: "+15551234567",
    from: "+15559876543",
    url: "https://example.com/twiml",
  });

  console.log("Recording fetch_call...");
  await client.request("GET", `/2010-04-01/Accounts/${accountSid}/Calls/CA00000000000000000000000000000001.json`);

  console.log("Recording list_calls...");
  await client.request("GET", `/2010-04-01/Accounts/${accountSid}/Calls.json`, { limit: 20 });

  client.save();
  console.log(`Fixtures saved to ${fixturesDir}`);
} finally {
  prism.kill();
  console.log("Prism stopped.");
}
