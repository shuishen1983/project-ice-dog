# Tests

Automated regression tests live here once implementation begins.

## Expected Test Groups
- `acceptance`: end-to-end gameplay behavior from `verification/acceptance_tests.md`.
- `physics`: deterministic puck motion, collisions, friction, and goal-line behavior.
- `replay`: same seed plus command log produces the same state and event hashes.
- `ai`: tactic fixtures for one-timers, dump-and-chase, slot protection, and rebound recovery.
- `render`: lightweight browser smoke tests for required rink and HUD elements.

## Test Requirements
- Simulation tests must run headlessly without Phaser.
- Tests should prefer deterministic fixtures over random sampling.
- Any balance constants changed for gameplay feel should keep physics and replay regressions passing.
