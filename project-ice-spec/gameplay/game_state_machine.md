# Game State Machine

The game mode controls which commands are accepted and which systems advance.

## Modes

Regulation match type:

```text
Boot -> Menu -> Faceoff -> Gameplay -> Goal -> Faceoff
                                    -> PeriodEnd -> Faceoff
                                    -> GameEnd
```

Shootout match type (DEC-020, DEC-021):

```text
Boot -> Menu -> AttemptSetup -> Gameplay -> Goal -> AttemptSetup
                                         -> AttemptEnd -> AttemptSetup
                                         (Goal/AttemptEnd -> GameEnd when decided)
```

## Mode Responsibilities

### Boot
- Load assets and initialize configuration.
- Create deterministic seed.
- Build initial `GameState`.
- Transition to `Menu` or directly to `Faceoff` for test/dev builds.

### Menu
- Allows starting a new game as either match type: Regulation or Shootout (DEC-020).
- Accepts only the `startMatch` command, which carries the chosen match type and flows through the normal command pipeline so replays capture it (DEC-022).
- Does not advance simulation clock.
- May be skipped in automated tests.

### Faceoff
- MVP uses the center-ice spot for all faceoffs (period starts and after goals).
- Formation: each team's designated center is placed a fixed offset from the spot on its defending side; the other two skaters are placed at deterministic wing positions behind their center; goalies are centered in their creases. The human-selected skater becomes the center for the human team.
- Clears transient puck action state and resets possession to none.
- Accepts only switch commands during the countdown; movement, pass, shot, and poke commands are ignored until the drop.
- The puck is dropped at the spot after `FACEOFF_COUNTDOWN_TICKS`, and the mode transitions to `Gameplay` on the drop tick.

#### Faceoff Contest
The draw is resolved during normal `Gameplay` using the poke-check mechanic:
- The first poke-check contact on the puck within `FACEOFF_WINDOW_TICKS` after the drop wins the draw: rules emit `faceoffWon` and physics applies a draw-back impulse sending the puck toward the winner's nearest teammate.
- The human swipes with the poke-check input. AI centers issue their swipe after a deterministic delay derived from seed, tick, and difficulty.
- Simultaneous contacts on the same tick cancel: the puck stays loose at the spot and no `faceoffWon` is emitted.
- If no poke connects within the window, play continues with a loose puck and no `faceoffWon` event.

### Gameplay
- Accepts movement, switch, pass, shoot, and poke-check commands.
- Advances AI, physics, rules, clock, and replay recording.
- Transitions to `Goal` when a valid goal is detected.
- Transitions to `PeriodEnd` when regulation time for the current period expires.
- During a shootout, only the active shooter may act: switch, pass, and poke-check are rejected, and the clock is the attempt timer; timer expiry or a dead puck transitions to `AttemptEnd` instead of `PeriodEnd`.

### AttemptSetup (shootout only)
- Places the active shooter at center ice holding the puck, facing the goal its team attacked in period 1; the defending goalie is centered in its crease.
- Parks all other skaters off-play near the boards and marks them possession-ineligible; both goalies otherwise stay in their period-1 creases.
- Accepts no commands during the countdown; transitions to `Gameplay` with the attempt timer running after `FACEOFF_COUNTDOWN_TICKS`.

### AttemptEnd (shootout only)
- Entered when an attempt ends without a goal: goalie trap, puck at rest or out of play behind the goal line, or attempt-timer expiry (DEC-021).
- Pauses briefly, records the attempt, then advances to the next `AttemptSetup` (alternating shooter, incrementing the round after the away attempt) or to `GameEnd` when the shootout is decided.

### Goal
- Emits exactly one score event for the scoring team.
- Records scorer and last-touch metadata when available.
- Pauses clock and action for a short deterministic delay.
- Transitions to `Faceoff` in regulation, or to the next `AttemptSetup` (or `GameEnd` when decided) in a shootout.

### PeriodEnd
- Pauses gameplay.
- Increments the period if another regulation period remains.
- Alternates attack direction for the next period.
- Transitions to `Faceoff` or `GameEnd`.

### GameEnd
- Freezes authoritative gameplay.
- Emits final score and winner if one exists.
- Allows replay inspection and restart UI only.

## Transition Rules
- `Goal` can only be entered from `Gameplay`.
- In regulation, `GameEnd` can only be entered from `PeriodEnd`; in a shootout, from `Goal` or `AttemptEnd` once the result is decided (clinch during the first five rounds, or a decided sudden-death round).
- `Faceoff` must always clear puck owner.
- Period and score changes must happen through events, not direct renderer mutation.
- Every mode transition emits a `GameEvent` with tick and mode metadata.
