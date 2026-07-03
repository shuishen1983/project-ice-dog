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
   - Controls non-player teammates and the opposing goalie.
   - Uses simple, explainable hockey behaviors such as support, passing, shot generation, and defensive positioning.

5. Renderer and UI
   - Visualizes the rink, players, puck, score, clock, and player selection state.
   - Converts simulation events into understandable player feedback.

## Runtime Model
The authoritative game state lives in a single simulation model that is updated each frame tick. The renderer does not mutate gameplay state directly; it observes state and presents it.

### Core State Objects
- GameState: period, score, possession, clock, faceoff state, winner, and active mode.
- TeamState: roster, skater positions, momentum, and controlled player identity.
- PlayerState: position, velocity, facing direction, selected action, and stamina-like intent state if needed.
- PuckState: position, velocity, owner, and collision flags.
- RinkState: boundaries, goal zones, and field dimensions.

## Interaction Flow
1. Input is captured from the player.
2. The input layer translates player intent into a command.
3. The rules engine evaluates whether the action is legal.
4. The physics engine updates puck and skater motion.
5. The AI engine makes decisions for autonomous units.
6. The renderer displays the new state and emits UI feedback.

## Module Boundaries
Interfaces between systems remain independent and should be defined by plain data contracts rather than hidden coupling.

- Input -> GameCommand
- Rules Engine -> GameEvent
- Physics Engine -> SimulationStep
- AI Engine -> AIAction
- Renderer <- RenderSnapshot

## Control Model
The MVP uses a simple player-switching model:
- The human controls one skater at a time.
- Teammates are controlled by the AI.
- Switching is immediate and should not disrupt the simulation loop.

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

## Open Design Questions
- Should the camera be fixed-side or follow the puck?
- Should the MVP support offside, icing, and penalties later or defer them entirely?
- How much tactical depth should the AI have before the first polished release?
