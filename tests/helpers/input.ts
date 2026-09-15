import { EMPTY_INPUT, type InputFrame } from '../../src/core/input';

export function input(partial: Partial<InputFrame> = {}): InputFrame {
  return { ...EMPTY_INPUT, ...partial };
}
