import type { Player, Tournament } from './types';

const PLAYERS_KEY = 'padel_players';
const TOURNAMENTS_KEY = 'padel_tournaments';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getPlayers(): Player[] {
  return load<Player[]>(PLAYERS_KEY, []);
}

export function savePlayers(players: Player[]): void {
  save(PLAYERS_KEY, players);
}

export function getTournaments(): Tournament[] {
  return load<Tournament[]>(TOURNAMENTS_KEY, []);
}

export function saveTournaments(tournaments: Tournament[]): void {
  save(TOURNAMENTS_KEY, tournaments);
}

export function getTournament(id: string): Tournament | undefined {
  return getTournaments().find((t) => t.id === id);
}

export function updateTournament(updated: Tournament): void {
  const all = getTournaments().map((t) => (t.id === updated.id ? updated : t));
  saveTournaments(all);
}
