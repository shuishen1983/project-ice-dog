# Functional Requirements

## Game Structure
- FR-001 Keep score separately for home and away teams.
- FR-002 Run three regulation periods.
- FR-003 Start each period with a faceoff.
- FR-004 Trigger a faceoff after every valid goal.
- FR-005 Stop regulation when the third period expires.
- FR-006 Declare a winner when one team leads at game end.
- FR-007 Allow a tied final score in MVP unless an overtime decision is added later.

## Teams And Control
- FR-008 Support 3 skaters plus 1 goalie per team on the rink.
- FR-009 Allow exactly one human-controlled skater at a time.
- FR-010 Switch human control to another eligible skater immediately after a switch command.
- FR-047 Provide a short speed boost for the controlled skater that raises max speed and acceleration for a fixed duration.
- FR-048 Enforce a per-player boost recovery period; a boost command during recovery has no effect. Boost readiness must be visible to the player.
- FR-011 AI controls all non-human skaters and the opposing team.
- FR-012 Goalies are AI-controlled in MVP.

## Puck And Actions
- FR-013 Represent puck state as held by a player or loose on the ice.
- FR-014 Allow a puck carrier to pass toward a teammate or target point.
- FR-015 Allow a puck carrier to shoot toward the goal or target point.
- FR-016 Allow eligible skaters to receive passes.
- FR-017 Support one-timer shots when a receiver shoots immediately from an incoming pass.
- FR-018 Support bank passes that rebound predictably from boards.
- FR-019 Support dump-and-chase when the puck is intentionally sent deep without a direct receiver.
- FR-020 Allow possession changes from receiving, loose-puck pickup, goalie save, rebound, and turnover.

## AI Behavior
- FR-021 Teammate AI supports the human puck carrier with passing lanes.
- FR-022 Opponent AI pressures the puck carrier.
- FR-023 Defensive AI prioritizes protecting the slot over chasing low-threat puck positions.
- FR-024 AI can choose pass, shot, dump, retrieval, and rebound-recovery intents.
- FR-025 Difficulty levels may tune reaction delay and prediction depth, but must not change core rules.
- FR-040 Goalies move forward, backward, and laterally within the crease: challenging toward the puck as threat rises, and hugging the near post when the puck is behind the goal line.

## Presentation And Input
- FR-026 Display rink, boards, goals, skaters, goalies, puck, score, period, clock, and selected skater.
- FR-027 Player input must map to movement, switch, pass, shoot, and poke-check commands.
- FR-028 Visual feedback must make goals, faceoffs, possession changes, and selected-player changes readable.
- FR-038 Render a facing indicator on every skater, emphasized on the selected skater, so pass and shot aiming direction is readable.
- FR-039 Provide a control-hints overlay listing the input mapping, toggled by clicking a visible help button or pressing Ctrl+H.
- FR-049 Normalize all device input into per-tick input frames mapped to commands by shared, device-agnostic logic.
- FR-050 Provide touch controls (virtual joystick, action buttons, tappable menu) with feature parity to the keyboard mapping.
- FR-051 The page must not scroll, zoom, or select text during play on touch devices; the layout must remain usable on iPad-class screens.

## Faceoffs And Physics Detail
- FR-032 Use the center-ice faceoff spot for all MVP restarts.
- FR-033 Resolve the faceoff draw deterministically: the first poke-check contact within the faceoff window wins and draws the puck toward a teammate.
- FR-034 Resolve contested loose-puck pickups deterministically: the closest eligible skater wins, with ties broken by team id then player id.
- FR-035 Resolve goalie saves geometrically with no random save roll; trapped pucks are released to a defender after a fixed hold, and non-trapped saves emit a rebound.
- FR-036 Cap puck carrier speed below free-skating speed so defenders can close on the carrier.
- FR-037 Default player switching selects the eligible skater closest to the puck, with deterministic tie-breaking.

## Match Types And Shootout
- FR-041 Offer two match types from the menu: Regulation (three periods) and Shootout.
- FR-042 A shootout attempt places one shooter against the defending goalie; all other skaters are parked off-play and possession-ineligible.
- FR-043 Shootout runs alternating best-of-5 attempts, home first, with sudden-death rounds if tied after five.
- FR-044 An attempt ends on goal, goalie trap, the puck at rest or out of play behind the goal line, or attempt-timer expiry; rebounds stay live until then.
- FR-045 Only the active shooter accepts commands during a shootout attempt; the AI takes the non-human team's attempts.
- FR-046 Declare the shootout winner as soon as the result is mathematically decided (clinch) or a sudden-death round ends decided.

## Determinism And Replay
- FR-029 The same seed and command log must reproduce the same final state.
- FR-030 Replay output must include enough events to diagnose score, possession, faceoff, and period changes.
- FR-031 Headless simulation must run without Phaser for automated tests.
