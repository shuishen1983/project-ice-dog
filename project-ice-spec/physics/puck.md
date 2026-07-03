# Puck And Skater Physics

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

## Skater Motion
Skaters and goalies use the same fixed timestep and determinism rules as the puck.

- Movement intent (human or AI) is a normalized desired direction.
- Acceleration: constant `SKATER_ACCEL` toward the desired direction.
- Glide: constant `SKATER_GLIDE_DECEL` opposing velocity when there is no movement intent.
- Speed cap: `SKATER_MAX_SPEED`; the puck carrier is capped at `CARRIER_SPEED_FACTOR` times that so defenders can close.
- Facing is the direction of the most recent nonzero movement intent.
- Skaters cannot leave rink bounds; boards stop skaters without rebound.

## Skater Contact
- Skaters and goalies are circles of radius `SKATER_RADIUS`.
- Overlapping skaters are separated along the line between centers, each moved half the overlap. There is no body-check impulse in MVP.
- Overlap pairs resolve in deterministic order sorted by team id then player id.

## Poke Check
- A poke check tests a contact circle of radius `POKE_RADIUS` centered `POKE_RANGE` along the poker's facing.
- If the puck (held or loose) is inside that circle, it becomes loose with a `POKE_IMPULSE` in the poke direction. A dispossessed owner cannot repossess for `REPOSSESS_LOCKOUT_TICKS`.
- Poke check starts a `POKE_COOLDOWN_TICKS` cooldown whether or not it connects.
- If two pokes would connect on the same tick, they resolve in deterministic command order and the first consumes the contact.

## Possession Resolution
- Pickup: a loose puck within `PICKUP_RADIUS` of an eligible skater becomes held by that skater.
- Receive: the intended receiver of a pass collects the puck within `RECEIVE_RADIUS` (larger than `PICKUP_RADIUS`) regardless of puck speed.
- One-timer: within `ONE_TIMER_WINDOW_TICKS` of the puck entering the receiver's `RECEIVE_RADIUS`, a shoot command releases a shot directly without settled possession.
- Eligibility: skaters under `REPOSSESS_LOCKOUT_TICKS` are ineligible; goalies use the save model below instead of pickup rules.
- Contested pickup: when multiple skaters are eligible on the same tick, the closest wins; exact distance ties break by ascending team id then player id. Scrums must stay deterministic.

## Goalie Save Model
- A save check runs when the puck's path during a tick passes within `GOALIE_SAVE_RADIUS` of the goalie and the goalie's reaction cooldown is ready.
- Save resolution is geometric and deterministic: inside the radius saves, outside does not. There is no random save roll. Difficulty tunes goalie positioning and reaction, never save geometry.
- After any save attempt the goalie cannot attempt another for `GOALIE_REACTION_COOLDOWN_TICKS`.
- Trap: if incoming puck speed is below `GOALIE_TRAP_MAX_SPEED`, the goalie holds the puck for `GOALIE_HOLD_TICKS`, then releases it as a pass toward the nearest defending teammate. Traps do not trigger a faceoff in MVP.
- Rebound: otherwise the puck reflects about the contact normal with `GOALIE_REBOUND_RESTITUTION`, rotated by a jitter of up to `GOALIE_REBOUND_JITTER_DEG` drawn from the seeded game RNG so rebounds are replay-stable.

## Tuning Defaults
Exact values belong in implementation constants, but initial values should satisfy:
- A full-power shot can travel from blue line to goal before stopping.
- A pass across half the rink slows enough for a receiver to collect.
- A 45 degree bank pass off the side boards reaches a predictable lane.
- A loose puck eventually stops without oscillating against boards.

### Initial Constants
Starting values in rink units (u) and 60 Hz ticks. Tuning may change them as long as physics and replay regressions still pass.

| Constant | Initial value |
| --- | --- |
| `SKATER_MAX_SPEED` | 28 u/s |
| `SKATER_ACCEL` | 36 u/s^2 |
| `SKATER_GLIDE_DECEL` | 20 u/s^2 |
| `CARRIER_SPEED_FACTOR` | 0.9 |
| `SKATER_RADIUS` | 1.5 u |
| `POKE_RANGE` | 3 u |
| `POKE_RADIUS` | 1.25 u |
| `POKE_IMPULSE` | 20 u/s |
| `POKE_COOLDOWN_TICKS` | 30 |
| `REPOSSESS_LOCKOUT_TICKS` | 15 |
| `PICKUP_RADIUS` | 2 u |
| `RECEIVE_RADIUS` | 3.5 u |
| `PASS_SPEED` | 45 u/s |
| `SHOT_SPEED` | 80 u/s |
| `DUMP_SPEED` | 60 u/s |
| `PUCK_FRICTION_DECEL` | 4 u/s^2 |
| `PUCK_STOP_EPSILON` | 0.05 u/s |
| `BOARD_RESTITUTION` | 0.7 |
| `POST_RESTITUTION` | 0.5 |
| `GOALIE_SAVE_RADIUS` | 3.5 u |
| `GOALIE_REACTION_COOLDOWN_TICKS` | 20 |
| `GOALIE_TRAP_MAX_SPEED` | 30 u/s |
| `GOALIE_HOLD_TICKS` | 45 |
| `GOALIE_REBOUND_RESTITUTION` | 0.4 |
| `GOALIE_REBOUND_JITTER_DEG` | 20 |

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
