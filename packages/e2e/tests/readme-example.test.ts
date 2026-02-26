import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import pg from "postgres";
import Stripe from "stripe";
import OpenAI from "openai";
import { wrapPostgresJs, createPostgresServerInterpreter } from "@mvfm/plugin-postgres";
import { wrapStripeSdk, createStripeInterpreter } from "@mvfm/plugin-stripe";
import { wrapOpenAISdk, createOpenAIInterpreter } from "@mvfm/plugin-openai";
import { runExample } from "../src/readme-example";

// ── Containers ─────────────────────────────────────────────────────

let pgContainer: StartedPostgreSqlContainer;
let stripeContainer: StartedTestContainer;
let sqlClient: ReturnType<typeof pg>;
let stripeInterpreter: ReturnType<typeof createStripeInterpreter>;
let openaiInterpreter: ReturnType<typeof createOpenAIInterpreter>;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

beforeAll(async () => {
  if (!OPENAI_API_KEY) return;

  const [pgC, stripeC] = await Promise.all([
    new PostgreSqlContainer("postgres:16-alpine").start(),
    new GenericContainer("stripe/stripe-mock:latest")
      .withExposedPorts(12111)
      .start(),
  ]);

  pgContainer = pgC;
  stripeContainer = stripeC;

  // Postgres: connect and seed
  sqlClient = pg(pgContainer.getConnectionUri());
  await sqlClient`CREATE TABLE users (id TEXT PRIMARY KEY, credits INT NOT NULL)`;
  await sqlClient`INSERT INTO users (id, credits) VALUES ('usr_abc123', 10)`;

  // Stripe: point SDK at mock container
  const stripeSdk = new Stripe("sk_test_fake", {
    host: stripeContainer.getHost(),
    port: String(stripeContainer.getMappedPort(12111)),
    protocol: "http",
  });
  stripeInterpreter = createStripeInterpreter(wrapStripeSdk(stripeSdk));

  // OpenAI: real API
  const openaiSdk = new OpenAI({ apiKey: OPENAI_API_KEY });
  openaiInterpreter = createOpenAIInterpreter(wrapOpenAISdk(openaiSdk));
}, 120_000);

afterAll(async () => {
  if (sqlClient) await sqlClient.end();
  if (pgContainer) await pgContainer.stop();
  if (stripeContainer) await stripeContainer.stop();
});

describe("README example", () => {
  it.skipIf(!OPENAI_API_KEY)(
    "runs the full pipeline against real services",
    async () => {
      const pgInterpreter = createPostgresServerInterpreter(wrapPostgresJs(sqlClient));

      const result = await runExample(
        { postgres: pgInterpreter, openai: openaiInterpreter, stripe: stripeInterpreter },
        {
          userId: "usr_abc123",
          prompt: "Explain monads like I'm five",
          paymentMethodId: "pm_card_visa",
        },
      );

      // Result is the last expression in $.begin() — the OpenAI completion
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");

      // Verify postgres side effect: credits decremented
      const rows = await sqlClient`SELECT credits FROM users WHERE id = 'usr_abc123'`;
      expect(rows[0].credits).toBe(9);
    },
    120_000,
  );

  it.skipIf(!OPENAI_API_KEY)(
    "throws when user has no credits",
    async () => {
      await sqlClient`INSERT INTO users (id, credits) VALUES ('usr_broke', 0) ON CONFLICT (id) DO UPDATE SET credits = 0`;

      const pgInterpreter = createPostgresServerInterpreter(wrapPostgresJs(sqlClient));

      await expect(
        runExample(
          { postgres: pgInterpreter, openai: openaiInterpreter, stripe: stripeInterpreter },
          {
            userId: "usr_broke",
            prompt: "This should fail",
            paymentMethodId: "pm_card_visa",
          },
        ),
      ).rejects.toThrow("no credits remaining");
    },
    120_000,
  );
});
