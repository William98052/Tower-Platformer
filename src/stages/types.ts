import type { AABB } from '../physics/aabb';

export type SurfaceType = 'normal' | 'oneWay' | 'vine' | 'bouncy' | 'slopeUp' | 'slopeDown';

export interface Point {
  x: number;
  y: number;
}

export interface SolidDef extends AABB {
  surface: SurfaceType;
}

export type PromptId = 'jump' | 'wallJump' | 'dash';

export type EntityDef =
  | { type: 'mushroom'; x: number; y: number; w: number; h: number; launch: number }
  | { type: 'prompt'; x: number; y: number; w: number; h: number; prompt: PromptId };

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

export interface WorldSection {
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
  stage: StageDef;
  sections: WorldSection[];
  solids: SolidDef[];
}
