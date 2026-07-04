import { describe, expect, it } from 'vitest';
import { BOOST, SKATER } from '../../sim/constants';
import { advanceTick } from '../../sim/loop';
import { createInitialState, type GameState } from '../../sim/state';
import { length } from '../../sim/vector';

const NORMAL_CARRIER_CAP = SKATER.maxSpeed * SKATER.carrierSpeedFactor;

function skateRight(state: GameState, playerId: string, ticks: number, extra: (tick: number) => boolean = () => false): GameState {
  let current = state;
  for (let i = 0; i < ticks; i += 1) {
    const tick = current.tick + 1;
    const commands = [{ type: 'move' as const, playerId, direction: { x: 1, y: 0 }, tick }];
    if (extra(tick)) {
      commands.push({ type: 'boost' as const, playerId, tick } as never);
    }
    current = advanceTick(current, commands).state;
  }
  return current;
}

describe('AT-026 speed boost', () => {
  it('raises the speed cap during the boost window and restores it afterward', () => {
    const state = createInitialState({ seed: 1, startInGameplay: true });
    const playerId = state.teams.home.controlledPlayerId;

    const boosted = skateRight(state, playerId, 70, (tick) => tick === 1);
    const boostedSpeed = length(boosted.teams.home.roster[0]!.velocity);
    expect(boostedSpeed).toBeGreaterThan(SKATER.maxSpeed);
    expect(boostedSpeed).toBeLessThanOrEqual(SKATER.maxSpeed * BOOST.speedFactor * SKATER.carrierSpeedFactor + 1e-9);

    const afterBoost = skateRight(boosted, playerId, BOOST.durationTicks, () => false);
    const settledSpeed = length(afterBoost.teams.home.roster[0]!.velocity);
    expect(settledSpeed).toBeLessThanOrEqual(NORMAL_CARRIER_CAP + 1e-9);
  });

  it('rejects a boost during recovery and allows it after', () => {
    const state = createInitialState({ seed: 1, startInGameplay: true });
    const playerId = state.teams.home.controlledPlayerId;

    const boosted = skateRight(state, playerId, 2, (tick) => tick === 1);
    const player = boosted.teams.home.roster[0]!;
    expect(player.boostUntilTick).toBe(1 + BOOST.durationTicks);
    expect(player.boostReadyAtTick).toBe(1 + BOOST.durationTicks + BOOST.cooldownTicks);

    // A second boost inside the recovery window must not extend anything.
    const duringRecovery = skateRight(boosted, playerId, BOOST.durationTicks + 20, (tick) => tick === BOOST.durationTicks + 10);
    expect(duringRecovery.teams.home.roster[0]!.boostUntilTick).toBe(1 + BOOST.durationTicks);

    // Once recovered, a new boost is accepted.
    const readyTick = player.boostReadyAtTick;
    let recovered = duringRecovery;
    while (recovered.tick < readyTick) {
      recovered = advanceTick(recovered).state;
    }
    recovered = skateRight(recovered, playerId, 1, () => true);
    expect(recovered.teams.home.roster[0]!.boostUntilTick).toBeGreaterThan(readyTick);
  });

  it('tracks recovery per player and only one boost event per accepted boost', () => {
    const state = createInitialState({ seed: 1, startInGameplay: true });
    const playerId = state.teams.home.controlledPlayerId;

    const boosted = skateRight(state, playerId, 2, (tick) => tick === 1);
    const wing = boosted.teams.home.roster.find((player) => player.id === 'home-w')!;
    expect(wing.boostReadyAtTick).toBe(0);

    // Another player may boost immediately (AI-sourced), independent of home-c's recovery.
    const wingBoost = advanceTick(boosted, [
      { type: 'boost', playerId: 'home-w', tick: boosted.tick + 1, source: 'ai' },
    ]).state;
    const boostedWing = wingBoost.teams.home.roster.find((player) => player.id === 'home-w')!;
    expect(boostedWing.boostUntilTick).toBeGreaterThan(0);

    const boostEvents = wingBoost.events.filter((event) => event.type === 'boostStarted');
    expect(boostEvents).toHaveLength(2);
  });

  it('rejects human boosts for non-controlled skaters', () => {
    const state = createInitialState({ seed: 1, startInGameplay: true });
    const after = advanceTick(state, [{ type: 'boost', playerId: 'home-w', tick: state.tick + 1 }]).state;
    const wing = after.teams.home.roster.find((player) => player.id === 'home-w')!;
    expect(wing.boostUntilTick).toBe(0);
  });
});
