# Implementation Plan

This plan splits Project ICE into implementation passes that can be handed to Codex, Fable, or another coding agent. The goal is to avoid a wide one-pass build that weakens determinism, tests, or subsystem boundaries.

## Pass Strategy
Build the MVP in passes. Each pass should leave the app runnable, keep simulation code testable without Phaser, and add automated verification before moving on.

## Pass 0: Foundation And Vertical Slice

### Goal
Create a bootable browser app and deterministic simulation skeleton with the recommended source layout.

### Scope
- Create Vite, TypeScript, and Phaser app shell.
- Add recommended `src/` folders:

```text
src/
  main.ts
  render/
    phaserScene.ts
    hud.ts
  sim/
    state.ts
    commands.ts
    events.ts
    loop.ts
    rules.ts
    replay.ts
    constants.ts
  physics/
    puck.ts
    skater.ts
    rink.ts
  ai/
    behavior.ts
    tactics.ts
  tests/
    acceptance/
    physics/
    replay/
    ai/
    render/
```

- Define typed contracts for `GameState`, `GameCommand`, `GameEvent`, and `RenderSnapshot`.
- Centralize the named tuning and timing constants from `physics/puck.md` and `gameplay/game_loop.md` in one simulation-owned module.
- Encode the rink geometry from `architecture/system.md` (dimensions, goal lines, goal mouth, crease, slot, faceoff spot).
- Implement fixed 60 Hz simulation ticking independent of render frame rate.
- Render rink, boards, goals, skaters, goalies, puck, clock, score, and selected skater using simple shapes.
- Support one human-selected skater with movement and switching, using the skater motion model (acceleration, glide, speed cap, facing).
- Add headless simulation test setup.

### Acceptance Gate
- App boots in browser.
- Simulation can advance headlessly for N ticks.
- Selected skater can move and switch.
- Renderer reads snapshots and does not mutate authoritative state.

## Pass 1: Core Rules And Control

### Goal
Make the game structurally playable.

### Scope
- Initialize 3 skaters plus 1 goalie per team; goalies are static crease placeholders until Pass 2/3.
- Implement possession: held puck, loose puck, pickup eligibility, repossess lockout, and carrier speed cap.
- Implement skater contact separation in deterministic order.
- Implement pass, shoot, and poke-check commands at a basic level.
- Implement goals, score increment, periods, regulation clock, and game end.
- Implement faceoffs per the state machine: formation placement, countdown, puck drop, and the poke-swipe contest with draw-back impulse.
- Add event emission for possession, goal, faceoff started/won, period end, and game end.

### Acceptance Gate
- `AT-001` through `AT-006` pass.
- Goals increment score exactly once.
- Faceoff reset clears possession and positions players, and the drop-and-swipe contest resolves per `gameplay/game_state_machine.md`.
- Three periods can complete and produce `GameEnd`.

## Pass 2: Deterministic Puck Physics And Replay

### Goal
Make puck behavior believable, repeatable, and testable.

### Scope
- Implement loose puck integration, friction, board collision, post collision, and goal-mouth crossing.
- Add pass, shot, dump, stick, and goalie-save impulses.
- Implement bank passes.
- Implement the contested-pickup tiebreak: closest eligible skater wins, ties broken by team id then player id.
- Implement the one-timer window: a shot within `ONE_TIMER_WINDOW_TICKS` of the puck entering receive radius releases without settled possession.
- Implement the geometric goalie save model: save radius check, reaction cooldown, trap-and-release, and seeded rebound jitter. Goalie positioning intelligence stays in Pass 3.
- Add seeded replay from initial config plus accepted command log.
- Add deterministic state and event hashing for tests.

### Acceptance Gate
- `AT-007` through `AT-010`, `AT-014`, and `AT-017` through `AT-019` pass.
- Same seed and command log produce identical final state and event log.
- Puck loses energy through friction.
- Bank pass fixture is repeatable.

## Pass 3: Team AI And Goalie Behavior

### Goal
Add recognizable hockey intelligence without making the AI opaque.

### Scope
- Implement AI perception, situation classification, intent selection, and command output.
- Add teammate support lanes.
- Add opponent puck pressure.
- Add slot protection and passing-lane coverage.
- Add shot, pass, dump, retrieval, rebound, and goalie intents.
- Add goalie positioning: crease centering, squaring to threat, and threat evaluation.
- Add the AI faceoff swipe with a deterministic delay derived from seed, tick, and difficulty.
- Add deterministic difficulty knobs for reaction delay and prediction depth.

### Acceptance Gate
- `AT-011` through `AT-013` pass.
- AI can produce one-timer, dump, slot-protection, and rebound-recovery decisions in fixtures.
- AI remains deterministic under replay.

## Pass 4: Gameplay Completion

### Goal
Close the MVP gameplay loop.

### Scope
- Tune the one-timer window, receiving, pickup, shot, pass, and dump constants.
- Improve selected-player feedback and possession feedback.
- Add required HUD and rink presentation smoke tests.
- Run ten complete AI-vs-AI games headlessly.

### Acceptance Gate
- All acceptance tests in `verification/acceptance_tests.md` pass.
- `AT-015` ten complete games without crash passes.
- `AT-016` render smoke test passes.

## Pass 5: Polish And Hardening

### Goal
Improve readability, maintainability, and feel without expanding MVP rules.

### Scope
- Tune player speed, puck speed, friction, restitution, receive tolerance, and AI reaction delay.
- Add debug overlay for seed, tick, mode, possession, and last events.
- Improve HUD layout and visual clarity.
- Review code boundaries against `architecture/system.md`.
- Add any missing regression tests for bugs found during tuning.

### Acceptance Gate
- No MVP non-goals have slipped into scope.
- Simulation remains independent from Phaser.
- Replay, physics, AI, and acceptance tests remain green.

## Recommended First Ticket
Implement Pass 0 plus the thinnest useful slice of Pass 1:
- bootable app
- fixed-tick simulation
- typed state/command/event/snapshot contracts
- named constants and rink geometry module
- simple rink render
- human movement and switching
- basic puck possession
- basic pass and shoot stubs
- two or three headless tests

This gives later passes a stable skeleton without pretending the whole MVP can be completed safely in one pass.

## Stop Conditions
Pause and update the spec before continuing if any of these occur:
- A phase requires changing a decision in `docs/decisions.md`.
- A feature needs authoritative state inside Phaser.
- Determinism cannot be preserved with the current design.
- Acceptance tests need to be weakened to make implementation pass.
- A new MVP rule such as penalties, offsides, icing, fatigue, online play, or overtime becomes required.
