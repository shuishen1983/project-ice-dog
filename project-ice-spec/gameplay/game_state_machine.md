# Game State Machine

The game mode controls which commands are accepted and which systems advance.

## Modes

```text
Boot -> Menu -> Faceoff -> Gameplay -> Goal -> Faceoff
                                    -> PeriodEnd -> Faceoff
                                    -> GameEnd
```

## Mode Responsibilities

### Boot
- Load assets and initialize configuration.
- Create deterministic seed.
- Build initial `GameState`.
- Transition to `Menu` or directly to `Faceoff` for test/dev builds.

### Menu
- Allows starting a new game.
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

### Goal
- Emits exactly one score event for the scoring team.
- Records scorer and last-touch metadata when available.
- Pauses clock and action for a short deterministic delay.
- Transitions to `Faceoff`.

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
- `GameEnd` can only be entered from `PeriodEnd` in MVP.
- `Faceoff` must always clear puck owner.
- Period and score changes must happen through events, not direct renderer mutation.
- Every mode transition emits a `GameEvent` with tick and mode metadata.
