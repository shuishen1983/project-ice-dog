import type { RinkGeometry } from '../physics/rink';

export const TICK_RATE = 60;
export const TICK_SECONDS = 1 / TICK_RATE;

export const PERIOD_COUNT = 3;
export const PERIOD_SECONDS = 180;

export const RINK: RinkGeometry = {
  width: 200,
  height: 85,
  cornerRadius: 28,
  goalLineX: 89,
  goalMouthWidth: 6,
  creaseRadius: 6,
  blueLineX: 25,
  slot: {
    home: { x: -78, y: 0, width: 22, height: 24 },
    away: { x: 78, y: 0, width: 22, height: 24 },
  },
  faceoffSpots: [{ id: 'center', position: { x: 0, y: 0 } }],
};

export const SKATER = {
  acceleration: 36,
  glideDecel: 20,
  maxSpeed: 28,
  carrierSpeedFactor: 0.9,
  radius: 1.5,
};

export const GOALIE = {
  radius: 1.5,
  creaseOffset: 2,
};

export const PUCK = {
  radius: 1.1,
  stickOffset: 3.2,
};

export const PASS = {
  speed: 45,
};

export const SHOT = {
  speed: 80,
};
