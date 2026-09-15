/** Converts variable frame times into a whole number of fixed physics steps. */
export class FixedStep {
  /** Fraction of a step left over, used to interpolate rendering. */
  alpha = 0;
  private accumulator = 0;

  constructor(
    readonly step: number,
    readonly maxFrame: number,
  ) {}

  /** Adds frame time and returns how many physics steps to run now. */
  advance(frameDt: number): number {
    this.accumulator += Math.min(Math.max(frameDt, 0), this.maxFrame);
    // Small epsilon so 1/60 counts as exactly two 1/120 steps despite float error.
    const steps = Math.floor(this.accumulator / this.step + 1e-9);
    this.accumulator = Math.max(0, this.accumulator - steps * this.step);
    this.alpha = Math.min(this.accumulator / this.step, 0.999999);
    return steps;
  }
}
