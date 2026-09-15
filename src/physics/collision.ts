import { type AABB, overlaps } from './aabb';

export interface MoveResult {
  x: number;
  y: number;
  hitX: boolean;
  hitY: boolean;
}

function solidsAt(x: number, y: number, w: number, h: number, solids: readonly AABB[]): AABB[] {
  const probe = { x, y, w, h };
  return solids.filter((s) => overlaps(probe, s));
}

/**
 * Moves on X first, then Y, clamping against solids on each axis.
 * When moving up into a ceiling, tries sliding up to `cornerCorrection`
 * units sideways (never against the horizontal movement) to clear the corner
 * before giving up. Only the target position is checked for clearance.
 *
 * Assumes the box starts clear of every solid, moves less than its own size per call,
 * and solids use integer coordinates (so clamped edges compare exactly in floating point).
 */
export function moveAndCollide(
  box: AABB,
  dx: number,
  dy: number,
  solids: readonly AABB[],
  cornerCorrection = 0,
): MoveResult {
  const { w, h } = box;

  let x = box.x + dx;
  let hitX = false;
  if (dx !== 0) {
    for (const s of solidsAt(x, box.y, w, h, solids)) {
      x = dx > 0 ? Math.min(x, s.x - w) : Math.max(x, s.x + s.w);
      hitX = true;
    }
  }

  let y = box.y + dy;
  let hitY = false;
  if (dy !== 0) {
    let blockers = solidsAt(x, y, w, h, solids);
    if (blockers.length > 0 && dy < 0 && cornerCorrection > 0) {
      const nudge = findCornerNudge(x, y, w, h, solids, cornerCorrection, dx);
      if (nudge !== 0) {
        x += nudge;
        blockers = [];
      }
    }
    for (const s of blockers) {
      y = dy > 0 ? Math.min(y, s.y - h) : Math.max(y, s.y + s.h);
      hitY = true;
    }
  }

  return { x, y, hitX, hitY };
}

/** Smallest sideways offset (≤ maxNudge) that clears the ceiling, never opposing horizontal movement. */
function findCornerNudge(
  x: number,
  y: number,
  w: number,
  h: number,
  solids: readonly AABB[],
  maxNudge: number,
  dx: number,
): number {
  for (let k = 1; k <= maxNudge; k++) {
    if (dx >= 0 && solidsAt(x + k, y, w, h, solids).length === 0) return k;
    if (dx <= 0 && solidsAt(x - k, y, w, h, solids).length === 0) return -k;
  }
  return 0;
}

export function isTouching(box: AABB, offsetX: number, offsetY: number, solids: readonly AABB[]): boolean {
  const probe = { x: box.x + offsetX, y: box.y + offsetY, w: box.w, h: box.h };
  return solids.some((s) => overlaps(probe, s));
}
