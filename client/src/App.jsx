import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import RaceLive from './pages/RaceLive';
import Garage from './pages/Garage';
import Rankings from './pages/Rankings';
import Welcome from './pages/Welcome';
import Admin from './pages/Admin';
import { API_URL } from './config';


function App() {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for saved player
    const savedPlayerId = localStorage.getItem('playerId');
    if (savedPlayerId) {
      fetchPlayer(savedPlayerId);
      
      // Refresh player data every 10 seconds to update credits
      const interval = setInterval(() => {
        fetchPlayer(savedPlayerId);
      }, 10000);
      
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchPlayer = async (playerId) => {
    try {
const res = await fetch(`${API_URL}/api/player/${playerId}`);
      if (res.ok) {
        const data = await res.json();
        setPlayer(data);
      } else {
        localStorage.removeItem('playerId');
      }
    } catch (err) {
      console.error('Failed to fetch player:', err);
    }
    setLoading(false);
  };

  const handleCreatePlayer = async (name) => {
    try {
      const res = await fetch(`${API_URL}/api/player/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('playerId', data.playerId);
        await fetchPlayer(data.playerId);
        return true;
      }
    } catch (err) {
      console.error('Failed to create player:', err);
    }
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem('playerId');
    setPlayer(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  if (!player) {
    return <Welcome onCreatePlayer={handleCreatePlayer} />;
  }

  return (
    <Layout player={player} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Dashboard player={player} />} />
        <Route path="/race/:raceId" element={<RaceLive player={player} onPlayerUpdate={() => fetchPlayer(player.id)} />} />
        <Route path="/garage" element={<Garage player={player} onUpdate={() => fetchPlayer(player.id)} />} />
        <Route path="/rankings" element={<Rankings player={player} />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
