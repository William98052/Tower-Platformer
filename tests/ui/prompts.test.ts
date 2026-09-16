import { describe, expect, it } from 'vitest';
import { completePromptsFromEvents, createPromptState, promptCopy, showPrompt } from '../../src/ui/prompts';

describe('move prompts', () => {
  it('initializes already completed prompts without exposing the input collection', () => {
    const completed = ['dash'] as const;
    const state = createPromptState(completed);
    expect(showPrompt(state, 'dash')).toBe(false);
    state.completed.add('jump');
    expect(completed).toEqual(['dash']);
  });

  it('shows a prompt once and completes it from the matching movement event', () => {
    const state = createPromptState();
    expect(showPrompt(state, 'wallJump')).toBe(true);
    expect(state.active).toBe('wallJump');
    completePromptsFromEvents(state, { jumped: false, wallJumped: true, dashed: false, landed: 0 });
    expect(state.active).toBeNull();
    expect(state.completed.has('wallJump')).toBe(true);
    expect(showPrompt(state, 'wallJump')).toBe(false);
  });

  it('does not complete a prompt from a different move', () => {
    const state = createPromptState();
    showPrompt(state, 'dash');
    completePromptsFromEvents(state, { jumped: true, wallJumped: false, dashed: false, landed: 0 });
    expect(state.active).toBe('dash');
  });

  it('uses the approved concise control copy', () => {
    expect(promptCopy('jump')).toBe('Jump — Space / C');
    expect(promptCopy('wallJump')).toBe('Wall jump — Hold toward wall + Space / C');
    expect(promptCopy('dash')).toBe('Dash — Shift / X');
  });
});
