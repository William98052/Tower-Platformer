import { VIEW_H, VIEW_W } from '../core/constants';
import type { RunState } from '../modes/run-state';
import type { StageBanner } from './banner';
import { formatTime, progressRatio } from './hud';
import type { PromptState } from './prompts';
import { promptCopy } from './prompts';

export function drawHud(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  playerY: number,
  worldHeight: number,
  stageName: string,
): void {
  ctx.save();
  ctx.font = '600 15px ui-monospace, Menlo, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(8, 14, 12, 0.68)';
  ctx.fillRect(VIEW_W - 190, 16, 174, 48);
  ctx.fillStyle = '#eef5d8';
  ctx.fillText(formatTime(run.elapsed), VIEW_W - 26, 23);
  ctx.fillStyle = '#b8c6aa';
  ctx.fillText(`${run.falls} FALL${run.falls === 1 ? '' : 'S'} · ${run.mode.toUpperCase()}`, VIEW_W - 26, 44);

  const barX = 20;
  const barY = 64;
  const barH = VIEW_H - 128;
  ctx.fillStyle = 'rgba(8, 14, 12, 0.6)';
  ctx.fillRect(12, barY - 12, 24, barH + 24);
  ctx.fillStyle = '#536158';
  ctx.fillRect(barX - 1, barY, 2, barH);
  for (let i = 0; i <= 10; i++) ctx.fillRect(barX - 4, barY + barH - i * barH / 10, 8, 1);
  const dotY = barY + barH * (1 - progressRatio(playerY, worldHeight));
  ctx.fillStyle = '#f2dda6';
  ctx.beginPath();
  ctx.arc(barX, dotY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(8, 14, 12, 0.64)';
  ctx.fillRect(16, VIEW_H - 48, 190, 32);
  ctx.fillStyle = '#d6e5b7';
  ctx.fillText(stageName.toUpperCase(), 28, VIEW_H - 40);
  ctx.restore();
}

export function drawPrompt(ctx: CanvasRenderingContext2D, prompt: PromptState): void {
  if (prompt.active === null) return;
  const text = promptCopy(prompt.active);
  ctx.save();
  ctx.font = '600 16px system-ui, sans-serif';
  const width = Math.max(260, ctx.measureText(text).width + 48);
  const x = (VIEW_W - width) / 2;
  ctx.fillStyle = 'rgba(10, 17, 14, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x, 34, width, 54, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(188, 217, 140, 0.7)';
  ctx.stroke();
  ctx.fillStyle = '#eef5d8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, VIEW_W / 2, 61);
  ctx.restore();
}

export function drawStageBanner(ctx: CanvasRenderingContext2D, banner: StageBanner): void {
  if (!banner.visible) return;
  ctx.save();
  ctx.translate(banner.offsetX, 0);
  ctx.fillStyle = 'rgba(8, 14, 12, 0.78)';
  ctx.fillRect(180, 190, 600, 142);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a8c883';
  ctx.font = '600 18px ui-monospace, Menlo, monospace';
  ctx.fillText(`STAGE ${banner.stageNumber}`, VIEW_W / 2, 232);
  ctx.fillStyle = '#eef5d8';
  ctx.font = '700 42px system-ui, sans-serif';
  ctx.fillText(banner.stageName.toUpperCase(), VIEW_W / 2, 286);
  ctx.restore();
}
