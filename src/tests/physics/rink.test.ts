import { describe, expect, it } from 'vitest';
import { RINK } from '../../sim/constants';

describe('rink geometry', () => {
  it('matches the spec rink dimensions', () => {
    expect(RINK.width).toBe(200);
    expect(RINK.height).toBe(85);
    expect(RINK.cornerRadius).toBe(28);
    expect(RINK.goalLineX).toBe(89);
    expect(RINK.goalMouthWidth).toBe(6);
    expect(RINK.creaseRadius).toBe(6);
    expect(RINK.blueLineX).toBe(25);
  });

  it('places the slot against each goal line per the spec', () => {
    for (const [side, sign] of [['home', -1], ['away', 1]] as const) {
      const slot = RINK.slot[side];
      const nearEdge = slot.x + (sign * slot.width) / 2;
      const farEdge = slot.x - (sign * slot.width) / 2;
      expect(nearEdge).toBe(sign * RINK.goalLineX);
      expect(Math.abs(farEdge)).toBe(RINK.goalLineX - 22);
      expect(slot.height).toBe(24);
    }
  });

  it('uses only the center faceoff spot in MVP', () => {
    expect(RINK.faceoffSpots).toEqual([{ id: 'center', position: { x: 0, y: 0 } }]);
  });
});
