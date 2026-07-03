# Implementation Handoff

This document is the starting point for Codex, Fable, or another implementation agent.

## Build Target
- Browser game
- TypeScript
- Vite
- Phaser renderer
- Deterministic simulation implemented in project-owned code

## Primary Objective
Build the smallest playable MVP that satisfies the acceptance tests:
- 3v3 plus goalies
- human vs AI
- three periods
- faceoffs after goals and at period starts
- passing, shooting, receiving, one-timers, bank passes, and dump-and-chase
- deterministic replay from seed plus input log

## Recommended First Implementation Slice
1. Create the Vite/TypeScript/Phaser app shell.
2. Add a pure simulation package with typed `GameState`, `GameCommand`, `GameEvent`, and `RenderSnapshot`.
3. Run a fixed 60 Hz simulation tick independent of render frame rate.
4. Render static rink, skaters, goalies, puck, clock, score, and selected skater.
5. Implement movement, player switching, puck possession, pass, and shot.
6. Add goals, score increment, faceoff reset, periods, and game end.
7. Add replay recording and deterministic replay test.
8. Add AI behavior in this order: support puck carrier, protect slot, pass selection, shot selection, dump-and-chase.

## Required Contracts
Implementation should preserve these boundaries:
- input creates `GameCommand`
- rules create `GameEvent`
- simulation consumes commands and events during fixed ticks
- renderer reads `RenderSnapshot`
- tests should be able to run the simulation without Phaser

## Suggested Source Layout
The exact layout can change, but keep simulation independent from rendering.

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
  physics/
    puck.ts
    rink.ts
  ai/
    behavior.ts
    tactics.ts
  tests/
    acceptance/
    physics/
    replay/
```

## Agent Guardrails
- Do not put authoritative gameplay state in Phaser sprites.
- Do not use elapsed render delta for gameplay changes.
- Do not call `Math.random()` from simulation code; use a seeded RNG passed through state or tick context.
- Do not close a phase by visual inspection alone; add or update an automated test.
- Prefer boring rectangles, circles, and labels before art polish.
- Keep hockey rules explicit even when simplified.

## Definition Of Done For MVP
- All functional requirements in `requirements/functional.md` are implemented or explicitly deferred with a decision record.
- All acceptance tests in `verification/acceptance_tests.md` pass.
- A fixed seed and identical input log produce identical final state and event log.
- Ten complete AI-vs-AI games can run headlessly without crash.
- Human controls feel responsive at normal browser frame rates.
