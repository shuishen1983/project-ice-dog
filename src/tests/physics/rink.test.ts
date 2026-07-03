import { describe, expect, it } from 'vitest';
import { RINK } from '../../sim/constants';
import { clampToRink } from '../../physics/rink';

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

  it('clamps positions to the corner arc instead of the rectangular corner', () => {
    const margin = 1.5;
    const squareCorner = clampToRink({ x: 99, y: 42 }, RINK, margin);
    const cornerCenter = { x: RINK.width / 2 - RINK.cornerRadius, y: RINK.height / 2 - RINK.cornerRadius };
    const separation = Math.hypot(squareCorner.x - cornerCenter.x, squareCorner.y - cornerCenter.y);

    expect(separation).toBeLessThanOrEqual(RINK.cornerRadius - margin + 1e-9);
  });

  it('leaves straight-board positions unchanged by the corner clamp', () => {
    const margin = 1.5;
    expect(clampToRink({ x: 0, y: 41 }, RINK, margin)).toEqual({ x: 0, y: 41 });
    expect(clampToRink({ x: 98.5, y: 0 }, RINK, margin)).toEqual({ x: 98.5, y: 0 });
  });
});
