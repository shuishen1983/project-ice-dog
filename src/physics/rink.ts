import type { Vec2 } from '../sim/vector';

export type RinkRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FaceoffSpot = {
  id: string;
  position: Vec2;
};

export type RinkGeometry = {
  width: number;
  height: number;
  cornerRadius: number;
  goalLineX: number;
  goalMouthWidth: number;
  creaseRadius: number;
  blueLineX: number;
  slot: {
    home: RinkRect;
    away: RinkRect;
  };
  faceoffSpots: FaceoffSpot[];
};

export function clampToRink(position: Vec2, rink: RinkGeometry, margin = 0): Vec2 {
  const halfWidth = rink.width / 2 - margin;
  const halfHeight = rink.height / 2 - margin;
  return {
    x: Math.max(-halfWidth, Math.min(halfWidth, position.x)),
    y: Math.max(-halfHeight, Math.min(halfHeight, position.y)),
  };
}
