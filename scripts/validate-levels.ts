// Runs the level validator over all levels. Part of `npm run check`.

import { HAND_AUTHORED_COUNT } from "../client/src/game/constants";
import { generateLevelInfo, templateFor } from "../client/src/game/levelGenerator";
import { getLevel, LEVEL_COUNT } from "../client/src/game/levels";
import { validateLevels } from "../client/src/game/validation";

const levels = Array.from({ length: LEVEL_COUNT }, (_, i) => getLevel(i + 1));
const issues = validateLevels(levels);

// Generated levels must never repeat the previous level's template.
for (let id = HAND_AUTHORED_COUNT + 2; id <= LEVEL_COUNT; id++) {
  if (templateFor(id) === templateFor(id - 1)) {
    issues.push({ levelId: id, message: `same template as level ${id - 1} (${templateFor(id)})` });
  }
}

if (issues.length > 0) {
  for (const issue of issues) console.error(`Level ${issue.levelId}: ${issue.message}`);
  console.error(`\nLevel validation failed: ${issues.length} issue(s).`);
  process.exit(1);
}

const templates = new Map<string, number>();
let maxAttempts = 0;
for (let id = HAND_AUTHORED_COUNT + 1; id <= LEVEL_COUNT; id++) {
  const info = generateLevelInfo(id);
  templates.set(info.template, (templates.get(info.template) ?? 0) + 1);
  maxAttempts = Math.max(maxAttempts, info.attempts);
}
const summary = [...templates].map(([name, n]) => `${name} ${n}`).join(", ");
console.log(`Level validation passed: ${levels.length} level(s) checked (${HAND_AUTHORED_COUNT} hand-authored).`);
console.log(`Generated templates: ${summary}; max generator attempts ${maxAttempts}.`);
