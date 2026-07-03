# Acceptance Tests

Acceptance tests should exercise simulation behavior through public commands and state snapshots. Prefer headless tests for rules, physics, replay, and AI. Use browser tests only for presentation and input latency.

## Rules And Game Flow
- AT-001 Goal increments the scoring team's score exactly once.
  - Given a puck crosses the goal line inside the goal mouth during `Gameplay`
  - When the tick resolves
  - Then one `goal` event is emitted, score increases by one, and repeated ticks do not add more goals for the same crossing.

- AT-002 Faceoff resets game correctly.
  - Given a goal or new period transition
  - When the game enters `Faceoff`
  - Then puck has no owner, skaters are placed at the faceoff formation, goalies are in crease, and clock is paused.

- AT-003 Three periods complete and winner is declared.
  - Given regulation time expires in period 3
  - When `PeriodEnd` resolves
  - Then `GameEnd` is emitted and the leading team is identified as winner.

- AT-004 Tied game is allowed in MVP.
  - Given regulation time expires in period 3 with equal scores
  - When `GameEnd` is emitted
  - Then winner is absent and final score is preserved.

## Player Control
- AT-005 Player switching is immediate.
  - Given a human team has multiple eligible skaters
  - When a switch command is accepted for tick N
  - Then the selected player id changes no later than committed tick N.

- AT-006 Human movement command affects only the selected skater.
  - Given a selected human skater
  - When a movement command is applied
  - Then only that skater receives human movement intent.

## Puck And Physics
- AT-007 Pass, receive, and possession change are deterministic.
  - Given a pass to an open teammate
  - When the receiver reaches the puck within receive tolerance
  - Then possession changes to the receiver and the event log is stable across replay.

- AT-008 One-timer opportunity can produce immediate shot.
  - Given a receiver has an incoming pass and an open shot lane
  - When the receiver's AI or human command shoots within the one-timer window
  - Then the puck is released as a shot without first requiring settled possession.

- AT-009 Bank pass remains repeatable.
  - Given identical seed, state, and command for a 45 degree board pass
  - When the simulation advances until the puck slows
  - Then final puck position and event log match exactly across runs.

- AT-010 Puck loses energy through friction.
  - Given a loose puck with nonzero velocity and no additional impulse
  - When N ticks pass
  - Then puck speed never increases and eventually reaches zero.

## AI
- AT-011 AI recognizes one-timer opportunity.
  - Given a teammate is open in a scoring lane during an incoming pass
  - When AI evaluates the situation
  - Then it chooses a one-timer shot intent or command.

- AT-012 AI dumps puck when lane is blocked.
  - Given the puck carrier is pressured and all safe pass lanes are blocked
  - When AI evaluates the situation outside the deep zone
  - Then it issues a dump command toward the attacking end.

- AT-013 Defensive AI protects slot.
  - Given the opponent has possession in the attacking zone
  - When defenders assign roles
  - Then at least one defender protects the slot unless all defenders are closer to an immediate loose-puck recovery.

## Replay And Stability
- AT-014 Replay deterministic.
  - Given the same seed, initial config, and accepted command log
  - When two headless simulations run to completion
  - Then final state hash and event log hash are identical.

- AT-015 Ten complete games without crash.
  - Given ten seeded AI-vs-AI games
  - When each runs to `GameEnd`
  - Then no tick throws and every game produces a final score.

## Presentation Smoke Tests
- AT-016 Required HUD and rink elements render.
  - Given the browser game starts
  - When the first gameplay snapshot is rendered
  - Then rink, boards, goals, puck, skaters, goalies, score, period, clock, and selected-player marker are visible.
