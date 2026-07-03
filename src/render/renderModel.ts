import type { RenderSnapshot } from '../sim/state';

export type RenderElementKind =
  | 'rink'
  | 'boards'
  | 'centerLine'
  | 'blueLine'
  | 'goalMouth'
  | 'skater'
  | 'skaterFacing'
  | 'selectedPlayer'
  | 'possessionMarker'
  | 'goalie'
  | 'puck'
  | 'score'
  | 'periodClock'
  | 'debugOverlay'
  | 'controlsHelp';

export type RenderElement = {
  kind: RenderElementKind;
  id: string;
};

export function buildRenderModel(snapshot: RenderSnapshot): RenderElement[] {
  const elements: RenderElement[] = [
    { kind: 'rink', id: 'rink' },
    { kind: 'boards', id: 'boards' },
    { kind: 'centerLine', id: 'center-line' },
    { kind: 'blueLine', id: 'blue-line-home' },
    { kind: 'blueLine', id: 'blue-line-away' },
    { kind: 'goalMouth', id: 'goal-home' },
    { kind: 'goalMouth', id: 'goal-away' },
    { kind: 'puck', id: 'puck' },
    { kind: 'score', id: 'score' },
    { kind: 'periodClock', id: 'period-clock' },
    { kind: 'debugOverlay', id: 'debug-overlay' },
    { kind: 'controlsHelp', id: 'controls-help' },
  ];

  for (const player of snapshot.players) {
    elements.push({ kind: 'skater', id: player.id });
    elements.push({ kind: 'skaterFacing', id: `${player.id}-facing` });
    if (player.id === snapshot.selectedPlayerId) {
      elements.push({ kind: 'selectedPlayer', id: `${player.id}-selected` });
    }
    if (player.id === snapshot.puck.ownerId) {
      elements.push({ kind: 'possessionMarker', id: `${player.id}-possession` });
    }
  }

  for (const goalie of snapshot.goalies) {
    elements.push({ kind: 'goalie', id: goalie.id });
  }

  if (!snapshot.puck.ownerId) {
    elements.push({ kind: 'possessionMarker', id: 'loose-puck-possession' });
  }

  return elements;
}
