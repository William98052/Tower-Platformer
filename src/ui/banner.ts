const SLIDE_TIME = 0.35;
const HOLD_TIME = 2.5;
const TOTAL_TIME = SLIDE_TIME * 2 + HOLD_TIME;
const HIDDEN_OFFSET = 520;

const ease = (value: number): number => value * value * (3 - 2 * value);

export class StageBanner {
  stageNumber = 0;
  stageName = '';
  elapsed = TOTAL_TIME;

  enter(stageNumber: number, stageName: string): void {
    this.stageNumber = stageNumber;
    this.stageName = stageName;
    this.elapsed = 0;
  }

  label(): { stage: number; name: string } {
    return { stage: this.stageNumber, name: this.stageName };
  }

  update(dt: number): void {
    this.elapsed = Math.min(TOTAL_TIME, this.elapsed + Math.max(0, dt));
  }

  get visible(): boolean {
    return this.elapsed < TOTAL_TIME;
  }

  get offsetX(): number {
    if (this.elapsed < SLIDE_TIME) return -HIDDEN_OFFSET * (1 - ease(this.elapsed / SLIDE_TIME));
    const slideOutStart = SLIDE_TIME + HOLD_TIME;
    if (this.elapsed <= slideOutStart) return 0;
    return HIDDEN_OFFSET * ease(Math.min(1, (this.elapsed - slideOutStart) / SLIDE_TIME));
  }
}
