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
- Positions skaters, goalies, and puck at the selected faceoff spot.
- Clears transient puck action state.
- Resets possession to none.
- Accepts no shot or pass commands.
- Transitions to `Gameplay` when the faceoff winner is resolved.

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
