export type Vec2 = {
  x: number;
  y: number;
};

export const ZERO_VEC: Vec2 = { x: 0, y: 0 };

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vec2, scalar: number): Vec2 {
  return { x: v.x * scalar, y: v.y * scalar };
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function normalize(v: Vec2): Vec2 {
  const magnitude = length(v);
  if (magnitude === 0) {
    return { ...ZERO_VEC };
  }
  return { x: v.x / magnitude, y: v.y / magnitude };
}

export function clampLength(v: Vec2, maxLength: number): Vec2 {
  const magnitude = length(v);
  if (magnitude <= maxLength || magnitude === 0) {
    return v;
  }
  return scale(v, maxLength / magnitude);
}

export function distance(a: Vec2, b: Vec2): number {
  return length(subtract(a, b));
}

export function roundVec(v: Vec2, precision = 1_000_000): Vec2 {
  return {
    x: Math.round(v.x * precision) / precision,
    y: Math.round(v.y * precision) / precision,
  };
}
