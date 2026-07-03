import { add, length, scale, subtract } from '../sim/vector';
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

export type CornerArc = {
  center: Vec2;
  radius: number;
};

export function cornerArcAt(position: Vec2, rink: RinkGeometry, margin = 0): CornerArc | undefined {
  const cornerCenterX = rink.width / 2 - rink.cornerRadius;
  const cornerCenterY = rink.height / 2 - rink.cornerRadius;
  if (Math.abs(position.x) <= cornerCenterX || Math.abs(position.y) <= cornerCenterY) {
    return undefined;
  }

  return {
    center: { x: Math.sign(position.x) * cornerCenterX, y: Math.sign(position.y) * cornerCenterY },
    radius: rink.cornerRadius - margin,
  };
}

export function clampToRink(position: Vec2, rink: RinkGeometry, margin = 0): Vec2 {
  const halfWidth = rink.width / 2 - margin;
  const halfHeight = rink.height / 2 - margin;
  const clamped = {
    x: Math.max(-halfWidth, Math.min(halfWidth, position.x)),
    y: Math.max(-halfHeight, Math.min(halfHeight, position.y)),
  };

  const corner = cornerArcAt(clamped, rink, margin);
  if (!corner) {
    return clamped;
  }

  const offset = subtract(clamped, corner.center);
  const separation = length(offset);
  if (separation <= corner.radius) {
    return clamped;
  }

  return add(corner.center, scale(offset, corner.radius / separation));
}
