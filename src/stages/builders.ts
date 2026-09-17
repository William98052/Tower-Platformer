import type { EntityDef, SectionDef, SolidDef, SolidRole } from './types';

export const SECTION_HEIGHT = 700;
export const PLATFORM_THICKNESS = 16;

export function shell(height = SECTION_HEIGHT): SolidDef[] {
  return [
    { x: 0, y: 0, w: 24, h: height, surface: 'normal', role: 'boundary' },
    { x: 936, y: 0, w: 24, h: height, surface: 'normal', role: 'boundary' },
  ];
}

export function platform(
  x: number,
  y: number,
  w: number,
  surface: SolidDef['surface'] = 'normal',
  role: SolidRole = 'main',
  conveyorSpeed?: number,
): SolidDef {
  return { x, y, w, h: PLATFORM_THICKNESS, surface, role, ...(conveyorSpeed === undefined ? {} : { conveyorSpeed }) };
}

export function vine(x: number, y: number, h: number): SolidDef {
  return { x, y, w: 24, h, surface: 'vine', role: 'main' };
}

export function section(
  id: number,
  checkpointX: number,
  solids: SolidDef[],
  entities: EntityDef[],
): SectionDef {
  return {
    id,
    height: SECTION_HEIGHT,
    checkpoint: { x: checkpointX, y: 620 },
    solids: [...shell(), ...solids],
    entities,
  };
}
