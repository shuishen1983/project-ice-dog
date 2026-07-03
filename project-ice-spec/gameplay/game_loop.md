# Game Loop

Project ICE uses a fixed-timestep simulation loop. The render loop can interpolate visuals, but authoritative gameplay advances only through simulation ticks.

## Tick Rate
- Simulation tick: 60 Hz.
- Tick length: 1/60 second.
- Render frame rate: variable.
- All timers, cooldowns, friction, AI reaction delays, and clock changes use ticks.

## Per-Tick Order
Each simulation tick resolves in this order:

1. Read queued human commands for this tick.
2. Build AI perception from the previous committed state.
3. Generate AI commands for autonomous players.
4. Sort all commands in deterministic order.
5. Apply game-mode restrictions from the rules engine.
6. Resolve movement intent for skaters and goalies.
7. Resolve puck actions: pass, shoot, poke check, pickup, receive.
8. Integrate physics for skaters and puck.
9. Resolve collisions, board rebounds, goal-mouth entry, goalie saves, and loose-puck pickups.
10. Emit rules events: goals, possession changes, faceoff transitions, period end, game end.
11. Commit the new state and expose a render snapshot.

## Hockey Flow
The normal gameplay rhythm is:

```text
Faceoff -> Loose Puck -> Possession -> Attack -> Shot/Pass/Dump -> Rebound/Transition -> Possession
```

This is a flow, not a strict state machine. For example, a bank pass can move directly from possession to loose puck to teammate possession without entering a shot state.

## Command Resolution Principles
- Commands reference player ids and simulation ticks.
- Commands for ineligible players are ignored.
- A player may produce at most one primary puck action per tick.
- Movement intent can coexist with one puck action.
- Rules decide whether an action is legal before physics applies impulses.

## Clock Behavior
- Regulation clock runs only in `Gameplay`.
- Clock is paused during `Faceoff`, `Goal`, `PeriodEnd`, and `GameEnd`.
- Period expiration is checked after the tick's gameplay resolution so a puck crossing the goal line during the final tick can still count consistently.

## Timing Constants
Initial values at 60 Hz. Tuning changes must keep replay and acceptance regressions passing.

| Constant | Initial value | Meaning |
| --- | --- | --- |
| `PERIOD_COUNT` | 3 | Regulation periods |
| `PERIOD_LENGTH_TICKS` | 10800 (180 s) | Regulation length of each period |
| `GOAL_PAUSE_TICKS` | 180 (3 s) | Deterministic pause in `Goal` before the faceoff |
| `FACEOFF_COUNTDOWN_TICKS` | 60 (1 s) | Placement hold before the puck drops |
| `FACEOFF_WINDOW_TICKS` | 45 (0.75 s) | Window after the drop in which a poke contact wins the draw |
| `ONE_TIMER_WINDOW_TICKS` | 12 (0.2 s) | Window after a pass reaches receive radius in which a shot releases as a one-timer |

## Replay Behavior
- Replay records seed, initial configuration, and all accepted human commands.
- AI commands are derived from seed and state during replay, not stored as source of truth.
- Event logs are regenerated during replay and compared against expected logs in tests.
