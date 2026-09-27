import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceSequencer,
  createAudioEngine,
  initSequencer,
  noteFrequency,
  SECTION_THEMES,
} from "../client/src/game/audio";
import type { PatternStep } from "../client/src/game/audio";
import type { Section } from "../client/src/game/types";

const SECTIONS: Section[] = ["core", "fire", "speed", "lightning", "toxic"];

// --- noteFrequency (pure equal-tempered math) -----------------------------------

test("noteFrequency: 0 semitones is the root, +12 doubles it, -12 halves it", () => {
  assert.equal(noteFrequency(0, 440), 440);
  assert.equal(noteFrequency(12, 440), 880);
  assert.equal(noteFrequency(-12, 440), 220);
});

test("noteFrequency: a perfect fifth (+7 semitones) is close to a 3:2 ratio", () => {
  const fifth = noteFrequency(7, 440) / 440;
  assert.ok(Math.abs(fifth - 1.4983) < 0.001, `got ${fifth}`);
});

// --- advanceSequencer (pure lookahead scheduler) --------------------------------

const PATTERN: readonly PatternStep[] = [
  { semitone: 0, duration: 1 },
  { semitone: 4, duration: 2 },
  { semitone: null, duration: 1 },
];

test("advanceSequencer returns nothing when the lookahead window hasn't reached the next note", () => {
  const state = initSequencer(10);
  const r = advanceSequencer(state, PATTERN, 1, 9.5);
  assert.deepEqual(r.notes, []);
  assert.deepEqual(r.state, state);
});

test("advanceSequencer schedules exactly the notes due before `until`, at their exact times", () => {
  const state = initSequencer(0);
  // stepSeconds=1: note0 at t=0 (dur1), note1 at t=1 (dur2), note2(rest) at t=3 (dur1), loop.
  const r = advanceSequencer(state, PATTERN, 1, 3.5);
  assert.deepEqual(
    r.notes.map((n) => [n.time, n.step.semitone]),
    [
      [0, 0],
      [1, 4],
      [3, null],
    ],
  );
  assert.equal(r.state.nextTime, 4); // next loop start
  assert.equal(r.state.index, 3);
});

test("advanceSequencer resumes cleanly from a returned state (calling it repeatedly matches calling it once)", () => {
  const oneShot = advanceSequencer(initSequencer(0), PATTERN, 1, 10);
  let state = initSequencer(0);
  const notes = [];
  for (const until of [1.2, 2.5, 4.9, 7.3, 10]) {
    const r = advanceSequencer(state, PATTERN, 1, until);
    notes.push(...r.notes);
    state = r.state;
  }
  assert.deepEqual(notes, oneShot.notes);
  assert.deepEqual(state, oneShot.state);
});

test("advanceSequencer never schedules a note at or after `until`", () => {
  const r = advanceSequencer(initSequencer(0), PATTERN, 1, 3);
  assert.ok(r.notes.every((n) => n.time < 3));
});

test("advanceSequencer is a no-op on an empty pattern or a non-positive step length", () => {
  assert.deepEqual(advanceSequencer(initSequencer(0), [], 1, 100).notes, []);
  assert.deepEqual(advanceSequencer(initSequencer(0), PATTERN, 0, 100).notes, []);
  assert.deepEqual(advanceSequencer(initSequencer(0), PATTERN, -1, 100).notes, []);
});

// --- Section themes (pure data) --------------------------------------------------

test("every section has its own theme with a positive tempo and non-empty patterns", () => {
  for (const section of SECTIONS) {
    const theme = SECTION_THEMES[section];
    assert.ok(theme.rootHz > 0, section);
    assert.ok(theme.tempoBpm > 0, section);
    assert.ok(theme.lead.length > 0, section);
    assert.ok(theme.bass.length > 0, section);
  }
});

test("sections differ in key and/or tempo, not just in name (SPEC §15)", () => {
  const signatures = SECTIONS.map((s) => `${SECTION_THEMES[s].rootHz}@${SECTION_THEMES[s].tempoBpm}`);
  assert.equal(new Set(signatures).size, SECTIONS.length);
});

test("each section's lead and bass patterns sum to the same loop length", () => {
  for (const section of SECTIONS) {
    const theme = SECTION_THEMES[section];
    const sum = (pattern: readonly PatternStep[]) => pattern.reduce((total, step) => total + step.duration, 0);
    assert.equal(sum(theme.lead), sum(theme.bass), `${section}: lead/bass loop lengths differ`);
  }
});

// --- Engine defensiveness (no browser AudioContext available here) -------------

test("the audio engine never throws when Web Audio isn't available (e.g. this Node test run)", () => {
  const engine = createAudioEngine();
  assert.doesNotThrow(() => engine.resume());
  assert.doesNotThrow(() => engine.setMuted(true));
  assert.doesNotThrow(() => engine.setMuted(false));
  assert.doesNotThrow(() => engine.setSection("fire"));
  assert.doesNotThrow(() => engine.setSection("toxic"));
  assert.doesNotThrow(() =>
    engine.playEvents([
      { type: "jump" },
      { type: "land" },
      { type: "stomp", enemyId: 1, defeated: true, boss: false },
      { type: "bossHit", enemyId: 2, hp: 0, defeated: true },
      { type: "shoot", enemyId: 3, projectileType: "toxic" },
      { type: "death", cause: "spike" },
      { type: "doorUnlock" },
      { type: "complete", levelId: 1 },
      { type: "respawn" },
      { type: "victory" },
    ]),
  );
  assert.doesNotThrow(() => engine.dispose());
  // Calling everything again after dispose must also stay safe.
  assert.doesNotThrow(() => engine.resume());
  assert.doesNotThrow(() => engine.dispose());
});
