---
name: ship
description: Complete development workflow in one command — lint, build, test, commit, and push to the current feature branch. Use when your changes are ready for review.
---

You are assisting with the **ship** workflow for VILO. This command runs the full quality-gate sequence and pushes to the feature branch.

## Workflow

1. **Lint** (`npm run lint`)
   - Fix any ESLint errors/warnings first. If linter fails, stop and report.

2. **Build** (`npm run build`)
   - TypeScript check + Vite bundle. If build fails, stop and report.

3. **Test** (`npm run test`)
   - Run the full Vitest suite. If tests fail, stop and report.

4. **Commit** (if changes present)
   - Gather all uncommitted changes (staged + unstaged).
   - Draft a concise commit message (1-2 sentences, focus on WHY).
   - Commit with the template ending (see CLAUDE.md session URL).

5. **Push**
   - `git push -u origin <current-branch>` (retry up to 4 times on network failure with exponential backoff: 2s, 4s, 8s, 16s).

## Success Criteria

- ✅ lint passes
- ✅ build passes
- ✅ tests pass
- ✅ commit created (if changes)
- ✅ pushed to remote branch

Report the final status clearly. If any step fails, stop and report the blocker.
