/**
 * One slot in the fixed projectile DOM pool (SPEC §11, §16 — shape and motion
 * distinguish types, not color alone). All three shapes are always present;
 * CSS shows only the one matching data-type. Position, size, type, facing and
 * visibility are all set imperatively by the game loop.
 */
export function Projectile({ slotRef }: { slotRef: (el: HTMLDivElement | null) => void }) {
  return (
    <div ref={slotRef} className="projectile" data-type="fire" data-active="false" data-dir="right">
      {/* Fire: round core with a trailing glow. */}
      <svg className="projectile-shape shape-fire" viewBox="-8 -8 16 16" preserveAspectRatio="none" aria-hidden="true">
        <ellipse className="fire-trail" cx="3" cy="0" rx="7" ry="3.2" />
        <circle className="fire-core" cx="-2" cy="0" r="5" />
      </svg>
      {/* Lightning: an elongated zig-zag bolt. */}
      <svg
        className="projectile-shape shape-lightning"
        viewBox="-14 -4.5 28 9"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polygon className="lightning-bolt" points="-14,-1.2 -5,-3.4 -8,0 10,3.4 1,1 5,-1.4" />
        <polygon className="lightning-core" points="-11,-0.6 -6,-1.8 -7.5,0 6,1.9 0,0.6 3,-0.7" />
      </svg>
      {/* Toxic: an irregular arcing blob. */}
      <svg className="projectile-shape shape-toxic" viewBox="-8 -8 16 16" preserveAspectRatio="none" aria-hidden="true">
        <path
          className="toxic-blob"
          d="M0,-7 C5,-7 8,-3 7,1 C6,6 2,8 -1,7 C-6,6 -8,1 -6,-4 C-5,-7 -2,-7 0,-7 Z"
        />
        <circle className="toxic-glow" cx="-1" cy="-1" r="2.4" />
      </svg>
    </div>
  );
}
