import { describe, expect, it } from 'vitest';
import { StageBanner } from '../../src/ui/banner';

describe('StageBanner', () => {
  it('slides in, holds for 2.5 seconds, and slides out', () => {
    const banner = new StageBanner();
    banner.enter(1, 'Moss Ruins');
    expect(banner.visible).toBe(true);
    expect(banner.offsetX).toBeLessThan(0);
    banner.update(0.35);
    expect(banner.offsetX).toBeCloseTo(0);
    banner.update(2.49);
    expect(banner.offsetX).toBeCloseTo(0);
    banner.update(0.36);
    expect(banner.visible).toBe(false);
  });

  it('restarts when a stage is entered again', () => {
    const banner = new StageBanner();
    banner.enter(1, 'Moss Ruins');
    banner.update(2);
    banner.enter(1, 'Moss Ruins');
    expect(banner.elapsed).toBe(0);
    expect(banner.stageName).toBe('Moss Ruins');
  });

  it('reports the current stage label for gameplay consumers', () => {
    const banner = new StageBanner();
    banner.enter(2, 'Clockwork Hall');
    expect(banner.label()).toEqual({ stage: 2, name: 'Clockwork Hall' });
  });
});
