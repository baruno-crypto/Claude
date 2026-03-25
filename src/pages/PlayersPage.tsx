import { useState } from 'react';
import { UserPlus, Trash2, User } from 'lucide-react';
import { getPlayers, savePlayers } from '../store';
import type { Player } from '../types';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>(getPlayers);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function addPlayer() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required'); return; }
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Player already exists');
      return;
    }
    const updated = [
      ...players,
      { id: crypto.randomUUID(), name: trimmed, createdAt: new Date().toISOString() },
    ];
    savePlayers(updated);
    setPlayers(updated);
    setName('');
    setError('');
  }

  function removePlayer(id: string) {
    if (!confirm('Remove this player?')) return;
    const updated = players.filter((p) => p.id !== id);
    savePlayers(updated);
    setPlayers(updated);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-green-900">Players</h2>
        <p className="text-green-700 text-sm mt-1">{players.length} registered player{players.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Add player */}
      <div className="bg-white rounded-xl shadow-sm border border-green-200 p-4">
        <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
          <UserPlus size={18} className="text-green-600" />
          Add Player
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            placeholder="Player name"
            className="flex-1 border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={addPlayer}
            className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Add
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      {/* Player list */}
      {players.length === 0 ? (
        <div className="text-center py-16 text-green-500">
          <User size={48} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No players yet</p>
          <p className="text-sm">Add your first player above</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {players.map((p, idx) => (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-green-100 shadow-sm flex items-center gap-3 px-4 py-3"
            >
              <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {initials(p.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{p.name}</p>
              </div>
              <span className="text-xs text-gray-400">#{idx + 1}</span>
              <button
                onClick={() => removePlayer(p.id)}
                className="text-red-400 hover:text-red-600 transition-colors ml-1"
                title="Remove player"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
