import { Link, useLocation } from 'react-router-dom';
import { Trophy, Users, Home, PlusCircle } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/players', icon: Users, label: 'Players' },
  { to: '/tournaments', icon: Trophy, label: 'Tournaments' },
  { to: '/tournaments/new', icon: PlusCircle, label: 'New' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-green-50">
      {/* Header */}
      <header className="bg-green-800 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-400 rounded-full flex items-center justify-center text-green-900 font-bold text-lg">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none">Padel Manager</h1>
            <p className="text-green-300 text-xs">Track your matches & rankings</p>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-green-700 text-white sticky top-0 z-10 shadow">
        <div className="max-w-4xl mx-auto px-4 flex gap-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to) && to !== '/tournaments/new');
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-green-900 text-white border-b-2 border-green-300'
                    : 'text-green-200 hover:bg-green-600 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      <footer className="text-center text-xs text-green-600 py-4 border-t border-green-200">
        Padel Manager — Mexicano &amp; Americano
      </footer>
    </div>
  );
}
