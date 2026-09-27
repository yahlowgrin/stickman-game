import assert from "node:assert/strict";
import { test } from "node:test";
import { TOTAL_LEVELS } from "../client/src/game/constants";
import {
  DEFAULT_PROGRESS,
  loadProgress,
  saveProgress,
  type StorageLike,
  unlockedAfterCompleting,
} from "../client/src/game/persistence";

/** A tiny in-memory stand-in for localStorage, with an optional failure mode. */
function fakeStorage(opts: { throwOnGet?: boolean; throwOnSet?: boolean } = {}): StorageLike & {
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => {
      if (opts.throwOnGet) throw new Error("storage blocked");
      return store.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (opts.throwOnSet) throw new Error("storage full");
      store.set(key, value);
    },
  };
}

test("loadProgress returns defaults when nothing is saved", () => {
  assert.deepEqual(loadProgress(fakeStorage()), DEFAULT_PROGRESS);
});

test("loadProgress returns defaults when storage itself is unavailable (null)", () => {
  assert.deepEqual(loadProgress(null), DEFAULT_PROGRESS);
});

test("saveProgress then loadProgress round-trips", () => {
  const storage = fakeStorage();
  saveProgress({ unlockedLevel: 42, muted: true }, storage);
  assert.deepEqual(loadProgress(storage), { unlockedLevel: 42, muted: true });
});

test("mute preference persists independently of level progress", () => {
  const storage = fakeStorage();
  saveProgress({ unlockedLevel: 5, muted: false }, storage);
  saveProgress({ unlockedLevel: 5, muted: true }, storage);
  assert.deepEqual(loadProgress(storage), { unlockedLevel: 5, muted: true });
});

test("corrupted JSON falls back to defaults instead of throwing", () => {
  const storage = fakeStorage();
  storage.store.set("stickman-physics:progress:v1", "{not json");
  assert.deepEqual(loadProgress(storage), DEFAULT_PROGRESS);
});

test("an out-of-range or non-numeric saved level is clamped, not trusted", () => {
  const storage = fakeStorage();
  storage.store.set("stickman-physics:progress:v1", JSON.stringify({ unlockedLevel: 99999, muted: false }));
  assert.equal(loadProgress(storage).unlockedLevel, TOTAL_LEVELS);
  storage.store.set("stickman-physics:progress:v1", JSON.stringify({ unlockedLevel: "nope", muted: false }));
  assert.equal(loadProgress(storage).unlockedLevel, 1);
});

test("a storage that throws (private browsing, full disk) never crashes save or load", () => {
  const broken = fakeStorage({ throwOnGet: true, throwOnSet: true });
  assert.doesNotThrow(() => saveProgress({ unlockedLevel: 3, muted: true }, broken));
  assert.deepEqual(loadProgress(broken), DEFAULT_PROGRESS);
});

test("unlockedAfterCompleting advances by one and never regresses or exceeds TOTAL_LEVELS", () => {
  assert.equal(unlockedAfterCompleting(1, 1), 2);
  assert.equal(unlockedAfterCompleting(5, 1), 5, "replaying an earlier level doesn't lower progress");
  assert.equal(unlockedAfterCompleting(TOTAL_LEVELS, TOTAL_LEVELS), TOTAL_LEVELS);
});
