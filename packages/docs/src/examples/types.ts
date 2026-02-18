export interface NodeExample {
  /** One-line description shown below the heading. */
  description: string;
  /** Executable code for the playground. */
  code: string;
  /** Plugin packages to import beyond core+console. Defaults to none. */
  plugins?: string[];
  /** JS expression returning an interpreter record for infra plugins. */
  mockInterpreter?: string;
  /** When set, the playground loads PGLite and seeds it with this SQL. */
  pglite?: { seedSQL: string };
  /** When set, the playground provides an in-memory Redis client. */
  redis?: true;
  /** When set, the playground provides an in-memory S3 client. */
  s3?: true;
  /** When set, the playground provides an in-memory Cloudflare KV client. */
  cloudflareKv?: true;
}

/** Prose landing page for a plugin namespace (e.g. /core, /postgres). */
export interface NamespaceIndex {
  /** Prose content as raw HTML. */
  content: string;
  /** Optional non-runnable code example (rendered with Shiki Code component). */
  staticCode?: string;
  /** Optional runnable code for an interactive playground. */
  code?: string;
}

/** Union of all example entry types. */
export type ExampleEntry = NodeExample | NamespaceIndex;

/** Type guard: true when the entry is a namespace index page, not a runnable example. */
export function isNamespaceIndex(entry: ExampleEntry): entry is NamespaceIndex {
  return "content" in entry;
}
