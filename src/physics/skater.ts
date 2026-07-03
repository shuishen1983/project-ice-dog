import { RINK, SKATER, TICK_SECONDS } from '../sim/constants';
import type { PlayerState } from '../sim/state';
import { add, clampLength, length, normalize, scale, ZERO_VEC } from '../sim/vector';
import type { Vec2 } from '../sim/vector';
import { clampToRink } from './rink';

export function integrateSkater(player: PlayerState, direction: Vec2, hasPuck: boolean): PlayerState {
  const desired = normalize(direction);
  const hasIntent = length(desired) > 0;

  let velocity = player.velocity;
  if (hasIntent) {
    velocity = add(velocity, scale(desired, SKATER.acceleration * TICK_SECONDS));
  } else {
    const speed = length(velocity);
    const speedDrop = SKATER.glideDecel * TICK_SECONDS;
    velocity = speed <= speedDrop ? { ...ZERO_VEC } : scale(velocity, (speed - speedDrop) / speed);
  }

  const maxSpeed = hasPuck ? SKATER.maxSpeed * SKATER.carrierSpeedFactor : SKATER.maxSpeed;
  const cappedVelocity = clampLength(velocity, maxSpeed);
  const nextPosition = clampToRink(add(player.position, scale(cappedVelocity, TICK_SECONDS)), RINK, player.radius);

  return {
    ...player,
    position: nextPosition,
    velocity: cappedVelocity,
    facing: hasIntent ? desired : player.facing,
    intent: hasIntent ? 'move' : 'idle',
  };
}
