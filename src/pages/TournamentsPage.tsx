import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ChevronRight, PlusCircle, Trash2 } from 'lucide-react';
import { getTournaments, saveTournaments } from '../store';
import type { Tournament } from '../types';
import Badge from '../components/Badge';

const statusVariant: Record<string, 'green' | 'yellow' | 'gray'> = {
  active: 'green',
  pending: 'yellow',
  completed: 'gray',
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>(getTournaments);

  function remove(id: string) {
    if (!confirm('Delete this tournament?')) return;
    const updated = tournaments.filter((t) => t.id !== id);
    saveTournaments(updated);
    setTournaments(updated);
  }

  const active = tournaments.filter((t) => t.status !== 'completed');
  const completed = tournaments.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-green-900">Tournaments</h2>
          <p className="text-green-700 text-sm mt-1">{tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/tournaments/new"
          className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <PlusCircle size={16} />
          New
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-16 text-green-500">
          <Trophy size={48} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No tournaments yet</p>
          <Link to="/tournaments/new" className="text-green-700 text-sm underline">Create your first tournament</Link>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active</h3>
              <div className="space-y-2">
                {active.map((t) => <TournamentCard key={t.id} t={t} onRemove={remove} />)}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Completed</h3>
              <div className="space-y-2">
                {completed.map((t) => <TournamentCard key={t.id} t={t} onRemove={remove} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TournamentCard({ t, onRemove }: { t: Tournament; onRemove: (id: string) => void }) {
  const completedMatches = t.rounds.flatMap((r) => r.matches).filter((m) => m.completed).length;
  const totalMatches = t.rounds.flatMap((r) => r.matches).length;

  return (
    <div className="bg-white rounded-xl border border-green-100 shadow-sm flex items-center gap-3 px-4 py-3">
      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
        <Trophy size={18} className="text-green-700" />
      </div>
      <Link to={`/tournaments/${t.id}`} className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{t.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge label={t.format} variant="blue" />
          <Badge label={t.status} variant={statusVariant[t.status]} />
          <span className="text-xs text-gray-400">
            {t.playerIds.length} players · R{t.rounds.length} · {completedMatches}/{totalMatches} matches
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{new Date(t.createdAt).toLocaleDateString()}</p>
      </Link>
      <button onClick={() => onRemove(t.id)} className="text-red-300 hover:text-red-500 transition-colors ml-1">
        <Trash2 size={15} />
      </button>
      <Link to={`/tournaments/${t.id}`} className="text-green-500">
        <ChevronRight size={18} />
      </Link>
    </div>
  );
}
