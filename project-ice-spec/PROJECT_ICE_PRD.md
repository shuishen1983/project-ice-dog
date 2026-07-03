# PROJECT ICE PRD v0.5

## Vision
Create a browser-based 2D hockey simulator inspired by tabletop hockey where
hockey IQ, teamwork, and believable puck physics consistently outperform
random or purely mechanical play.

## Product Goals
- Fun in under five minutes
- Easy to learn
- Difficult to master
- Deterministic gameplay
- AI demonstrates recognizable hockey concepts
- Single-player local play first, with no franchise or roster management requirements

## MVP
- Browser
- TypeScript
- Vite
- Phaser
- 3v3 plus goalies
- Single-player local play: human vs AI
- Player switching
- Scoreboard
- Three periods
- Faceoffs

## MVP Non-Goals
- Online multiplayer
- Franchise, season, or roster management
- Penalties, offsides, icing, line changes, and fatigue simulation
- Photorealistic skating or full NHL rule fidelity
- Physics driven by a non-deterministic engine
- Any requirement for persistent player profiles, saved leagues, or team customization

## Design Pillars
1. Hockey First
2. Believable Physics
3. Team Intelligence
4. Immediate Control
5. Readable Gameplay
6. Engineering Quality

## Phase Plan
P0 Foundation
- Vite, TypeScript, Phaser boot path
- fixed-timestep simulation shell
- typed game state, command, event, and snapshot contracts
- replay seed and input log plumbing

P1 Physics
- deterministic puck integration
- board, post, goal-mouth, and stick interactions
- friction and restitution regression tests

P2 Core Gameplay
- 3v3 plus goalies
- possession, passing, shooting, receiving, one-timers, and bank passes
- scoreboard, clock, periods, goals, faceoffs, and winner declaration
- player switching and readable selected-player feedback

P3 Team AI
- teammate support and opponent pressure
- shot, pass, dump, and rebound decisions
- difficulty profiles that alter reaction time and prediction depth

P4 Hockey Knowledge
- named hockey situations surfaced in code and tests
- deterministic behavior fixtures for one-timers, dump-and-chase, slot protection, and bank passes

P5 Polish
- UI readability, rink presentation, audio hooks if desired, tuning, and performance cleanup

No phase closes until acceptance tests pass.
