# Mvfm

Extensible tagless final DSL for deterministic, verifiable TypeScript programs. See `VISION.md` for architecture.

## How to find work

```
gh issue list --milestone "<current phase>" --label "ready" --assignee ""
```

Pick an issue. Read it fully — especially **"Not in scope"**. Then:

1. Assign yourself: `gh issue edit <N> --add-assignee @me --remove-label ready --add-label in-progress`
2. Create a worktree: `git worktree add ../mvfm-<N> -b issue-<N>`
3. Work in that worktree
4. PR back to main: `gh pr create` referencing `Closes #<N>`

## How to submit work

PR body must include:

- `Closes #<N>`
- **What this does**: 2-3 sentences
- **Design alignment**: For each VISION.md principle referenced in the issue, confirm how the implementation matches. Any deviation must reference an approved `spec-change` issue.
- **Validation performed**: What you tested (`npm run build`, `npm test`, `npm run check`). Evidence, not claims.

## Required skills for all workflow operations

**You MUST use the superpowers skills for brainstorming, planning, worktree management, and sub-agent dispatch.** Do NOT hand-roll these operations with raw Task tool calls — the skills handle permissions, directory routing, and agent coordination correctly. Raw background agents WILL fail on file writes due to auto-denied permissions.

| Operation | Required skill |
|---|---|
| Creative/design work before implementation | `superpowers:brainstorming` |
| Writing implementation plans | `superpowers:writing-plans` |
| Creating/managing git worktrees | `superpowers:using-git-worktrees` |
| Dispatching parallel sub-agents | `superpowers:dispatching-parallel-agents` |
| Executing plans with sub-agents (same session) | `superpowers:subagent-driven-development` |
| Executing plans (separate session) | `superpowers:executing-plans` |
| Finishing a branch (merge/PR/cleanup) | `superpowers:finishing-a-development-branch` |
| Code review | `superpowers:requesting-code-review` |
| Verifying work before claiming done | `superpowers:verification-before-completion` |
| TDD workflow | `superpowers:test-driven-development` |

**Never** use `run_in_background: true` with the Task tool for implementation work. Background agents cannot prompt for permissions and will silently fail or write to wrong directories.

## How to handle PR reviews

After creating a PR, bot reviewers (CodeRabbit, Copilot) will leave comments. Triage them:

1. **Reply to every comment** with a concise rationale (fix, defer, or dismiss with reason)
2. **Resolve every thread** after replying — use the GraphQL `resolveReviewThread` mutation
3. **Fix only what's actually wrong** — bot reviewers lack project context and frequently suggest over-engineering

**API reference** (so you don't have to rediscover this):

```bash
# Get review comment IDs
gh api repos/mikesol/mvfm/pulls/<N>/comments --jq '.[] | {id, user: .user.login, path, line, body: .body[:80]}'

# Reply to a review comment (in_reply_to creates a thread reply)
gh api repos/mikesol/mvfm/pulls/<N>/comments -f body="Your reply" -F in_reply_to=<comment_id>

# Get thread IDs for resolving
gh api graphql -f query='{ repository(owner: "mikesol", name: "mvfm") { pullRequest(number: <N>) { reviewThreads(first: 50) { nodes { id isResolved } } } } }'

# Resolve a thread
gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<thread_id>"}) { thread { isResolved } } }'
```

## Standing rules

- **NEVER merge PRs without explicit user authorization.** Always wait for the user to say "merge it" (or equivalent). Creating a PR is fine; merging is not. Bot reviewers (CodeRabbit, Copilot) need time to review, and the user needs to see their feedback before deciding to merge. No exceptions.
- **SCAFFOLD code**: If you encounter code marked `SCAFFOLD`, don't modify/extend/build on it beyond its stated purpose. When you create scaffold code, add a `SCAFFOLD(phase, #issue)` comment and create a `scaffold-cleanup` issue.
- **Spec seems wrong?** STOP. Open a GitHub Issue labeled `spec-change` with: the problem (with evidence), affected VISION.md sections, proposed change, downstream impact. Don't build on a wrong assumption.
- **Type-check and lint**: Validate with `npm run build && npm run check && npm test`. AST output must be inspectable and deterministic.
- **Wait for CI before merging.** After creating a PR, use `gh pr checks <N> --watch` or `sleep 60 && gh pr checks <N>` to confirm all checks pass before requesting merge authorization. Never merge a red PR.
- **Every plugin must follow the contract in `docs/plugin-authoring-guide.md`.** Three fields: `name`, `nodeKinds`, `build(ctx)`. No exceptions.
- **AST nodes must be namespaced to their plugin** (`plugin/kind`, not bare `kind`). The `nodeKinds` array in the plugin definition must list every kind the plugin emits.
- **Every public export must have a TSDoc comment.** This applies to types, interfaces, functions, and consts exported from `src/index.ts`. When you author a new export, add TSDoc before committing. When you spot an existing export missing TSDoc during unrelated work, file a GitHub issue (labeled `documentation`) describing what's missing, then continue your current task. Don't silently leave undocumented exports.
- **Never roll prelude-level logic into a plugin.** If an operation could be useful to more than one plugin, it MUST be its own plugin. This applies to both user-facing API and internal implementation. Examples: equality → `eq` plugin, ordering → `ord` plugin, null handling → `nullable` plugin. When you discover a missing prelude operation while building a plugin, STOP. Create an issue for the prelude plugin. Build it. Resume. This rule exists because agents learn by example — if a reference plugin inlines generic logic, every agent-generated plugin will do the same.

## Current phase

Phase 1: Core Solidification (Milestone: "Phase 1: Core Solidification")
