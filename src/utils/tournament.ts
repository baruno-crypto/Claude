import type { Match, Player, PlayerStats, Round, Tournament } from '../types';

function uuid(): string {
  return crypto.randomUUID();
}

// ─── Mexicano ────────────────────────────────────────────────────────────────
// Partners rotate each round based on current standings.
// Top-2 players play together vs 3rd+4th, etc.
// Points = actual score accumulated (not wins).

function mexicanoRound(
  players: Player[],
  tournament: Tournament
): Round {
  const stats = computeStats(players, tournament);
  // Sort by totalPoints descending
  const sorted = [...players].sort((a, b) => {
    const sa = stats.find((s) => s.playerId === a.id)!;
    const sb = stats.find((s) => s.playerId === b.id)!;
    return sb.totalPoints - sa.totalPoints;
  });

  const matches: Match[] = [];
  // Pair 0+1 vs 2+3, 4+5 vs 6+7, …
  for (let i = 0; i + 3 < sorted.length; i += 4) {
    matches.push({
      id: uuid(),
      team1: [sorted[i].id, sorted[i + 1].id],
      team2: [sorted[i + 2].id, sorted[i + 3].id],
      score1: null,
      score2: null,
      completed: false,
    });
  }
  return { id: uuid(), number: tournament.rounds.length + 1, matches };
}

// ─── Americano ───────────────────────────────────────────────────────────────
// Each player partners with every other player exactly once (round-robin partners).
// Points = accumulated score.
// Generation: use a round-robin schedule for pairs.

function americanoRounds(players: Player[], _pointsToWin: number): Round[] {
  const n = players.length;
  if (n < 4) return [];

  // Generate all unique pairs
  const pairs: [string, string][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([players[i].id, players[j].id]);
    }
  }

  // Build rounds: each round contains floor(n/4) matches
  // where each player appears at most once per round.
  const rounds: Round[] = [];
  const usedPairs = new Set<string>();

  const pairKey = (a: string, b: string) => [a, b].sort().join('|');

  // Greedy round builder
  const remainingPairs = [...pairs];
  let roundNum = 1;

  while (remainingPairs.length >= 2) {
    const round: Match[] = [];
    const usedInRound = new Set<string>();

    for (let i = 0; i < remainingPairs.length; ) {
      const p1 = remainingPairs[i];
      // find a partner pair for p1 (no shared players, not already used as duo against p1)
      let found = false;
      for (let j = i + 1; j < remainingPairs.length; j++) {
        const p2 = remainingPairs[j];
        const allFour = new Set([...p1, ...p2]);
        if (allFour.size < 4) { i++; found = true; break; } // shared player, skip p1
        const playersOk = [...allFour].every((pid) => !usedInRound.has(pid));
        if (!playersOk) continue;

        // Check this match hasn't been played (team combos)
        const matchKey = [pairKey(p1[0], p1[1]), pairKey(p2[0], p2[1])].sort().join('||');
        if (usedPairs.has(matchKey)) continue;

        usedPairs.add(matchKey);
        [...allFour].forEach((pid) => usedInRound.add(pid));
        round.push({
          id: uuid(),
          team1: [p1[0], p1[1]],
          team2: [p2[0], p2[1]],
          score1: null,
          score2: null,
          completed: false,
        });
        remainingPairs.splice(j, 1);
        remainingPairs.splice(i, 1);
        found = true;
        break;
      }
      if (!found) i++;
    }

    if (round.length === 0) break;
    rounds.push({ id: uuid(), number: roundNum++, matches: round });
  }

  return rounds;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function computeStats(
  players: Player[],
  tournament: Tournament
): PlayerStats[] {
  const statsMap = new Map<string, PlayerStats>();
  for (const p of players) {
    statsMap.set(p.id, {
      playerId: p.id,
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      totalPoints: 0,
    });
  }

  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (!match.completed || match.score1 === null || match.score2 === null) continue;

      const allPlayers = [...match.team1, ...match.team2];
      for (const pid of allPlayers) {
        const s = statsMap.get(pid);
        if (!s) continue;
        s.matchesPlayed++;
      }

      const team1Won = match.score1 > match.score2;

      for (const pid of match.team1) {
        const s = statsMap.get(pid);
        if (!s) continue;
        s.pointsFor += match.score1;
        s.pointsAgainst += match.score2;
        if (team1Won) {
          s.matchesWon++;
          s.totalPoints += match.score1; // accumulate score
        } else {
          s.matchesLost++;
          s.totalPoints += match.score1;
        }
      }
      for (const pid of match.team2) {
        const s = statsMap.get(pid);
        if (!s) continue;
        s.pointsFor += match.score2;
        s.pointsAgainst += match.score1;
        if (!team1Won) {
          s.matchesWon++;
          s.totalPoints += match.score2;
        } else {
          s.matchesLost++;
          s.totalPoints += match.score2;
        }
      }
    }
  }

  return Array.from(statsMap.values());
}

export function generateNextRound(
  players: Player[],
  tournament: Tournament
): Round | null {
  if (tournament.format === 'mexicano') {
    const allCompleted = tournament.rounds.every((r) =>
      r.matches.every((m) => m.completed)
    );
    if (tournament.rounds.length > 0 && !allCompleted) return null;
    return mexicanoRound(players, tournament);
  }
  return null; // Americano generates all rounds upfront
}

export function generateAmericanoRounds(
  players: Player[],
  pointsToWin: number
): Round[] {
  return americanoRounds(players, pointsToWin);
}
