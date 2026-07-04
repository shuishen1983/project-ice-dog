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

- AT-026 Speed boost is short-lived with per-player recovery.
  - Given a controlled skater accepts a boost command
  - When the skater accelerates during the boost window
  - Then its speed may exceed the normal cap, a boost during recovery has no effect, the cap returns to normal after the boost, and another player's boost readiness is unaffected.

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

- AT-017 Faceoff contest is deterministic.
  - Given identical seed, difficulty, and swipe command timing at a faceoff
  - When the draw resolves
  - Then the same skater wins the draw, one `faceoffWon` event is emitted, and the drawn-back puck reaches the same position across runs.

- AT-018 Contested pickup resolves deterministically.
  - Given two skaters eligible to pick up the same loose puck on the same tick
  - When pickup resolves
  - Then the closest skater gains possession, exact ties resolve by team id then player id, and the outcome is identical across replays.

- AT-019 Goalie save, trap, and rebound are replay-stable.
  - Given an identical seeded shot on goal
  - When the goalie save resolves
  - Then slow pucks are trapped and released to a defender after the hold period, fast pucks rebound along the same trajectory across runs, and no save outcome differs between replays.

## Replay And Stability
- AT-014 Replay deterministic.
  - Given the same seed, initial config, and accepted command log
  - When two headless simulations run to completion
  - Then final state hash and event log hash are identical.

- AT-015 Ten complete games without crash.
  - Given ten seeded AI-vs-AI games
  - When each runs to `GameEnd`
  - Then no tick throws and every game produces a final score.

## Match Types And Shootout
- AT-020 Menu starts the selected match type.
  - Given a game in `Menu` mode
  - When a `startMatch` command with a match type is accepted
  - Then the game enters `Faceoff` for regulation or `AttemptSetup` for shootout, and the choice is reproducible from the command log.

- AT-021 Shootout attempt setup isolates shooter and goalie.
  - Given a shootout attempt begins
  - When `AttemptSetup` completes
  - Then the shooter holds the puck at center ice, the defending goalie is in its crease, and every other skater is parked and possession-ineligible.

- AT-022 Attempt ends without a goal and no score is awarded.
  - Given an attempt where the goalie traps the puck, the puck dies behind the goal line, or the attempt timer expires
  - When the attempt resolves
  - Then no score changes, the attempt is recorded, and the next attempt (or `GameEnd`) begins.

- AT-023 Attempts alternate and rounds advance.
  - Given a shootout in progress
  - When consecutive attempts resolve
  - Then shooters alternate home/away and the round increments after each away attempt.

- AT-024 Shootout clinch ends the game early.
  - Given one team's lead exceeds the other team's remaining attempts within the first five rounds
  - When the attempt resolves
  - Then `GameEnd` is entered with that team as winner without playing the remaining attempts.

- AT-025 Sudden death decides a tied shootout.
  - Given the score is tied after five rounds
  - When a sudden-death round ends with exactly one team scoring
  - Then that team wins and `GameEnd` is entered; tied sudden-death rounds continue.

## Presentation Smoke Tests
- AT-016 Required HUD and rink elements render.
  - Given the browser game starts
  - When the first gameplay snapshot is rendered
  - Then rink, boards, goals, puck, skaters, goalies, score, period, clock, selected-player marker, and skater facing indicators are visible.

## Input Devices
- AT-027 Device parity.
  - Given identical InputFrame sequences from any device provider
  - When they are mapped to commands
  - Then the command streams and simulation outcomes are identical.

- AT-028 Touch mapping completeness.
  - Given the touch control scheme
  - When each control is exercised
  - Then move, pass, shoot, poke, boost, switch, and both menu selections each produce their command.
