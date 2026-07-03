# Team Strategy

AI should be simple, explainable, and deterministic. It does not need to be optimal; it needs to create recognizable hockey behavior.

## Decision Pipeline
Every AI-controlled skater follows this pipeline:

```text
Perception -> Situation -> Intent -> Command
```

- Perception reads the committed state from the previous tick.
- Situation classifies puck ownership, zone, pressure, lanes, and shot threat.
- Intent chooses a hockey action such as support, pressure, protect slot, shoot, pass, dump, retrieve, or rebound.
- Command converts intent into movement and puck actions for the next tick.

## Offensive Priorities
- Maintain spacing.
- Support puck carrier.
- Prefer pass over solo play.
- Execute one-timers.
- Dump-and-chase when lanes close.

### Puck Carrier
Priority order:
1. Shoot if a high-quality lane exists.
2. Pass if a teammate has a better lane or one-timer opportunity.
3. Carry toward open ice if pressure is low.
4. Dump deep if pressured and no pass lane exists.
5. Protect puck or move laterally if no productive action is available.

### Supporting Teammates
- One teammate should present a short support lane.
- One teammate should seek a scoring lane or back-door lane.
- Teammates should avoid stacking on the puck carrier.
- A receiver should prepare for a one-timer when pass velocity, angle, and shot lane are favorable.

## Defensive Priorities
- Protect slot first.
- One skater pressures puck.
- One covers passing lane.
- Recover rebounds.

### Without Puck
Priority order:
1. Protect immediate shot threat in the slot.
2. Pressure puck carrier if assigned as first defender.
3. Cover the most dangerous passing lane.
4. Retrieve loose puck when closest and safe.
5. Recover rebounds near the crease.

## Goalie Behavior
- Stay near crease center when puck is low threat.
- Square to puck position when threat rises.
- Attempt save when puck path intersects goal mouth.
- Trap low-speed pucks near crease when possible.
- Emit rebound when a save does not trap the puck.

## Situation Heuristics
- Shot lane: line segment from puck to goal mouth with no nearby defender.
- Pass lane: line segment from puck carrier to teammate with no nearby defender or board conflict.
- Pressure: opponent within defensive radius of puck carrier.
- One-timer opportunity: incoming pass to teammate plus immediate shot lane before defensive closure.
- Dump trigger: puck carrier under pressure, no safe pass lane, and puck not already deep.

## Difficulty
- Easy: reactive decisions, longer reaction delay, little prediction.
- Medium: positional decisions, moderate reaction delay, simple lane prediction.
- Hard: predictive decisions, shorter reaction delay, anticipates pass and rebound lanes.

Difficulty must not break determinism. Reaction delays and prediction depth are deterministic functions of state, seed, and tick.

## Verification Scenarios
- AI recognizes one-timer opportunity and issues a shot command.
- AI dumps puck when pressured with blocked pass lanes.
- Defensive AI assigns one skater to pressure and one to protect the slot.
- AI chooses rebound recovery when the puck is loose near the crease.
