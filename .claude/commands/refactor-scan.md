---
name: refactor-scan
description: Scan the codebase for refactor candidates — components and files >300 lines that are extraction targets. Suggests which subagent to delegate to.
---

You are assisting with **refactor-scan** for VILO. This command identifies large files and components that are extraction candidates.

## Workflow

1. **Find all `.tsx` and `.ts` files in `src/`.**
   ```bash
   cd /home/user/vilo-app/vilo-app
   find src -name "*.tsx" -o -name "*.ts" | while read f; do wc -l "$f"; done | sort -rn | head -30
   ```

2. **For each file >300 lines:**
   - Report: filename, line count, current structure (state hooks, sub-components, util-imports).
   - Suggest extraction strategy (which hooks / sub-components to pull out).
   - **Recommend subagent**: `ui-refactor` for pure structure work, or domain specialist if logic-heavy (`floor-plan-specialist`, `reservations-specialist`, `pos-specialist`).

3. **Prioritize by impact:**
   - Rank by line count descending.
   - Note which files are already refactored recently (check git log).
   - Flag "architectural debt" files that touch multiple domains.

4. **Report format:**
   ```
   ## Refactor Scan Results
   
   | File | Lines | Type | Extraction Candidates | Recommended Subagent |
   |------|-------|------|----------------------|----------------------|
   | src/components/FloorPlan.tsx | 1234 | Component | 3 Hooks + 2 Sub-Components | ui-refactor |
   | ... | ... | ... | ... | ... |
   
   ### Priority 1 (Highest Impact)
   - ...
   ```

5. **Stop.**
   - No actual refactoring — just scanning and recommendations.
   - User decides which to tackle next.
