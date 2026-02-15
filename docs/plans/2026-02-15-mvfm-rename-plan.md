# MVFM Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename legacy project identifier tokens to `mvfm`/`Mvfm`/`MVFM` across the repository using boundary-safe rules.

**Architecture:** Use regex-driven token replacement on tracked text files with non-word boundaries so standalone identifiers and path segments are renamed while embedded substrings are preserved. Validate with a red/green audit cycle and run project verification commands.

**Tech Stack:** zsh, git, ripgrep, perl, npm, TypeScript/Vitest.

---

### Task 1: Establish failing rename audit (RED)

**Files:**
- Modify: none
- Test: repository-wide `rg` audits

**Step 1: Run boundary token audit before rename**

Run: `rg --pcre2 -n "(?<![A-Za-z0-9_])(mvfm|Mvfm|MVFM)(?![A-Za-z0-9_])" -g '!node_modules' -g '!dist' -g '!.worktrees'`
Expected: broad matches exist after migration.

**Step 2: Run anti-footgun audit baseline**

Run: `rg -n "phmvfm|Phmvfm|PHMVFM" -g '!node_modules' -g '!dist' -g '!.worktrees'`
Expected: no accidental in-word mutations.

### Task 2: Apply minimal boundary-safe replacements (GREEN)

**Files:**
- Modify: tracked text files containing boundary token matches
- Test: post-replacement audits

**Step 1: Apply boundary token replacement passes**

Run: `git ls-files -z | while IFS= read -r -d '' f; do perl -0777 -i -pe 's/(?<![A-Za-z0-9_])mvfm(?![A-Za-z0-9_])/mvfm/g; s/(?<![A-Za-z0-9_])Mvfm(?![A-Za-z0-9_])/Mvfm/g; s/(?<![A-Za-z0-9_])MVFM(?![A-Za-z0-9_])/MVFM/g' "$f"; done`

**Step 2: Verify no accidental in-word mutations**

Run: `rg -n "phmvfm|Phmvfm|PHMVFM" -g '!node_modules' -g '!dist' -g '!.worktrees'`
Expected: no matches.

### Task 3: Verification and reporting

**Files:**
- Modify: none
- Test: `npm run build`, `npm run check`, `npm test`

**Step 1: Run build verification**

Run: `npm run build`
Expected: exit code 0.

**Step 2: Run static checks**

Run: `npm run check`
Expected: exit code 0.

**Step 3: Run tests**

Run: `npm test`
Expected: same sandbox-limited failures as baseline (container/socket integration limitations), with no new rename-induced failures.

**Step 4: Inspect diff for rename-only scope**

Run: `git diff --stat && git diff --name-only`
Expected: only rename-related file edits.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: rename project identifier to mvfm"
```
