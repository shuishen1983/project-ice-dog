# Engineering Decisions

DEC-001 Accepted: 3v3 plus goalies.
DEC-002 Accepted: Browser implementation.
DEC-003 Accepted: Hockey IQ prioritized.
DEC-004 Accepted: Deterministic puck simulation.
DEC-005 Accepted: No offsides, icing or penalties in MVP.
DEC-006 Accepted: Fixed timestep simulation at 60 Hz.
DEC-007 Accepted: Phaser is renderer only; authoritative simulation stays in project-owned TypeScript modules.
DEC-008 Accepted: Headless simulation tests are required for rules, replay, physics, and AI.
DEC-009 Accepted: Ties are allowed at regulation end for MVP unless an overtime ADR supersedes this.
DEC-010 Accepted: Goalies are AI-controlled in MVP.
DEC-011 Accepted: Center-ice faceoffs only in MVP; the draw is won by the first poke-check contact within a fixed window after the drop.
DEC-012 Accepted: Goalie saves resolve geometrically with no random save roll; rebound jitter comes from the seeded RNG.
DEC-013 Accepted: Goalie traps release the puck to a defender after a fixed hold instead of triggering a faceoff in MVP.
DEC-014 Accepted: Keyboard-first input with facing-based aiming; mouse and gamepad support deferred.
DEC-015 Accepted: No body checking in MVP; poke check is the only defensive stick action.
DEC-016 Accepted: Rink geometry is NHL-proportional at 200 by 85 rink units with one unit per foot.
DEC-017 Accepted: Goalie movement is constrained to the crease semicircle in MVP; depth and lateral positioning are deterministic functions of puck position.
DEC-018 Accepted: Team colors are fixed and shared across all presentation surfaces: home is blue (#0f6bdc) and away is red (#d63d32); the HUD scoreboard renders each team's label and score in that team's color so the score visibly maps to the players on the ice.
