import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Info } from 'lucide-react';
import { getPlayers, getTournaments, saveTournaments } from '../store';
import type { TournamentFormat } from '../types';
import { generateAmericanoRounds } from '../utils/tournament';

const FORMAT_INFO = {
  mexicano: 'Partners rotate each round based on current standings. Top players team up against each other. Points accumulate throughout.',
  americano: 'All rounds are generated upfront. Each player partners with different players across rounds. Points accumulate.',
};

export default function NewTournamentPage() {
  const navigate = useNavigate();
  const allPlayers = getPlayers();

  const [name, setName] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('mexicano');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pointsToWin, setPointsToWin] = useState(24);
  const [error, setError] = useState('');

  function togglePlayer(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function create() {
    if (!name.trim()) { setError('Tournament name is required'); return; }
    if (selectedIds.length < 4) { setError('Select at least 4 players'); return; }
    if (selectedIds.length % 4 !== 0) {
      setError('Number of players must be a multiple of 4 (4, 8, 12, ...)');
      return;
    }

    const players = allPlayers.filter((p) => selectedIds.includes(p.id));
    const rounds = format === 'americano'
      ? generateAmericanoRounds(players, pointsToWin)
      : [];

    const tournament = {
      id: crypto.randomUUID(),
      name: name.trim(),
      format,
      status: 'active' as const,
      playerIds: selectedIds,
      rounds,
      pointsToWin,
      createdAt: new Date().toISOString(),
    };

    const all = [...getTournaments(), tournament];
    saveTournaments(all);
    navigate(`/tournaments/${tournament.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-green-900">New Tournament</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-green-200 p-5 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunday Mexicano #1"
            className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
          <div className="grid grid-cols-2 gap-3">
            {(['mexicano', 'americano'] as TournamentFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  format === f
                    ? 'border-green-600 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <p className="font-semibold capitalize text-gray-900">{f}</p>
                <p className="text-xs text-gray-500 mt-1">{FORMAT_INFO[f]}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Points to win */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Points per game</label>
          <div className="flex gap-2">
            {[16, 20, 24, 32].map((pts) => (
              <button
                key={pts}
                onClick={() => setPointsToWin(pts)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  pointsToWin === pts
                    ? 'bg-green-700 text-white border-green-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                }`}
              >
                {pts}
              </button>
            ))}
          </div>
        </div>

        {/* Players */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Select Players <span className="text-green-600">({selectedIds.length} selected)</span>
            </label>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Info size={12} /> Must be multiple of 4
            </span>
          </div>
          {allPlayers.length === 0 ? (
            <p className="text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg p-4 text-center">
              No players yet — <a href="/players" className="text-green-600 underline">add some first</a>
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allPlayers.map((p) => {
                const selected = selectedIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                      selected
                        ? 'bg-green-100 border-green-500 text-green-900 font-medium'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-green-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${selected ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={create}
          className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <Trophy size={18} />
          Create Tournament
        </button>
      </div>
    </div>
  );
}
