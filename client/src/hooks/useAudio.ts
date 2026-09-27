import { useEffect, useRef } from "react";
import { createAudioEngine, type AudioEngine } from "@/game/audio";

/**
 * One AudioEngine per mount. Creating it has no side effects (no AudioContext
 * yet — see audio.ts), so the lazy-ref pattern is safe under StrictMode's
 * double-render; only `dispose()` on unmount touches anything real.
 */
export function useAudio(): AudioEngine {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = createAudioEngine();

  useEffect(() => {
    const engine = engineRef.current;
    return () => engine?.dispose();
  }, []);

  return engineRef.current;
}
