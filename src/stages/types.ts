import type { AABB } from '../physics/aabb';

export type SurfaceType =
  | 'normal'
  | 'oneWay'
  | 'vine'
  | 'bouncy'
  | 'slopeUp'
  | 'slopeDown'
  | 'conveyorLeft'
  | 'conveyorRight';
export type SolidRole = 'main' | 'recovery' | 'boundary';

export interface Point {
  x: number;
  y: number;
}

export interface SolidDef extends AABB {
  surface: SurfaceType;
  conveyorSpeed?: number;
  role?: SolidRole;
}

export type PromptId = 'jump' | 'wallJump' | 'dash';

export type EntityDef =
  | { type: 'mushroom'; x: number; y: number; w: number; h: number; launch: number }
  | { type: 'prompt'; x: number; y: number; w: number; h: number; prompt: PromptId }
  | { type: 'gear'; x: number; y: number; radius: number; period: 4 | 6; phase: number; paddleW: number }
  | { type: 'piston'; x: number; y: number; w: number; h: number; axis: 'x' | 'y'; travel: number; phase: number }
  | { type: 'timedDoor'; x: number; y: number; w: number; h: number; phase: number }
  | { type: 'water'; x: number; y: number; w: number; h: number; currentX: number; currentY: number }
  | { type: 'sinkingCrate'; x: number; y: number; w: number; h: number; sinkDistance: number }
  | { type: 'waterWheel'; x: number; y: number; radius: number; phase: number; paddleW: number; paddleH: number };

export interface SectionDef {
  id: number;
  height: number;
  checkpoint: Point;
  solids: SolidDef[];
  entities: EntityDef[];
}

export interface ThemeDef {
  skyTop: string;
  skyBottom: string;
  platform: string;
  edge: string;
  accent: string;
}

export interface StageDef {
  id: number;
  name: string;
  theme: ThemeDef;
  sections: SectionDef[];
}

export interface TowerDef {
  stages: StageDef[];
}

export interface WorldSection {
  globalIndex: number;
  stageId: number;
  stageName: string;
  localSection: number;
  theme: ThemeDef;
  /** Compatibility alias until gameplay migrates to global section identity. */
  id: number;
  top: number;
  bottom: number;
  height: number;
  checkpoint: Point;
  solids: SolidDef[];
  entities: EntityDef[];
}

export interface World {
  width: number;
  height: number;
  tower: TowerDef;
  /** Compatibility alias until gameplay reads its current stage from the tower. */
  stage: StageDef;
  sections: WorldSection[];
  solids: SolidDef[];
}
