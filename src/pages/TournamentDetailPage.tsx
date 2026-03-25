import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, ChevronDown, ChevronUp, Play, CheckCircle2, BarChart2, Flag } from 'lucide-react';
import { getTournament, getPlayers, updateTournament } from '../store';
import type { Match, Player, Round, Tournament } from '../types';
import { computeStats, generateNextRound } from '../utils/tournament';
import Badge from '../components/Badge';

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [tournament, setTournament] = useState<Tournament | null>(() =>
    id ? getTournament(id) ?? null : null
  );
  const [allPlayers] = useState<Player[]>(getPlayers);
  const [activeTab, setActiveTab] = useState<'rounds' | 'rankings'>('rounds');
  const [expandedRound, setExpandedRound] = useState<string | null>(
    () => tournament?.rounds.at(-1)?.id ?? null
  );

  if (!tournament) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Trophy size={48} className="mx-auto mb-3 opacity-30" />
        <p>Tournament not found</p>
      </div>
    );
  }

  const players = allPlayers.filter((p) => tournament.playerIds.includes(p.id));
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

  function save(updated: Tournament) {
    updateTournament(updated);
    setTournament(updated);
  }

  function addNextRound() {
    const round = generateNextRound(players, tournament!);
    if (!round) return;
    const updated = { ...tournament!, rounds: [...tournament!.rounds, round] };
    save(updated);
    setExpandedRound(round.id);
  }

  function completeTournament() {
    if (!confirm('Mark tournament as completed?')) return;
    save({ ...tournament!, status: 'completed' });
  }

  function updateScore(roundId: string, matchId: string, field: 'score1' | 'score2', raw: string) {
    const val = raw === '' ? null : Math.max(0, parseInt(raw) || 0);
    const updated = {
      ...tournament!,
      rounds: tournament!.rounds.map((r) =>
        r.id !== roundId
          ? r
          : {
              ...r,
              matches: r.matches.map((m) =>
                m.id !== matchId ? m : { ...m, [field]: val }
              ),
            }
      ),
    };
    save(updated);
  }

  function completeMatch(roundId: string, matchId: string) {
    const round = tournament!.rounds.find((r) => r.id === roundId)!;
    const match = round.matches.find((m) => m.id === matchId)!;
    if (match.score1 === null || match.score2 === null) return;
    const totalAllowed = tournament!.pointsToWin;
    if (match.score1 + match.score2 !== totalAllowed) {
      alert(`Scores must add up to ${totalAllowed} (e.g. ${Math.floor(totalAllowed * 0.6)} - ${Math.ceil(totalAllowed * 0.4)})`);
      return;
    }
    const updated = {
      ...tournament!,
      rounds: tournament!.rounds.map((r) =>
        r.id !== roundId
          ? r
          : {
              ...r,
              matches: r.matches.map((m) =>
                m.id !== matchId ? m : { ...m, completed: true }
              ),
            }
      ),
    };
    save(updated);
  }

  function uncompleteMatch(roundId: string, matchId: string) {
    const updated = {
      ...tournament!,
      rounds: tournament!.rounds.map((r) =>
        r.id !== roundId
          ? r
          : {
              ...r,
              matches: r.matches.map((m) =>
                m.id !== matchId ? m : { ...m, completed: false }
              ),
            }
      ),
    };
    save(updated);
  }

  const allMatchesInLastRoundCompleted =
    tournament.rounds.length === 0 ||
    tournament.rounds.at(-1)!.matches.every((m) => m.completed);

  const stats = computeStats(players, tournament);
  const rankedStats = [...stats].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-green-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold text-green-900">{tournament.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge label={tournament.format} variant="blue" />
              <Badge
                label={tournament.status}
                variant={tournament.status === 'active' ? 'green' : tournament.status === 'completed' ? 'gray' : 'yellow'}
              />
              <span className="text-xs text-gray-400">{tournament.playerIds.length} players · {tournament.pointsToWin}pts</span>
            </div>
          </div>
          {tournament.status === 'active' && (
            <button
              onClick={completeTournament}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Flag size={13} />
              Finish
            </button>
          )}
        </div>

        {/* Progress bar */}
        {tournament.rounds.length > 0 && (() => {
          const all = tournament.rounds.flatMap((r) => r.matches);
          const done = all.filter((m) => m.completed).length;
          const pct = all.length ? Math.round((done / all.length) * 100) : 0;
          return (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{done}/{all.length} matches completed</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 bg-green-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('rounds')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'rounds' ? 'bg-green-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-green-300'}`}
        >
          <Play size={14} />
          Rounds
        </button>
        <button
          onClick={() => setActiveTab('rankings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'rankings' ? 'bg-green-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-green-300'}`}
        >
          <BarChart2 size={14} />
          Rankings
        </button>
      </div>

      {/* Rounds Tab */}
      {activeTab === 'rounds' && (
        <div className="space-y-3">
          {tournament.rounds.length === 0 && tournament.format === 'mexicano' && (
            <div className="bg-white rounded-xl border border-dashed border-green-300 p-6 text-center text-green-600">
              <p className="font-medium">No rounds yet</p>
              <p className="text-sm text-gray-400 mt-1">Generate the first round to start playing</p>
            </div>
          )}

          {tournament.rounds.map((round) => (
            <RoundCard
              key={round.id}
              round={round}
              tournament={tournament}
              playerMap={playerMap}
              expanded={expandedRound === round.id}
              onToggle={() => setExpandedRound(expandedRound === round.id ? null : round.id)}
              onScoreChange={updateScore}
              onComplete={completeMatch}
              onUncomplete={uncompleteMatch}
            />
          ))}

          {tournament.status === 'active' && tournament.format === 'mexicano' && allMatchesInLastRoundCompleted && (
            <button
              onClick={addNextRound}
              className="w-full bg-green-50 hover:bg-green-100 text-green-800 border border-dashed border-green-400 rounded-xl py-4 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Play size={16} />
              Generate Round {tournament.rounds.length + 1}
            </button>
          )}
        </div>
      )}

      {/* Rankings Tab */}
      {activeTab === 'rankings' && (
        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-100">
            <h3 className="font-semibold text-green-900 flex items-center gap-2">
              <BarChart2 size={16} />
              Standings
            </h3>
          </div>
          {rankedStats.length === 0 ? (
            <p className="p-6 text-center text-gray-400 text-sm">No matches played yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {rankedStats.map((s, idx) => {
                const p = playerMap.get(s.playerId);
                const isFirst = idx === 0 && s.totalPoints > 0;
                return (
                  <div key={s.playerId} className={`flex items-center gap-3 px-4 py-3 ${isFirst ? 'bg-yellow-50' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      idx === 0 ? 'bg-yellow-400 text-yellow-900'
                      : idx === 1 ? 'bg-gray-300 text-gray-700'
                      : idx === 2 ? 'bg-orange-300 text-orange-900'
                      : 'bg-gray-100 text-gray-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {p ? initials(p.name) : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{p?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-400">
                        {s.matchesPlayed}P · {s.matchesWon}W · {s.matchesLost}L · {s.pointsFor}-{s.pointsAgainst}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-800 text-lg">{s.totalPoints}</p>
                      <p className="text-xs text-gray-400">pts</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── RoundCard ────────────────────────────────────────────────────────────────

function RoundCard({
  round,
  tournament,
  playerMap,
  expanded,
  onToggle,
  onScoreChange,
  onComplete,
  onUncomplete,
}: {
  round: Round;
  tournament: Tournament;
  playerMap: Map<string, Player>;
  expanded: boolean;
  onToggle: () => void;
  onScoreChange: (roundId: string, matchId: string, field: 'score1' | 'score2', val: string) => void;
  onComplete: (roundId: string, matchId: string) => void;
  onUncomplete: (roundId: string, matchId: string) => void;
}) {
  const completedCount = round.matches.filter((m) => m.completed).length;
  const allDone = completedCount === round.matches.length;

  return (
    <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-green-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {allDone ? (
            <CheckCircle2 size={18} className="text-green-500" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-green-400 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-green-400" />
            </div>
          )}
          <span className="font-semibold text-gray-900">Round {round.number}</span>
          <span className="text-xs text-gray-400">{completedCount}/{round.matches.length} done</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-green-50 divide-y divide-gray-50">
          {round.matches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              tournament={tournament}
              playerMap={playerMap}
              roundId={round.id}
              onScoreChange={onScoreChange}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MatchRow ─────────────────────────────────────────────────────────────────

function MatchRow({
  match,
  tournament,
  playerMap,
  roundId,
  onScoreChange,
  onComplete,
  onUncomplete,
}: {
  match: Match;
  tournament: Tournament;
  playerMap: Map<string, Player>;
  roundId: string;
  onScoreChange: (roundId: string, matchId: string, field: 'score1' | 'score2', val: string) => void;
  onComplete: (roundId: string, matchId: string) => void;
  onUncomplete: (roundId: string, matchId: string) => void;
}) {
  const pts = tournament.pointsToWin;

  const team1Won = match.completed && match.score1! > match.score2!;
  const team2Won = match.completed && match.score2! > match.score1!;

  return (
    <div className={`px-4 py-4 ${match.completed ? 'bg-green-50/50' : ''}`}>
      <div className="flex items-center gap-2">
        {/* Team 1 */}
        <div className={`flex-1 min-w-0 ${team1Won ? 'font-semibold' : ''}`}>
          <TeamNames ids={match.team1} playerMap={playerMap} won={team1Won} />
        </div>

        {/* Scores */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {match.completed ? (
            <>
              <span className={`w-8 text-center font-bold text-lg ${team1Won ? 'text-green-700' : 'text-gray-400'}`}>
                {match.score1}
              </span>
              <span className="text-gray-300 text-sm">—</span>
              <span className={`w-8 text-center font-bold text-lg ${team2Won ? 'text-green-700' : 'text-gray-400'}`}>
                {match.score2}
              </span>
            </>
          ) : (
            <>
              <input
                type="number"
                min={0}
                max={pts}
                value={match.score1 ?? ''}
                onChange={(e) => onScoreChange(roundId, match.id, 'score1', e.target.value)}
                placeholder="0"
                className="w-12 text-center border border-gray-300 rounded-lg py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <span className="text-gray-300">—</span>
              <input
                type="number"
                min={0}
                max={pts}
                value={match.score2 ?? ''}
                onChange={(e) => onScoreChange(roundId, match.id, 'score2', e.target.value)}
                placeholder="0"
                className="w-12 text-center border border-gray-300 rounded-lg py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </>
          )}
        </div>

        {/* Team 2 */}
        <div className={`flex-1 min-w-0 text-right ${team2Won ? 'font-semibold' : ''}`}>
          <TeamNames ids={match.team2} playerMap={playerMap} won={team2Won} align="right" />
        </div>

        {/* Action */}
        <div className="flex-shrink-0 ml-1">
          {match.completed ? (
            <button
              onClick={() => onUncomplete(roundId, match.id)}
              title="Edit score"
              className="text-green-500 hover:text-orange-500 transition-colors"
            >
              <CheckCircle2 size={20} />
            </button>
          ) : (
            <button
              onClick={() => onComplete(roundId, match.id)}
              disabled={match.score1 === null || match.score2 === null}
              title="Confirm score"
              className="text-gray-300 hover:text-green-600 disabled:opacity-30 transition-colors"
            >
              <CheckCircle2 size={20} />
            </button>
          )}
        </div>
      </div>

      {!match.completed && (
        <p className="text-xs text-gray-400 mt-1 text-center">
          Scores must total {pts}
        </p>
      )}
    </div>
  );
}

function TeamNames({
  ids,
  playerMap,
  won,
  align = 'left',
}: {
  ids: [string, string];
  playerMap: Map<string, Player>;
  won: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <div className={`text-${align}`}>
      {ids.map((id) => (
        <p key={id} className={`text-sm truncate ${won ? 'text-green-800 font-semibold' : 'text-gray-700'}`}>
          {playerMap.get(id)?.name ?? 'Unknown'}
        </p>
      ))}
    </div>
  );
}
