export type TournamentFormat = 'mexicano' | 'americano';
export type TournamentStatus = 'pending' | 'active' | 'completed';

export interface Player {
  id: string;
  name: string;
  createdAt: string;
}

export interface Match {
  id: string;
  team1: [string, string]; // player IDs
  team2: [string, string]; // player IDs
  score1: number | null;
  score2: number | null;
  completed: boolean;
}

export interface Round {
  id: string;
  number: number;
  matches: Match[];
}

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  playerIds: string[];
  rounds: Round[];
  pointsToWin: number; // points per game (e.g. 24 for mexicano)
  createdAt: string;
}

export interface PlayerStats {
  playerId: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  pointsFor: number;
  pointsAgainst: number;
  totalPoints: number; // ranking points (wins * pointsToWin or accumulated score)
}
