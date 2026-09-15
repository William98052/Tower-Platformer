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

/** Moves on X first, then Y, clamping against solids on each axis. */
export function moveAndCollide(box: AABB, dx: number, dy: number, solids: readonly AABB[]): MoveResult {
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
    for (const s of solidsAt(x, y, w, h, solids)) {
      y = dy > 0 ? Math.min(y, s.y - h) : Math.max(y, s.y + s.h);
      hitY = true;
    }
  }

  return { x, y, hitX, hitY };
}

export function isTouching(box: AABB, offsetX: number, offsetY: number, solids: readonly AABB[]): boolean {
  return solidsAt(box.x + offsetX, box.y + offsetY, box.w, box.h, solids).length > 0;
}
