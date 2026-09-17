const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function formatTime(seconds: number): string {
  const totalMs = Math.max(0, Math.floor(seconds * 1000 + 1e-6));
  const minutes = Math.floor(totalMs / 60_000);
  const secs = Math.floor(totalMs / 1000) % 60;
  const ms = totalMs % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function progressRatio(playerY: number, worldHeight: number): number {
  if (worldHeight <= 0) return 0;
  return clamp((worldHeight - playerY) / worldHeight, 0, 1);
}

export function stageProgressRatio(playerY: number, stageId: number, stageTop: number, stageBottom: number): number {
  const localProgress = progressRatio(playerY - stageTop, stageBottom - stageTop);
  return clamp((stageId - 1 + localProgress) / 10, 0, 1);
}
