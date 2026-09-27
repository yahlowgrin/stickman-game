import { type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MAX_RENDERED_PROJECTILES } from "@/game/constants";
import { createGameState, getPlayerPose, isGoalLocked, playAgain as playAgainState, stepGame } from "@/game/engine";
import { createInputController, type InputController } from "@/game/input";
import { getLevel } from "@/game/levels";
import { advanceAccumulator } from "@/game/loop";
import type { GameEvent, GameState, GameStatus, Level } from "@/game/types";

/** The only game data mirrored into React state (SPEC §4). */
export type GameUiState = { levelId: number; status: GameStatus };

export type GameEngine = {
  ui: GameUiState;
  level: Level;
  input: InputController;
  playerRef: RefObject<HTMLDivElement | null>;
  goalRef: RefObject<HTMLDivElement | null>;
  registerEnemy: (id: number) => (el: HTMLDivElement | null) => void;
  registerProjectileSlot: (index: number) => (el: HTMLDivElement | null) => void;
  projectilePoolSize: number;
  playAgain: () => void;
};

type Options = {
  initialLevelId?: number;
  /** When true the simulation does not advance (e.g. menus open). */
  paused?: boolean;
  onEvents?: (events: GameEvent[], state: GameState) => void;
};

export function useGameEngine({ initialLevelId = 1, paused = false, onEvents }: Options = {}): GameEngine {
  const [initialState] = useState(() => createGameState(initialLevelId));
  const stateRef = useRef<GameState>(initialState);

  const [ui, setUi] = useState<GameUiState>({
    levelId: initialState.levelId,
    status: initialState.status,
  });
  const uiRef = useRef(ui);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;

  const input = useMemo(createInputController, []);
  const playerRef = useRef<HTMLDivElement>(null);
  const goalRef = useRef<HTMLDivElement>(null);
  const enemyEls = useRef(new Map<number, HTMLDivElement>());
  const projectileEls = useRef<(HTMLDivElement | null)[]>([]);

  const registerEnemy = useCallback(
    (id: number) => (el: HTMLDivElement | null) => {
      if (el) enemyEls.current.set(id, el);
      else enemyEls.current.delete(id);
    },
    [],
  );

  const registerProjectileSlot = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      projectileEls.current[index] = el;
    },
    [],
  );

  /** Write the current simulation state to the DOM without a React render. */
  const renderFrame = useCallback(() => {
    const state = stateRef.current;
    const playerEl = playerRef.current;
    if (playerEl) {
      const p = state.player;
      playerEl.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      playerEl.dataset.pose = getPlayerPose(state);
      playerEl.dataset.facing = p.facing === 1 ? "right" : "left";
    }
    for (const e of state.enemies) {
      const el = enemyEls.current.get(e.id);
      if (!el) continue;
      el.style.transform = `translate3d(${e.x}px, ${e.y}px, 0)`;
      el.dataset.dir = e.dir === 1 ? "right" : "left";
      el.dataset.alive = String(e.alive);
      el.dataset.invulnerable = String(e.invulnTicks > 0);
      el.dataset.charging = String(e.chargeTicks > 0);
      if (e.def.isBoss) {
        const pips = el.getElementsByClassName("hp-pip");
        for (let i = 0; i < pips.length; i++) pips[i].classList.toggle("filled", i < e.hp);
      }
    }

    const pool = projectileEls.current;
    const projectiles = state.projectiles;
    for (let i = 0; i < pool.length; i++) {
      const el = pool[i];
      if (!el) continue;
      const p = projectiles[i];
      if (!p) {
        el.dataset.active = "false";
        continue;
      }
      el.dataset.active = "true";
      el.dataset.type = p.type;
      el.dataset.dir = p.vx >= 0 ? "right" : "left";
      el.style.width = `${p.width}px`;
      el.style.height = `${p.height}px`;
      el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    }
    if (import.meta.env.DEV && projectiles.length > pool.length) {
      console.warn(
        `${projectiles.length} projectiles active, only ${pool.length} rendered (MAX_RENDERED_PROJECTILES)`,
      );
    }

    if (goalRef.current) goalRef.current.dataset.locked = String(isGoalLocked(state));
  }, []);

  const syncUi = useCallback(() => {
    const { levelId, status } = stateRef.current;
    if (uiRef.current.levelId !== levelId || uiRef.current.status !== status) {
      uiRef.current = { levelId, status };
      setUi(uiRef.current);
    }
  }, []);

  // Fixed-timestep loop driven by requestAnimationFrame.
  useEffect(() => {
    let rafId = 0;
    let lastTime: number | null = null;
    let accumulator = 0;

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      if (lastTime === null || pausedRef.current) {
        lastTime = now;
        accumulator = 0;
        return;
      }
      const advanced = advanceAccumulator(accumulator, now - lastTime);
      accumulator = advanced.accumulator;
      lastTime = now;
      for (let i = 0; i < advanced.steps; i++) {
        const result = stepGame(stateRef.current, input.consume());
        stateRef.current = result.state;
        if (result.events.length > 0) onEventsRef.current?.(result.events, result.state);
      }
      renderFrame();
      syncUi();
    };

    const start = () => {
      if (rafId !== 0) return;
      lastTime = null;
      rafId = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
      input.reset();
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [input, renderFrame, syncUi]);

  // Position freshly mounted entities immediately (new level, respawn).
  useLayoutEffect(renderFrame, [ui.levelId, ui.status, renderFrame]);

  const playAgain = useCallback(() => {
    stateRef.current = playAgainState();
    input.reset();
    syncUi();
  }, [input, syncUi]);

  const level = useMemo(() => getLevel(ui.levelId), [ui.levelId]);

  return {
    ui,
    level,
    input,
    playerRef,
    goalRef,
    registerEnemy,
    registerProjectileSlot,
    projectilePoolSize: MAX_RENDERED_PROJECTILES,
    playAgain,
  };
}
