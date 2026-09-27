import { NO_INPUT, stepGame } from "../client/src/game/engine";
import { enemy, goal, ground, platform } from "../client/src/game/levelBuilders";
import type { GameState, InputState, Level, LevelProvider } from "../client/src/game/types";

export const RIGHT: InputState = { left: false, right: true, jumpPressed: false };
export const LEFT: InputState = { left: true, right: false, jumpPressed: false };
export const JUMP: InputState = { left: false, right: false, jumpPressed: true };
export { NO_INPUT };

export function makeLevel(overrides: Partial<Level> = {}): Level {
  return {
    id: 1,
    name: "Test",
    section: "core",
    difficulty: 1,
    platforms: [ground(0, 400)],
    spikes: [],
    enemies: [],
    goal: goal(360, 400),
    ...overrides,
  };
}

export function providerOf(...levels: Level[]): LevelProvider {
  return {
    getLevel: (id) => {
      const level = levels[id - 1];
      if (!level) throw new Error(`no level ${id}`);
      return level;
    },
    levelCount: levels.length,
  };
}

export function run(
  state: GameState,
  ticks: number,
  input: InputState | ((tick: number) => InputState) = NO_INPUT,
  provider?: LevelProvider,
): GameState {
  let s = state;
  for (let i = 0; i < ticks; i++) {
    s = stepGame(s, typeof input === "function" ? input(i) : input, provider).state;
  }
  return s;
}

export { enemy, goal, ground, platform };
