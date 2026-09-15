import type { StepEvents } from '../physics/player';
import type { PromptId } from '../stages/types';

export interface PromptState {
  active: PromptId | null;
  completed: Set<PromptId>;
}

export function createPromptState(completed: Iterable<PromptId> = []): PromptState {
  return { active: null, completed: new Set(completed) };
}

export function showPrompt(state: PromptState, id: PromptId): boolean {
  if (state.completed.has(id)) return false;
  state.active = id;
  return true;
}

export function completePromptsFromEvents(state: PromptState, events: StepEvents): PromptId | null {
  const id = events.wallJumped ? 'wallJump' : events.dashed ? 'dash' : events.jumped ? 'jump' : null;
  if (id === null || state.active !== id) return null;
  state.completed.add(id);
  state.active = null;
  return id;
}

export function promptCopy(id: PromptId): string {
  switch (id) {
    case 'jump': return 'Jump — Space / C';
    case 'wallJump': return 'Wall jump — Hold toward wall + Space / C';
    case 'dash': return 'Dash — Shift / X';
  }
}
