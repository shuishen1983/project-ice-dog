export type GameEvent =
  | { type: 'modeChanged'; mode: string; tick: number }
  | { type: 'faceoffStarted'; spotId: string; tick: number }
  | { type: 'faceoffWon'; teamId: string; playerId: string; tick: number }
  | { type: 'possessionChanged'; playerId?: string; teamId?: string; tick: number }
  | { type: 'puckReleased'; playerId: string; tick: number }
  | { type: 'goalieSave'; goalieId: string; trapped: boolean; tick: number }
  | { type: 'goal'; teamId: string; scorerId?: string; tick: number }
  | { type: 'periodEnded'; period: number; tick: number }
  | { type: 'gameEnded'; winnerTeamId?: string; tick: number };
