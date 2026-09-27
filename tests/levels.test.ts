import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { HAND_AUTHORED_COUNT, PLAYER_HEIGHT, TOTAL_LEVELS } from "../client/src/game/constants";
import { createLevelState, isGoalLocked } from "../client/src/game/engine";
import { bossArena, spikes } from "../client/src/game/levelBuilders";
import {
  clearGeneratorCache,
  generateLevel,
  mulberry32,
  templateFor,
} from "../client/src/game/levelGenerator";
import { getLevel, LEVEL_COUNT } from "../client/src/game/levels";
import { bossHp, isBossLevel, sectionFor } from "../client/src/game/sections";
import { isGoalReachable, maxGap, validateLevel, validateLevels } from "../client/src/game/validation";
import { enemy, goal, ground, makeLevel, platform } from "./helpers";

const all = () => Array.from({ length: LEVEL_COUNT }, (_, i) => getLevel(i + 1));

test("there are 200 levels and every one passes the validator", () => {
  assert.equal(LEVEL_COUNT, TOTAL_LEVELS);
  assert.equal(TOTAL_LEVELS, 200);
  assert.deepEqual(validateLevels(all()), []);
});

test("the same level id always generates identical geometry", () => {
  const first = all().map((l) => structuredClone(l));
  clearGeneratorCache();
  const second = all();
  assert.deepEqual(second, first);
});

test("level generation does not use Math.random", () => {
  const source = readFileSync(new URL("../client/src/game/levelGenerator.ts", import.meta.url), "utf8");
  assert.equal(/Math\.random/.test(source), false);
});

test("mulberry32 is deterministic", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = Array.from({ length: 5 }, a);
  assert.deepEqual(Array.from({ length: 5 }, b), seqA);
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
  assert.notDeepEqual(Array.from({ length: 5 }, mulberry32(43)), seqA);
});

test("consecutive generated levels never share a template", () => {
  for (let id = HAND_AUTHORED_COUNT + 2; id <= TOTAL_LEVELS; id++) {
    assert.notEqual(templateFor(id), templateFor(id - 1), `levels ${id - 1} and ${id}`);
  }
});

test("levels carry the right section and names are unique", () => {
  const levels = all();
  assert.equal(new Set(levels.map((l) => l.name)).size, levels.length);
  for (const l of levels) assert.equal(l.section, sectionFor(l.id));
  assert.equal(getLevel(1).name, "The Basics");
  assert.equal(getLevel(20).name, "Mini Boss");
  assert.equal(getLevel(30).name, "Inferno King");
  assert.equal(getLevel(31).name, "Speed Demons 1");
  assert.equal(getLevel(50).name, "Thunder God I");
  assert.equal(getLevel(200).name, "The Final Poison King");
});

test("boss levels have one boss with the tabled HP and a locked door", () => {
  for (let id = 1; id <= TOTAL_LEVELS; id++) {
    const level = getLevel(id);
    const bosses = level.enemies.filter((e) => e.isBoss);
    if (isBossLevel(id)) {
      assert.equal(bosses.length, 1, `level ${id}`);
      assert.equal(bosses[0].hp, bossHp(id));
      assert.equal(isGoalLocked(createLevelState(level)), true, `level ${id} door starts locked`);
    } else {
      assert.equal(bosses.length, 0, `level ${id}`);
    }
  }
  assert.deepEqual([20, 30, 40, 50, 100, 110, 190, 200].map(bossHp), [3, 5, 5, 5, 8, 6, 9, 10]);
});

test("shooters use their section's projectile type", () => {
  for (const l of all()) {
    for (const e of l.enemies) {
      if (!e.projectileType) continue;
      const expected = { fire: "fire", lightning: "lightning", toxic: "toxic" }[l.section as string];
      assert.equal(e.projectileType, expected, `level ${l.id} enemy ${e.id}`);
    }
  }
});

// Validator rules ---------------------------------------------------------------

test("reach table matches SPEC §5, with 85% reach from level 150", () => {
  assert.equal(maxGap(0, 1), 140);
  assert.equal(maxGap(-50, 1), 140);
  assert.equal(maxGap(60, 1), 120);
  assert.equal(maxGap(90, 1), 100);
  assert.equal(maxGap(91, 1), null);
  assert.equal(maxGap(0, 150), 170);
  assert.equal(maxGap(90, 150), 121);
  assert.equal(maxGap(91, 150), null);
});

const reachLevel = (gap: number, rise: number, id = 5) =>
  makeLevel({
    id,
    platforms: [ground(0, 150), platform(150 + gap, 400 - rise, 80)],
    goal: goal(150 + gap + 20, 400 - rise),
  });

test("validator finds routes and rejects gaps beyond the table", () => {
  assert.equal(isGoalReachable(reachLevel(100, 90)), true);
  assert.equal(isGoalReachable(reachLevel(105, 90)), false);
  assert.equal(isGoalReachable(reachLevel(120, 60)), true);
  assert.equal(isGoalReachable(reachLevel(125, 60)), false);
  assert.equal(isGoalReachable(reachLevel(20, 95)), false, "too high");
  assert.equal(isGoalReachable(reachLevel(160, 0, 149)), false);
  assert.equal(isGoalReachable(reachLevel(160, 0, 150)), true, "late-game reach");
  assert.ok(validateLevel(reachLevel(105, 90)).some((i) => i.message.includes("no route")));
});

test("spikes split a surface: jumping a spike strip counts as a gap", () => {
  const level = makeLevel({ spikes: [spikes(200, 400, 150)] });
  assert.equal(isGoalReachable(level), false, "150 px of spikes is too far");
  const ok = makeLevel({ spikes: [spikes(200, 400, 120)] });
  assert.equal(isGoalReachable(ok), true);
});

test("a platform so low that spikes below reach the player is not standable", () => {
  // Top at 385 over a spike floor (spikes 380–400): standing there means touching spikes.
  const level = makeLevel({
    platforms: [ground(0, 400), platform(170, 385, 90), platform(300, 330, 90)],
    spikes: [spikes(150, 400, 250)],
    goal: goal(320, 330),
  });
  const issues = validateLevel(level);
  assert.ok(issues.some((i) => i.message.includes("overlaps spikes")));
  // Without the low platform the goal is too far (gap 150 from the safe ground).
  assert.equal(isGoalReachable(level), false);
});

test("removing a stepping stone from a real level breaks its route", () => {
  const level = getLevel(16);
  assert.equal(isGoalReachable(level), true);
  const broken = { ...level, platforms: level.platforms.filter((_, i) => i !== 3) };
  assert.equal(isGoalReachable(broken), false);
});

test("validator rejects spikes in the spawn area", () => {
  const issues = validateLevel(makeLevel({ spikes: [spikes(60, 400, 40)] }));
  assert.ok(issues.some((i) => i.message.includes("spawn area")));
});

test("validator rejects an enemy patrolling beyond its platform", () => {
  const issues = validateLevel(makeLevel({ enemies: [enemy(1, 400, 300, 420, 1)] }));
  assert.ok(issues.some((i) => i.message.includes("beyond its platform")));
});

test("validator rejects an enemy hanging less than a player-height over a surface", () => {
  const level = makeLevel({
    platforms: [ground(0, 400), platform(200, 400 - PLAYER_HEIGHT + 10, 150)],
    enemies: [enemy(1, 400 - PLAYER_HEIGHT + 10, 200, 350, 1)],
  });
  assert.ok(validateLevel(level).some((i) => i.message.includes("player-height")));
});

test("validator rejects geometry outside the world", () => {
  const issues = validateLevel(makeLevel({ platforms: [{ x: 0, y: 400, width: 450, height: 100 }] }));
  assert.ok(issues.some((i) => i.message.includes("outside world")));
});

test("validator rejects a goal on spikes and a goal floating in the air", () => {
  const onSpikes = makeLevel({ spikes: [spikes(350, 400, 50)] });
  assert.ok(validateLevel(onSpikes).some((i) => i.message.includes("goal")));
  const floating = makeLevel({ goal: { x: 300, y: 200, width: 36, height: 50 } });
  assert.ok(validateLevel(floating).some((i) => i.message.includes("stand fully on a surface")));
});

test("validator enforces boss rules", () => {
  const noBoss = makeLevel({ id: 20 });
  assert.ok(validateLevel(noBoss).some((i) => i.message.includes("exactly one boss")));
  const arena = { ...makeLevel({ id: 20 }), ...bossArena({ speed: 1, hp: 3 }) };
  assert.deepEqual(validateLevel(arena), []);
  const spiky = { ...arena, spikes: [spikes(200, 400, 40)] };
  assert.ok(validateLevel(spiky).some((i) => i.message.includes("floor has spikes")));
  const wrongHp = { ...makeLevel({ id: 20 }), ...bossArena({ speed: 1, hp: 4 }) };
  assert.ok(validateLevel(wrongHp).some((i) => i.message.includes("boss hp")));
  const stray = { ...makeLevel({ id: 21 }), ...bossArena({ speed: 1, hp: 3 }) };
  assert.ok(validateLevel(stray).some((i) => i.message.includes("non-boss level")));
});

test("validator rejects too-fast enemies and too-short shooter cooldowns", () => {
  const fast = makeLevel({ enemies: [enemy(1, 400, 200, 400, 5)] });
  assert.ok(validateLevel(fast).some((i) => i.message.includes("speed")));
  const rapid = makeLevel({
    enemies: [enemy(1, 400, 200, 400, 1, { projectileType: "fire", shootCooldown: 30 })],
  });
  assert.ok(validateLevel(rapid).some((i) => i.message.includes("cooldown")));
});

test("generated levels are all within the world and every section is represented", () => {
  const sections = new Set<string>();
  for (let id = HAND_AUTHORED_COUNT + 1; id <= TOTAL_LEVELS; id++) {
    const l = generateLevel(id);
    sections.add(l.section);
    assert.equal(l.id, id);
  }
  assert.deepEqual([...sections].sort(), ["lightning", "toxic"]);
});
