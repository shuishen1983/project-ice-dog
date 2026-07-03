# Hockey Ontology

This ontology gives implementation, tests, and AI behavior a shared vocabulary. Terms do not imply full NHL rule fidelity unless a functional requirement says so.

## Entities
- Player
- Goalie
- Puck
- Goal
- Boards
- Offensive Zone
- Neutral Zone
- Defensive Zone
- Slot
- Crease
- Faceoff Spot
- Passing Lane
- Shot Lane

## Offensive Concepts
- One-timer
- Give-and-go
- Dump-and-chase
- Cycle
- Bank pass
- Screen
- Odd-man rush

## Defensive Concepts
- Protect slot
- Pressure puck
- Cover passing lane
- Backcheck
- Rebound recovery

## Simplified Definitions
- One-timer: a shot taken directly from an incoming pass inside a short receive window.
- Bank pass: a pass intentionally played off the boards to reach space or a teammate.
- Dump-and-chase: sending the puck deep into the attacking zone so teammates can retrieve it.
- Slot: central scoring area in front of the goal.
- Crease: goalie area in front of the goal mouth.
- Passing lane: line or corridor from puck carrier to receiver.
- Shot lane: line or corridor from puck to goal mouth.
- Pressure: defensive proximity that reduces puck carrier time and space.
- Rebound: loose puck created by a save, block, post, or missed trap near the goal.

## Decision Pipeline

Perception
→ World Model
→ Situation Recognition
→ Tactical Intent
→ Motion Planning
→ Execute
