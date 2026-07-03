# Browser Hockey Game Design

## Overview
Project ICE is a browser-based 2D hockey game designed as a deterministic, modular simulation that prioritizes hockey IQ over arcade randomness. The experience should be easy to learn, fast to play, and rich enough for the AI to demonstrate recognizable hockey concepts such as passing, support, puck retrieval, and shot selection.

## Design Goals
- Deliver a playable MVP in the browser using TypeScript, Vite, and Phaser.
- Keep simulation logic deterministic so matches can be replayed and verified.
- Separate gameplay rules, physics, AI, and presentation so each subsystem can evolve independently.
- Make the game readable for players by emphasizing clear state, simple controls, and obvious outcomes.

## High-Level Architecture
The game is organized around a central simulation loop with five primary subsystems:

1. Game Loop
   - Owns the fixed-timestep update cycle.
   - Advances the world state, processes events, and dispatches state transitions.

2. Rules Engine
   - Enforces game rules such as scoring, faceoffs, possession changes, and period progression.
   - Produces authoritative gameplay events for UI and replay systems.

3. Physics Engine
   - Simulates puck motion, collisions, stick contact, rebounds, and friction.
   - Must remain deterministic and stable across repeated runs.

4. AI Engine
   - Controls all non-human-controlled skaters and both goalies.
   - Uses simple, explainable hockey behaviors such as support, passing, shot generation, and defensive positioning.

5. Renderer and UI
   - Visualizes the rink, players, puck, score, clock, and player selection state.
   - Converts simulation events into understandable player feedback.

## Runtime Model
The authoritative game state lives in a single simulation model that is updated each frame tick. The renderer does not mutate gameplay state directly; it observes state and presents it.

The simulation runs at a fixed 60 Hz tick. Rendering may run faster or slower, but render delta must never change authoritative gameplay results. Any interpolation used by Phaser is visual-only and must be derived from committed simulation state.

### Core State Objects
- GameState: seed, tick, period, score, possession, clock, faceoff state, winner, active mode, event log cursor, and teams.
- TeamState: id, side, roster, goalie, controlled player identity, tactical mode, and recent team events.
- PlayerState: id, team id, role, position, velocity, facing direction, control state, possession eligibility, cooldowns, and current intent.
- GoalieState: id, team id, crease position, save radius, reaction cooldown, and current intent.
- PuckState: position, velocity, owner id if possessed, loose/held state, last touch, collision flags, and shot/pass metadata.
- RinkState: dimensions, boards, blue-line markers if rendered, creases, goal lines, goal mouths, faceoff spots, and slot regions.

### Coordinate System
- Use a single simulation coordinate system measured in rink units.
- The rink center is `(0, 0)`.
- The home team attacks toward positive X in period 1 and alternates direction by period.
- Renderer code is responsible for mapping rink units to screen pixels.
- All commands and events use simulation coordinates, not screen coordinates.

### Rink Geometry
All values are in rink units (u). One rink unit corresponds to one foot of a proportional NHL rink; the renderer chooses pixel scale.

- Rink: 200 u long (x) by 85 u wide (y); x in `[-100, +100]`, y in `[-42.5, +42.5]`.
- Corner radius: 28 u.
- Goal lines: x = -89 and x = +89.
- Goal mouth: 6 u wide, centered on y = 0; posts at `(±89, -3)` and `(±89, +3)`.
- Crease: semicircle of radius 6 u centered on the goal mouth, opening toward center ice.
- Slot: rectangle in front of each goal mouth, extending 22 u from the goal line toward center ice, with `|y| <= 12`.
- Blue lines: x = -25 and x = +25. In MVP they are visual markers and AI zone boundaries only; no offsides rules apply.
- Center faceoff spot: `(0, 0)`. MVP rules use only the center spot; zone faceoff spots may be rendered but are unused.
- Zones: the defensive and offensive zones are the regions beyond each blue line; the neutral zone lies between them. Zone identity depends on the attacking direction for the current period.

### Canonical Data Contracts
The implementation may choose exact TypeScript names, but these contracts should remain recognizable.

```ts
type GameCommand =
  | { type: 'move'; playerId: string; direction: Vec2; tick: number }
  | { type: 'switchPlayer'; teamId: string; targetPlayerId?: string; tick: number }
  | { type: 'pass'; playerId: string; target?: Vec2 | string; tick: number }
  | { type: 'shoot'; playerId: string; target: Vec2; tick: number }
  | { type: 'pokeCheck'; playerId: string; direction: Vec2; tick: number };

type GameEvent =
  | { type: 'goal'; teamId: string; scorerId?: string; tick: number }
  | { type: 'faceoffStarted'; spotId: string; tick: number }
  | { type: 'faceoffWon'; teamId: string; playerId: string; tick: number }
  | { type: 'possessionChanged'; playerId?: string; teamId?: string; tick: number }
  | { type: 'periodEnded'; period: number; tick: number }
  | { type: 'gameEnded'; winnerTeamId?: string; tick: number };

type RenderSnapshot = {
  tick: number;
  mode: string;
  clockSeconds: number;
  score: Record<string, number>;
  players: PlayerState[];
  goalies: GoalieState[];
  puck: PuckState;
  selectedPlayerId?: string;
  recentEvents: GameEvent[];
};
```

Contract notes:
- `pass.target`: a `Vec2` aims at a point; a string names a teammate player id. If omitted, rules select the receiving teammate deterministically using the aiming rules below.
- `switchPlayer.targetPlayerId`: if omitted, the default switch rule below applies.

## Interaction Flow
1. Input is captured from the player.
2. The input layer translates player intent into a command.
3. Commands are queued for the next simulation tick.
4. AI creates commands for autonomous skaters.
5. The rules engine validates commands and resolves game-mode transitions.
6. The physics engine updates puck and skater motion.
7. The rules engine emits authoritative events from the updated state.
8. The renderer displays the new snapshot and emits UI feedback.

## Module Boundaries
Interfaces between systems remain independent and should be defined by plain data contracts rather than hidden coupling.

- Input -> GameCommand
- Rules Engine -> GameEvent
- Physics Engine -> SimulationStep
- AI Engine -> AIAction
- Renderer <- RenderSnapshot

### Ownership Rules
- Rules own score, clock, period, faceoff, possession legality, and game end.
- Physics owns continuous motion, collisions, friction, rebounds, and puck impulses.
- AI owns command selection for non-human-controlled players only.
- Input owns human command creation only.
- Renderer owns sprites, camera, HUD, animation, and visual interpolation only.

## Control Model
The MVP uses a simple player-switching model:
- The human controls one skater at a time.
- Teammates are controlled by the AI.
- Switching is immediate and should not disrupt the simulation loop.

### Default Input Mapping (Keyboard MVP)
- Move: WASD or arrow keys; diagonals allowed; input becomes a normalized direction vector.
- Pass: J or Z.
- Shoot: K or X.
- Poke check: L or C.
- Switch player: Space.
- Mouse aiming and gamepad support are deferred from MVP.

### Aiming Rules
- A skater's facing is the direction of the most recent nonzero movement input; it defaults to facing the attacking goal at faceoffs.
- Pass with no explicit target selects the teammate with the best open lane inside a 120 degree cone centered on facing; if no teammate is in the cone, the pass releases along facing.
- Shoot targets the attacking goal mouth. The aim point inside the goal mouth is shaded toward the post nearest the shooter's facing direction, so steering up or down while shooting picks a corner.
- Poke check acts along facing.

### Switch Rule
- `switchPlayer` without a target selects the eligible skater (never the goalie) closest to the puck, excluding the currently selected skater.
- Distance ties break by ascending player id so switching is deterministic.

## Determinism Requirements
The simulation must be deterministic under the same input sequence and seed. This is essential for:
- replay validation,
- acceptance testing,
- debugging and balancing,
- future AI behavior comparisons.

### Determinism Rules
- Use a fixed timestep.
- Avoid frame-rate-dependent state changes.
- Keep all game logic in pure, orderable functions where practical.
- Record input events for replay.
- Sort commands by tick, team id, player id, and command type before resolution.
- Use stable iteration order for players, collisions, and AI decisions.
- Keep random choices behind a seeded RNG with logged seed and step count.
- Store replay data as seed plus timestamped commands; derived events should be reproducible.

## Error Handling And Debugging
- Invalid commands are ignored and may emit a debug-only rejection event.
- Simulation should never throw during a normal tick because of a user input command.
- Development builds should expose seed, tick, mode, possession, and last events.
- Headless tests should be able to advance N ticks and inspect state without rendering.

## MVP Scope
The initial release will include:
- 3v3 play with goalies,
- human vs AI,
- scoreboard and period progression,
- faceoff handling after goals,
- passing, shooting, receiving, and basic one-timer support,
- a readable 2D rink presentation.

## Verification Strategy
Verification should be continuous and tied to gameplay behavior rather than implementation details.
- Acceptance tests define visible gameplay outcomes.
- Replay tests confirm deterministic behavior.
- Physics regression tests protect puck stability and bank-shot repeatability.
- AI behavior tests confirm that simple hockey decisions are understandable and consistent.

## Resolved MVP Defaults
- Camera: default to fixed-side for MVP; revisit puck-follow only after readability testing.
- Rules: offsides, icing, penalties, line changes, and fatigue are deferred from MVP.
- AI depth: first polished release needs readable support, pass, shot, dump, pressure, and slot-protection behaviors before advanced tactics.
