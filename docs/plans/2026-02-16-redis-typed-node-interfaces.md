# Redis Typed Node Interfaces Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `node: any` handler signatures in the redis interpreter with specific typed node interfaces for all redis node kinds.

**Architecture:** Keep the existing `createRedisInterpreter` structure and runtime command behavior unchanged. Define and group typed interfaces by command family (strings, keys, hashes, lists), then wire each handler to its corresponding interface so `eval_` calls infer child value types through `TypedNode<T>`.

**Tech Stack:** TypeScript, `@mvfm/core` `TypedNode`/`eval_`, existing redis plugin tests.

---

### Task 1: Add string command node interfaces

**Files:**
- Modify: `packages/plugin-redis/src/5.4.1/interpreter.ts`
- Test: `packages/plugin-redis/tests/5.4.1/interpreter.test.ts`

**Step 1: Write failing test**

Add a type-level compile test by replacing one existing string handler signature usage from `any` to a non-`any` typed interface and compile.

**Step 2: Run test to verify it fails**

Run: `npm run build --workspace @mvfm/plugin-redis`
Expected: FAIL until all referenced fields are typed consistently.

**Step 3: Write minimal implementation**

Define specific string interfaces and update handlers:
- `redis/set`, `redis/incrby`, `redis/decrby`, `redis/mset`, `redis/getrange`, `redis/setrange`
- Reuse existing `RedisKeyNode`, `RedisKeyValueNode`, `RedisKeysNode` where applicable.

**Step 4: Run test to verify it passes**

Run: `npm run build --workspace @mvfm/plugin-redis`
Expected: PASS for string interface updates.

**Step 5: Commit**

```bash
git add packages/plugin-redis/src/5.4.1/interpreter.ts
git commit -m "refactor(plugin-redis): type string command handler nodes"
```

### Task 2: Add key/hash/list command node interfaces

**Files:**
- Modify: `packages/plugin-redis/src/5.4.1/interpreter.ts`
- Test: `packages/plugin-redis/tests/5.4.1/interpreter.test.ts`

**Step 1: Write failing test**

Continue replacing key/hash/list `any` signatures to typed interfaces and compile.

**Step 2: Run test to verify it fails**

Run: `npm run build --workspace @mvfm/plugin-redis`
Expected: FAIL until all handlers reference valid typed interfaces.

**Step 3: Write minimal implementation**

Define remaining interfaces and wire handlers:
- Key: `redis/expire`, `redis/pexpire`
- Hash: `redis/hget`, `redis/hset`, `redis/hmget`, `redis/hdel`, `redis/hexists`, `redis/hincrby`
- List: `redis/lpush`, `redis/rpush`, `redis/lpop`, `redis/rpop`, `redis/lrange`, `redis/lindex`, `redis/lset`, `redis/lrem`, `redis/linsert`

**Step 4: Run test to verify it passes**

Run: `npm run build --workspace @mvfm/plugin-redis`
Expected: PASS with no behavioral changes.

**Step 5: Commit**

```bash
git add packages/plugin-redis/src/5.4.1/interpreter.ts
git commit -m "refactor(plugin-redis): type key hash and list handler nodes"
```

### Task 3: Full verification and readiness

**Files:**
- Verify: `packages/plugin-redis/src/5.4.1/interpreter.ts`
- Verify: `packages/plugin-redis/tests/5.4.1/interpreter.test.ts`

**Step 1: Run full project verification**

Run:
- `npm run build`
- `npm run check`
- `npm test`

**Step 2: Confirm no runtime behavior changes**

Run redis plugin tests specifically:
- `npm test --workspace @mvfm/plugin-redis`

**Step 3: Commit final changes if needed**

```bash
git add -A
git commit -m "refactor(plugin-redis): add typed node interfaces to redis interpreter"
```
