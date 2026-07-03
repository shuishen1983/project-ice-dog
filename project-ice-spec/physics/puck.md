# Puck Physics

## Objectives
- Predictable
- Deterministic
- Stable

## Model
- Fixed timestep
- Sliding friction
- Continuous velocity
- Board restitution
- Goal-post restitution
- Stick impulse
- Goalie save impulse
- Puck ownership state for held puck behavior

## State
- `position`: simulation-space vector.
- `velocity`: simulation-space vector.
- `ownerId`: player id when held, otherwise none.
- `lastTouchPlayerId`: last player to intentionally affect puck.
- `lastTouchTeamId`: last team to intentionally affect puck.
- `intent`: none, pass, shot, dump, rebound, or loose.
- `ageTicks`: ticks since last possession change or impulse.

## Held Puck
- When held, puck position follows the owner's stick attachment point.
- Held puck velocity is derived from owner movement for release calculations but does not collide independently.
- Pass, shoot, dump, poke-check loss, or forced turnover releases the puck.

## Loose Puck Integration
For every physics tick:

1. Apply existing velocity to position.
2. Apply board, post, and goalie collision responses.
3. Apply sliding friction.
4. Clamp very small speeds to zero.
5. Evaluate pickup and receive eligibility.

Friction must remove energy over time. Restitution may redirect velocity and preserve some energy, but collisions must not increase puck speed above the pre-collision speed plus the explicit impulse being applied.

## Impulses
- Pass: medium-speed, targetable impulse, receiver-friendly.
- Shot: high-speed impulse toward a target, goal-threatening.
- Dump: medium/high impulse into deep zone, no required receiver.
- Stick contact: short impulse from poke check, pickup, rebound, or deflection.
- Goalie save: redirects or traps a goal-threatening puck based on save result.

## Collision Rules
- Boards reflect the velocity component normal to the wall and apply restitution.
- Goal posts reflect with lower restitution than boards.
- Goal line crossing inside the goal mouth emits a goal candidate for rules validation.
- Puck outside rink bounds must be corrected back inside bounds during the same tick.

## Tuning Defaults
Exact values belong in implementation constants, but initial values should satisfy:
- A full-power shot can travel from blue line to goal before stopping.
- A pass across half the rink slows enough for a receiver to collect.
- A 45 degree bank pass off the side boards reaches a predictable lane.
- A loose puck eventually stops without oscillating against boards.

## Future
- Spin
- Saucer passes
- Deflections

## Verification
- Replay deterministic.
- 45 degree bank shot remains repeatable.
- Puck always loses energy through friction.
- Puck cannot tunnel through boards or goal posts at normal shot speed.
- Goal is counted exactly once when puck crosses the goal line inside the goal mouth.
