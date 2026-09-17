import type { Point } from '../stages/types';

export type Mode = 'normal' | 'hard';

export interface Checkpoint extends Point {
  globalSection: number;
  stageId: number;
  localSection: number;
}

export interface RunState {
  mode: Mode;
  checkpoint: Checkpoint;
  falls: number;
  elapsed: number;
  bestY: number;
  peakSinceLanding: number;
  stun: number;
  invulnerability: number;
}
