// Small Web Audio sound engine (SPEC §15). No audio files: music is generated
// from short repeating note patterns, effects are synthesized oscillator
// blips. The lookahead scheduler's timing math (advanceSequencer) is pure and
// unit tested; everything that touches a real AudioContext is defensive
// (wrapped in try/catch, never throws) so a browser without Web Audio, or a
// Node test environment with no `window` at all, degrades to silence instead
// of crashing the game.

import type { GameEvent, ProjectileType, Section } from "./types";

// ---------------------------------------------------------------------------
// Music data (pure)
// ---------------------------------------------------------------------------

/** One step in a pattern: a semitone offset from the section's root, or a rest. */
export type PatternStep = { semitone: number | null; duration: number };

export type SectionTheme = {
  rootHz: number;
  tempoBpm: number;
  /** Square-wave melody, one bar (sums to the same step count as `bass`). */
  lead: readonly PatternStep[];
  /** Triangle-wave bass, one bar. */
  bass: readonly PatternStep[];
};

function s(semitone: number | null, duration = 1): PatternStep {
  return { semitone, duration };
}

/** A distinct key + tempo + riff per section (SPEC §15: "a different loop... per section"). */
export const SECTION_THEMES: Record<Section, SectionTheme> = {
  core: {
    rootHz: 392.0, // G4
    tempoBpm: 140,
    lead: [s(0), s(4), s(7), s(4), s(0), s(4), s(7), s(12), s(7), s(4), s(0), s(4), s(7), s(4), s(0), s(null)],
    bass: [s(0, 4), s(0, 4), s(7, 4), s(7, 4)],
  },
  fire: {
    rootHz: 440.0, // A4
    tempoBpm: 160,
    lead: [s(0), s(7), s(12), s(7), s(0), s(7), s(12), s(16), s(12), s(7), s(4), s(7), s(12), s(7), s(4), s(null)],
    bass: [s(0, 4), s(7, 4), s(0, 4), s(7, 4)],
  },
  speed: {
    rootHz: 523.25, // C5
    tempoBpm: 176,
    lead: [s(0), s(0), s(7), s(7), s(12), s(12), s(7), s(7), s(0), s(0), s(4), s(4), s(7), s(7), s(12), s(null)],
    bass: [s(0, 4), s(0, 4), s(7, 4), s(0, 4)],
  },
  lightning: {
    rootHz: 349.23, // F4
    tempoBpm: 150,
    lead: [s(0), s(3), s(7), s(10), s(7), s(3), s(0), s(null), s(0), s(6), s(7), s(10), s(7), s(6), s(3), s(null)],
    bass: [s(0, 4), s(0, 4), s(3, 4), s(3, 4)],
  },
  ice: {
    rootHz: 587.33, // D5 -- bright and crisp, distinct from lightning's cyan energy
    tempoBpm: 135,
    lead: [s(0), s(4), s(7), s(11), s(7), s(4), s(0), s(null), s(4), s(7), s(12), s(11), s(7), s(4), s(0), s(null)],
    bass: [s(0, 4), s(7, 4), s(4, 4), s(7, 4)],
  },
  toxic: {
    rootHz: 311.13, // Eb4
    tempoBpm: 128,
    lead: [s(0), s(3), s(7), s(3), s(0, 2), s(3), s(7), s(10), s(7, 2), s(3), s(0), s(3, 2), s(null)],
    bass: [s(0, 4), s(7, 4), s(3, 4), s(7, 4)],
  },
};

/** Equal-tempered frequency `semitone` steps away from `rootHz`. */
export function noteFrequency(semitone: number, rootHz: number): number {
  return rootHz * Math.pow(2, semitone / 12);
}

// ---------------------------------------------------------------------------
// Lookahead scheduler (pure — no AudioContext)
// ---------------------------------------------------------------------------

export type SequencerState = { index: number; nextTime: number };

export function initSequencer(startTime: number): SequencerState {
  return { index: 0, nextTime: startTime };
}

export type ScheduledNote = { time: number; step: PatternStep };

/**
 * Advances a pattern sequencer, returning every note due to start before
 * `until` (schedule-ahead style: SPEC §15 — real note times come from
 * `AudioContext.currentTime`, not from when this function happens to run).
 */
export function advanceSequencer(
  state: SequencerState,
  pattern: readonly PatternStep[],
  stepSeconds: number,
  until: number,
): { notes: ScheduledNote[]; state: SequencerState } {
  if (pattern.length === 0 || stepSeconds <= 0) return { notes: [], state };
  const notes: ScheduledNote[] = [];
  let { index, nextTime } = state;
  while (nextTime < until) {
    const step = pattern[index % pattern.length];
    notes.push({ time: nextTime, step });
    nextTime += stepSeconds * step.duration;
    index++;
  }
  return { notes, state: { index, nextTime } };
}

// ---------------------------------------------------------------------------
// Engine (impure — the only part that touches AudioContext)
// ---------------------------------------------------------------------------

const MASTER_VOLUME = 0.55;
const MUTE_RAMP_SECONDS = 0.05;
const SECTION_FADE_SECONDS = 0.12;
const LOOKAHEAD_SECONDS = 0.15;
const SCHEDULER_INTERVAL_MS = 30;
const LEAD_GAIN = 0.05;
const BASS_GAIN = 0.07;

export type AudioEngine = {
  /** Create/resume the AudioContext. Call only from a user gesture (SPEC §15). */
  resume: () => void;
  setMuted: (muted: boolean) => void;
  setSection: (section: Section) => void;
  /** Play sound effects for a tick's events (SPEC §11/§15 event list). */
  playEvents: (events: GameEvent[]) => void;
  /** Stop the scheduler, remove listeners, close the context. */
  dispose: () => void;
};

type ToneOptions = {
  type: OscillatorType;
  freq: number;
  startTime: number;
  duration: number;
  gain: number;
  freqRampTo?: number;
};

export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let musicGain: GainNode | null = null;
  let sfxGain: GainNode | null = null;
  let schedulerId: ReturnType<typeof setInterval> | null = null;
  let visibilityHandler: (() => void) | null = null;
  let muted = false;
  let section: Section = "core";
  let leadState: SequencerState | null = null;
  let bassState: SequencerState | null = null;

  function playTone(destination: GainNode, opts: ToneOptions): void {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, opts.startTime);
    if (opts.freqRampTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqRampTo), opts.startTime + opts.duration);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, opts.startTime);
    // Quick linear attack avoids a click; exponential decay sounds more natural than linear.
    gain.gain.linearRampToValueAtTime(opts.gain, opts.startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.startTime + opts.duration);
    osc.connect(gain).connect(destination);
    osc.start(opts.startTime);
    osc.stop(opts.startTime + opts.duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  function tick(): void {
    if (!ctx || !musicGain || !leadState || !bassState) return;
    const theme = SECTION_THEMES[section];
    const stepSeconds = 60 / theme.tempoBpm / 4; // sixteenth notes
    const until = ctx.currentTime + LOOKAHEAD_SECONDS;

    const lead = advanceSequencer(leadState, theme.lead, stepSeconds, until);
    leadState = lead.state;
    for (const n of lead.notes) {
      if (n.step.semitone === null) continue;
      playTone(musicGain, {
        type: "square",
        freq: noteFrequency(n.step.semitone, theme.rootHz),
        startTime: n.time,
        duration: stepSeconds * n.step.duration * 0.85,
        gain: LEAD_GAIN,
      });
    }

    const bass = advanceSequencer(bassState, theme.bass, stepSeconds, until);
    bassState = bass.state;
    for (const n of bass.notes) {
      if (n.step.semitone === null) continue;
      playTone(musicGain, {
        type: "triangle",
        freq: noteFrequency(n.step.semitone - 12, theme.rootHz),
        startTime: n.time,
        duration: stepSeconds * n.step.duration * 0.9,
        gain: BASS_GAIN,
      });
    }
  }

  function ensureContext(): AudioContext {
    if (ctx) return ctx;
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const created = new Ctor();

    const master = created.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(created.destination);

    const music = created.createGain();
    music.gain.value = 1;
    music.connect(master);

    const sfx = created.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);

    ctx = created;
    masterGain = master;
    musicGain = music;
    sfxGain = sfx;

    visibilityHandler = () => {
      if (!ctx) return;
      const action = document.hidden ? ctx.suspend() : ctx.resume();
      action.catch((err: unknown) => console.warn("Failed to change AudioContext suspend state:", err));
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    return created;
  }

  function resume(): void {
    try {
      const c = ensureContext();
      if (c.state === "suspended") {
        c.resume().catch((err: unknown) => console.warn("Failed to resume AudioContext:", err));
      }
      if (schedulerId === null) {
        const startAt = c.currentTime + 0.05;
        leadState = initSequencer(startAt);
        bassState = initSequencer(startAt);
        schedulerId = setInterval(tick, SCHEDULER_INTERVAL_MS);
        tick();
      }
    } catch (err) {
      console.warn("Web Audio is unavailable; continuing without sound:", err);
    }
  }

  function setMuted(next: boolean): void {
    muted = next;
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(next ? 0 : MASTER_VOLUME, now + MUTE_RAMP_SECONDS);
  }

  function setSection(next: Section): void {
    if (next === section) return;
    section = next;
    if (!ctx || !musicGain) return;
    const now = ctx.currentTime;
    // Fade the old loop out and the new one in, and restart the sequencers on
    // the new theme right as the fade-in begins, so the two loops never overlap.
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(0, now + SECTION_FADE_SECONDS);
    musicGain.gain.linearRampToValueAtTime(1, now + SECTION_FADE_SECONDS * 2);
    const restartAt = now + SECTION_FADE_SECONDS * 1.5;
    leadState = initSequencer(restartAt);
    bassState = initSequencer(restartAt);
  }

  function playStomp(destination: GainNode, time: number, defeated: boolean): void {
    playTone(destination, { type: "square", freq: 520, freqRampTo: 180, startTime: time, duration: 0.09, gain: 0.06 });
    if (defeated) {
      playTone(destination, { type: "square", freq: 880, startTime: time + 0.07, duration: 0.06, gain: 0.045 });
    }
  }

  function playBossHit(destination: GainNode, time: number, defeated: boolean): void {
    playTone(destination, { type: "sawtooth", freq: 300, freqRampTo: 90, startTime: time, duration: 0.16, gain: 0.07 });
    if (defeated) {
      playTone(destination, { type: "square", freq: 660, startTime: time + 0.1, duration: 0.14, gain: 0.05 });
    }
  }

  function playShoot(destination: GainNode, time: number, type: ProjectileType): void {
    if (type === "fire") {
      playTone(destination, { type: "square", freq: 260, freqRampTo: 140, startTime: time, duration: 0.07, gain: 0.04 });
    } else if (type === "lightning") {
      playTone(destination, { type: "square", freq: 1200, freqRampTo: 700, startTime: time, duration: 0.04, gain: 0.045 });
    } else if (type === "ice") {
      // Bright, glassy chime -- distinct from toxic's low squelch.
      playTone(destination, { type: "triangle", freq: 1400, freqRampTo: 1000, startTime: time, duration: 0.06, gain: 0.04 });
    } else {
      playTone(destination, { type: "triangle", freq: 170, freqRampTo: 110, startTime: time, duration: 0.09, gain: 0.04 });
    }
  }

  /** Descending icy chime + a short shimmer, played when an ice ball freezes the player. */
  function playFreeze(destination: GainNode, time: number): void {
    playTone(destination, { type: "triangle", freq: 1046.5, freqRampTo: 523.25, startTime: time, duration: 0.3, gain: 0.06 });
    playTone(destination, { type: "sine", freq: 1568.0, startTime: time + 0.05, duration: 0.2, gain: 0.03 });
  }

  function playEvents(events: GameEvent[]): void {
    if (!ctx || !sfxGain || muted) return;
    const dest = sfxGain;
    const now = ctx.currentTime;
    // A boss stomp emits both "stomp" and "bossHit" for the same hit; the
    // boss-specific sound below takes precedence over the generic stomp sound.
    const bossHitIds = new Set(events.filter((e) => e.type === "bossHit").map((e) => e.enemyId));

    for (const event of events) {
      switch (event.type) {
        case "jump":
          playTone(dest, { type: "square", freq: 440, freqRampTo: 660, startTime: now, duration: 0.08, gain: 0.05 });
          break;
        case "land":
          playTone(dest, { type: "sine", freq: 110, freqRampTo: 70, startTime: now, duration: 0.05, gain: 0.03 });
          break;
        case "stomp":
          if (!bossHitIds.has(event.enemyId)) playStomp(dest, now, event.defeated);
          break;
        case "bossHit":
          playBossHit(dest, now, event.defeated);
          break;
        case "shoot":
          playShoot(dest, now, event.projectileType);
          break;
        case "freeze":
          playFreeze(dest, now);
          break;
        case "death":
          playTone(dest, { type: "sawtooth", freq: 300, freqRampTo: 60, startTime: now, duration: 0.28, gain: 0.07 });
          break;
        case "doorUnlock":
          playTone(dest, { type: "square", freq: 523.25, startTime: now, duration: 0.12, gain: 0.06 });
          playTone(dest, { type: "square", freq: 784.0, startTime: now + 0.1, duration: 0.18, gain: 0.06 });
          break;
        case "complete":
          playTone(dest, { type: "square", freq: 523.25, startTime: now, duration: 0.1, gain: 0.06 });
          playTone(dest, { type: "square", freq: 659.25, startTime: now + 0.09, duration: 0.1, gain: 0.06 });
          playTone(dest, { type: "square", freq: 784.0, startTime: now + 0.18, duration: 0.2, gain: 0.06 });
          break;
        default:
          break; // respawn, levelStart, victory: no dedicated effect
      }
    }
  }

  function dispose(): void {
    if (schedulerId !== null) {
      clearInterval(schedulerId);
      schedulerId = null;
    }
    if (visibilityHandler) {
      document.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = null;
    }
    if (ctx) {
      ctx.close().catch((err: unknown) => console.warn("Failed to close AudioContext:", err));
    }
    ctx = null;
    masterGain = null;
    musicGain = null;
    sfxGain = null;
    leadState = null;
    bassState = null;
  }

  return { resume, setMuted, setSection, playEvents, dispose };
}
