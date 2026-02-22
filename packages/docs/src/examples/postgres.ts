import type { NodeExample } from "./types";

const SEED_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS archive (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT,
  archived_at TIMESTAMP DEFAULT NOW()
);
DELETE FROM users; DELETE FROM archive;
INSERT INTO users (name, email) VALUES
  ('Alice', 'alice@example.com'),
  ('Bob', 'bob@example.com'),
  ('Charlie', 'charlie@example.com');
`;

const PG = ["@mvfm/plugin-postgres"];

const examples: Record<string, NodeExample> = {
  "postgres/query": {
    description: "Run a parameterized SQL query with automatic parameter binding",
    code: `const app = mvfm(prelude, pg);
const prog = app({ search: "string" }, ($) => {
  return $.sql\`SELECT * FROM users WHERE name LIKE $\{$.input.search}\`;
});
await fold(
  defaults(app, { postgres: wasmPgInterpreter }),
  injectInput(prog, { search: "%li%" })
);`,
    plugins: PG,
    pglite: { seedSQL: SEED_SQL },
  },

  "postgres/identifier": {
    description: "Safely interpolate dynamic column or table names into a query",
    code: `const app = mvfm(prelude, pg);
const prog = app({ col: "string" }, ($) => {
  return $.sql\`SELECT $\{$.sql.id($.input.col)} FROM users\`;
});
await fold(
  defaults(app, { postgres: wasmPgInterpreter }),
  injectInput(prog, { col: "name" })
);`,
    plugins: PG,
    pglite: { seedSQL: SEED_SQL },
  },

  "postgres/insert_helper": {
    description: "Generate INSERT column/value clauses from an object",
    code: `const app = mvfm(prelude, pg);
const prog = app({}, ($) => {
  const user = { name: "Diana", email: "diana@example.com" };
  return $.sql\`INSERT INTO users $\{$.sql.insert(user)} RETURNING *\`;
});
await fold(defaults(app, { postgres: wasmPgInterpreter }), prog);`,
    plugins: PG,
    pglite: { seedSQL: SEED_SQL },
  },

  "postgres/set_helper": {
    description: "Generate UPDATE SET clauses from an object",
    code: `const app = mvfm(prelude, pg);
const prog = app({}, ($) => {
  const updates = { name: "Alicia", email: "alicia@example.com" };
  return $.sql\`UPDATE users SET $\{$.sql.set(updates)} WHERE id = 1 RETURNING *\`;
});
await fold(defaults(app, { postgres: wasmPgInterpreter }), prog);`,
    plugins: PG,
    pglite: { seedSQL: SEED_SQL },
  },

  "postgres/begin": {
    description: "Execute multiple queries atomically in a transaction",
    code: `const app = mvfm(prelude, pg);
const prog = app({}, ($) => {
  return $.sql.begin((sql) => [
    sql\`UPDATE users SET name = 'Alice V2' WHERE id = 1\`,
    sql\`INSERT INTO archive (name, email)
      SELECT name, email FROM users WHERE id = 2\`,
    sql\`SELECT * FROM users ORDER BY id\`,
  ]);
});
await fold(defaults(app, { postgres: wasmPgInterpreter }), prog);`,
    plugins: PG,
    pglite: { seedSQL: SEED_SQL },
  },

  "postgres/savepoint": {
    description: "Create a savepoint within a transaction for partial rollback",
    code: `const app = mvfm(prelude, pg);
const prog = app({}, ($) => {
  return $.sql.begin((sql) => {
    const main = sql\`UPDATE users SET name = 'Updated' WHERE id = 1\`;
    const sp = sql.savepoint((sp) => [
      sp\`INSERT INTO archive (name, email) VALUES ('test', 'test@test.com')\`,
      sp\`SELECT * FROM archive\`,
    ]);
    const final_ = sql\`SELECT * FROM users WHERE id = 1\`;
    return [main, sp, final_];
  });
});
await fold(defaults(app, { postgres: wasmPgInterpreter }), prog);`,
    plugins: PG,
    pglite: { seedSQL: SEED_SQL },
  },

  "postgres/cursor": {
    description: "Stream large result sets in batches to limit memory usage",
    code: `const app = mvfm(prelude, console_, pg);
const prog = app({}, ($) => {
  const query = $.sql\`SELECT * FROM users ORDER BY id\`;
  return $.sql.cursor(query, 2, (batch) => {
    return $.console.log("batch:", batch);
  });
});
await fold(defaults(app, { postgres: wasmPgInterpreter }), prog);`,
    plugins: PG,
    pglite: { seedSQL: SEED_SQL },
  },

  "postgres/cursor_batch": {
    description: "Access the current batch of rows inside a cursor callback",
    code: `const app = mvfm(prelude, console_, pg);
const prog = app({}, ($) => {
  const query = $.sql\`SELECT name, email FROM users ORDER BY id\`;
  return $.sql.cursor(query, 1, (batch) => {
    return $.console.log("row:", batch);
  });
});
await fold(defaults(app, { postgres: wasmPgInterpreter }), prog);`,
    plugins: PG,
    pglite: { seedSQL: SEED_SQL },
  },
};

export default examples;
