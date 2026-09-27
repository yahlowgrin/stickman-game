// Runs the level validator over every level. Part of `npm run check`.

import { getLevel, LEVEL_COUNT } from "../client/src/game/levels";
import { validateLevels } from "../client/src/game/validation";

const levels = Array.from({ length: LEVEL_COUNT }, (_, i) => getLevel(i + 1));
const issues = validateLevels(levels);

if (issues.length > 0) {
  for (const issue of issues) console.error(`Level ${issue.levelId}: ${issue.message}`);
  console.error(`\nLevel validation failed: ${issues.length} issue(s).`);
  process.exit(1);
}

console.log(`Level validation passed: ${levels.length} level(s) checked.`);
