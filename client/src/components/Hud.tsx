import type { Level } from "@/game/types";

/** Header: title, current level and a short control hint. */
export function Hud({ level }: { level: Level }) {
  return (
    <header className="flex w-full items-center justify-between gap-3 px-1 py-1 sm:py-2">
      <h1 className="shrink-0 font-game text-base font-bold tracking-tight text-slate-900 sm:text-xl">
        Stickman Physics
      </h1>
      <p className="min-w-0 truncate text-right font-game text-xs text-slate-700 sm:text-sm">
        <span className="font-bold text-slate-900">Level {level.id}</span>
        <span aria-hidden="true"> · </span>
        <span>{level.name}</span>
      </p>
      <p className="control-hint hidden shrink-0 text-xs text-slate-500 md:block">← → move · Space / ↑ jump</p>
    </header>
  );
}
