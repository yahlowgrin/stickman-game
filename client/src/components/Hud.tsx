import { LayoutGrid, Volume2, VolumeX } from "lucide-react";
import type { Level } from "@/game/types";

type Props = {
  level: Level;
  muted: boolean;
  onToggleMute: () => void;
  onOpenLevelSelect: () => void;
};

/** Header: title, current level, control hint, level-select and mute buttons. */
export function Hud({ level, muted, onToggleMute, onOpenLevelSelect }: Props) {
  return (
    <header className="flex w-full items-center justify-between gap-2 px-1 py-1 sm:py-2">
      <h1 className="shrink-0 font-game text-base font-bold tracking-tight text-slate-900 sm:text-xl">
        Stickman Physics
      </h1>
      <p className="min-w-0 flex-1 truncate text-right font-game text-xs text-slate-700 sm:text-sm">
        <span className="font-bold text-slate-900">Level {level.id}</span>
        <span aria-hidden="true"> · </span>
        <span>{level.name}</span>
      </p>
      <p className="control-hint hidden shrink-0 text-xs text-slate-500 md:block">← → move · Space / ↑ jump</p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="hud-icon-button"
          aria-label="Select level"
          onClick={onOpenLevelSelect}
        >
          <LayoutGrid size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="hud-icon-button hud-mute-button"
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
          onClick={onToggleMute}
        >
          {muted ? (
            <VolumeX size={18} strokeWidth={2.25} aria-hidden="true" />
          ) : (
            <Volume2 size={18} strokeWidth={2.25} aria-hidden="true" />
          )}
          <span className="hud-mute-label">{muted ? "Unmute" : "Mute"}</span>
        </button>
      </div>
    </header>
  );
}
