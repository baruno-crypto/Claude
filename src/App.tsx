import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import PlayersPage from './pages/PlayersPage';
import TournamentsPage from './pages/TournamentsPage';
import NewTournamentPage from './pages/NewTournamentPage';
import TournamentDetailPage from './pages/TournamentDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/tournaments" element={<TournamentsPage />} />
          <Route path="/tournaments/new" element={<NewTournamentPage />} />
          <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
