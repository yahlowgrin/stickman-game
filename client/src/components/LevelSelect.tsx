import { useEffect } from "react";
import { Lock, X } from "lucide-react";
import { SECTION_LABELS, SECTION_RANGES, isBossLevel } from "@/game/sections";
import type { Section } from "@/game/types";

const SECTIONS: readonly Section[] = ["core", "fire", "speed", "lightning", "toxic"];

type Props = {
  unlockedLevel: number;
  currentLevelId: number;
  onSelect: (id: number) => void;
  onClose: () => void;
};

/** Full-screen level-select grid, grouped by section; only unlocked levels are selectable (SPEC §12). */
export function LevelSelect({ unlockedLevel, currentLevelId, onSelect, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // The backdrop closes the dialog on click; the panel stops that click from bubbling.
    <div className="level-select-backdrop" role="presentation" onClick={onClose}>
      <div
        className="level-select-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Select level"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="level-select-header">
          <h2 className="level-select-title">Select a Level</h2>
          <button type="button" className="level-select-close" aria-label="Close level select" onClick={onClose}>
            <X size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
        <div className="level-select-scroll">
          {SECTIONS.map((section) => {
            const [first, last] = SECTION_RANGES[section];
            return (
              <section key={section} className="level-select-section">
                <h3 className="level-select-section-title">
                  {SECTION_LABELS[section]} <span className="level-select-range">· {first}–{last}</span>
                </h3>
                <div className="level-select-grid">
                  {Array.from({ length: last - first + 1 }, (_, i) => {
                    const id = first + i;
                    const unlocked = id <= unlockedLevel;
                    const boss = isBossLevel(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className="level-tile"
                        data-current={String(id === currentLevelId)}
                        data-boss={String(boss)}
                        disabled={!unlocked}
                        aria-label={
                          unlocked
                            ? `Level ${id}${boss ? ", boss level" : ""}${id === currentLevelId ? " (current)" : ""}`
                            : `Level ${id}, locked`
                        }
                        onClick={() => onSelect(id)}
                      >
                        {unlocked ? id : <Lock size={13} strokeWidth={2.5} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
