import { Link } from 'react-router-dom';
import { Trophy, Users, PlusCircle, ChevronRight } from 'lucide-react';
import { getTournaments, getPlayers } from '../store';
import Badge from '../components/Badge';

export default function HomePage() {
  const tournaments = getTournaments();
  const players = getPlayers();
  const active = tournaments.filter((t) => t.status === 'active');

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-2xl text-white p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-green-400 rounded-xl flex items-center justify-center text-green-900 font-bold text-xl">
            🏓
          </div>
          <div>
            <h2 className="text-xl font-bold">Padel Manager</h2>
            <p className="text-green-300 text-sm">Mexicano &amp; Americano tournaments</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Stat label="Players" value={players.length} />
          <Stat label="Tournaments" value={tournaments.length} />
          <Stat label="Active" value={active.length} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/tournaments/new"
          className="bg-green-700 hover:bg-green-800 text-white rounded-xl p-4 flex items-center gap-3 transition-colors shadow-sm"
        >
          <PlusCircle size={22} />
          <div>
            <p className="font-semibold text-sm">New Tournament</p>
            <p className="text-green-300 text-xs">Start playing</p>
          </div>
        </Link>
        <Link
          to="/players"
          className="bg-white hover:bg-green-50 text-green-900 rounded-xl p-4 flex items-center gap-3 transition-colors shadow-sm border border-green-200"
        >
          <Users size={22} className="text-green-600" />
          <div>
            <p className="font-semibold text-sm">Manage Players</p>
            <p className="text-gray-400 text-xs">{players.length} registered</p>
          </div>
        </Link>
      </div>

      {/* Active tournaments */}
      {active.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active Tournaments</h3>
          <div className="space-y-2">
            {active.map((t) => {
              const allMatches = t.rounds.flatMap((r) => r.matches);
              const done = allMatches.filter((m) => m.completed).length;
              return (
                <Link
                  key={t.id}
                  to={`/tournaments/${t.id}`}
                  className="bg-white rounded-xl border border-green-100 shadow-sm flex items-center gap-3 px-4 py-3 hover:border-green-300 transition-colors"
                >
                  <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Trophy size={16} className="text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge label={t.format} variant="blue" />
                      <span className="text-xs text-gray-400">Round {t.rounds.length} · {done}/{allMatches.length} done</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {tournaments.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <Trophy size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">No tournaments yet</p>
          <p className="text-sm mt-1">Create your first tournament to get started</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-green-800/50 rounded-xl p-3 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-green-300 text-xs mt-0.5">{label}</p>
    </div>
  );
}
