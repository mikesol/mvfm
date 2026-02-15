import type { S3Client as AwsS3Client } from "@aws-sdk/client-s3";
import type { S3Client } from "./interpreter";

/**
 * Command constructors are injected by the caller to avoid a hard
 * dependency on `@aws-sdk/client-s3` at this module's import time.
 */
type CommandConstructor = new (input: any) => any;

/**
 * Wraps the official AWS S3 SDK into an {@link S3Client}.
 *
 * Uses `client.send(new XxxCommand(input))` to execute commands.
 * For GetObject, converts the streaming Body to a string.
 *
 * @param client - A configured AWS S3Client instance.
 * @param commands - Map of command name to Command constructor.
 * @returns An {@link S3Client} adapter.
 */
export function wrapAwsSdk(
  client: AwsS3Client,
  commands: Record<string, CommandConstructor>,
): S3Client {
  return {
    async execute(command: string, input: Record<string, unknown>): Promise<unknown> {
      const CommandClass = commands[command];
      if (!CommandClass) {
        throw new Error(`wrapAwsSdk: unknown command "${command}"`);
      }
      const result = (await client.send(new CommandClass(input))) as any;

      // For GetObject, convert streaming Body to string
      if (command === "GetObject" && result.Body) {
        const body = await result.Body.transformToString();
        return { ...result, Body: body };
      }

      return result;
    },
  };
}
