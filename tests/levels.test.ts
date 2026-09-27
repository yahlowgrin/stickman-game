import assert from "node:assert/strict";
import { test } from "node:test";
import { getLevel, LEVEL_COUNT } from "../client/src/game/levels";
import { validateLevel, validateLevels } from "../client/src/game/validation";
import { enemy, makeLevel } from "./helpers";
import { spikes } from "../client/src/game/levelBuilders";

const all = () => Array.from({ length: LEVEL_COUNT }, (_, i) => getLevel(i + 1));

test("every level passes the validator", () => {
  assert.deepEqual(validateLevels(all()), []);
});

test("the same level id always yields identical geometry", () => {
  for (let id = 1; id <= LEVEL_COUNT; id++) {
    assert.deepEqual(getLevel(id), structuredClone(getLevel(id)));
  }
});

test("validator rejects spikes in the spawn area", () => {
  const issues = validateLevel(makeLevel({ spikes: [spikes(60, 400, 40)] }));
  assert.ok(issues.some((i) => i.message.includes("spawn area")));
});

test("validator rejects an enemy patrolling beyond its platform", () => {
  const bad = enemy(1, 400, 300, 420, 1);
  const issues = validateLevel(makeLevel({ enemies: [bad] }));
  assert.ok(issues.some((i) => i.message.includes("beyond its platform")));
});

test("validator rejects geometry outside the world", () => {
  const issues = validateLevel(makeLevel({ platforms: [{ x: 0, y: 400, width: 450, height: 100 }] }));
  assert.ok(issues.some((i) => i.message.includes("outside world")));
});
