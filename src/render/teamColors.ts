import type { TeamId } from '../sim/state';

export const TEAM_COLORS: Record<TeamId, { skater: number; goalie: number; hud: string }> = {
  home: { skater: 0x0f6bdc, goalie: 0x0b3f86, hud: '#0f6bdc' },
  away: { skater: 0xd63d32, goalie: 0x8f231c, hud: '#d63d32' },
};
