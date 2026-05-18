import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';

function Dashboard({ player }) {
  const [races, setRaces] = useState([]);
  const [currentRace, setCurrentRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [player.id]);

  const fetchData = async () => {
    try {
      // Fetch races with player info
      const racesRes = await fetch(`${API_URL}/api/race/list?playerId=${player.id}`);
      if (racesRes.ok) {
        const racesData = await racesRes.json();
        setRaces(racesData);
      }

      // Check current race
      const currentRes = await fetch(`${API_URL}/api/player/${player.id}/current-race`);
      if (currentRes.ok) {
        const currentData = await currentRes.json();
        setCurrentRace(currentData.inRace ? currentData : null);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
    setLoading(false);
  };

  const handleRegister = async (raceId) => {
    try {
      const res = await fetch(`${API_URL}/api/race/${raceId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boatId: player.boat.id })
      });

      if (res.ok) {
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || 'Erreur lors de l\'inscription');
      }
    } catch (err) {
      console.error('Failed to register:', err);
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === races.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(races.map(r => r.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Supprimer ${selected.size} course(s) ? Cette action est irréversible.`)) return;

    await Promise.all([...selected].map(id =>
      fetch(`${API_URL}/api/admin/race/${id}`, { method: 'DELETE' })
    ));

    setSelected(new Set());
    setDeleteMode(false);
    fetchData();
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatCountdown = (timestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = timestamp - now;
    
    if (diff <= 0) return 'En cours';
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const getStatusBadge = (race) => {
    // If player finished this race, show "Terminé pour vous"
    if (race.status === 'active' && race.playerFinished) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
          ✓ Terminé pour vous
        </span>
      );
    }
    
    const badges = {
      upcoming: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'À venir' },
      active: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'En cours' },
      finished: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Terminée' }
    };
    const badge = badges[race.status] || badges.upcoming;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-white text-center">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Current race banner */}
      {currentRace && (
        <div className="mb-8 bg-gradient-to-r from-green-600/30 to-ocean-600/30 rounded-xl p-6 border border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🏁</span>
                <h2 className="text-xl font-bold text-white">Course en cours</h2>
              </div>
              <p className="text-ocean-200 text-lg">{currentRace.raceName}</p>
              <p className="text-ocean-400 text-sm mt-1">
                Waypoint {currentRace.currentWaypoint} / {currentRace.waypoints.length}
              </p>
            </div>
            <Link
              to={`/race/${currentRace.raceId}`}
              className="px-6 py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <span>🎮</span>
              <span>Rejoindre</span>
            </Link>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-ocean-900/50 rounded-xl p-4 border border-ocean-700">
          <div className="text-ocean-400 text-sm mb-1">Courses</div>
          <div className="text-2xl font-bold text-white">{player.stats.races}</div>
        </div>
        <div className="bg-ocean-900/50 rounded-xl p-4 border border-ocean-700">
          <div className="text-ocean-400 text-sm mb-1">Victoires</div>
          <div className="text-2xl font-bold text-yellow-400">{player.stats.wins}</div>
        </div>
        <div className="bg-ocean-900/50 rounded-xl p-4 border border-ocean-700">
          <div className="text-ocean-400 text-sm mb-1">Podiums</div>
          <div className="text-2xl font-bold text-orange-400">{player.stats.podiums}</div>
        </div>
        <div className="bg-ocean-900/50 rounded-xl p-4 border border-ocean-700">
          <div className="text-ocean-400 text-sm mb-1">Bateau</div>
          <div className="text-lg font-bold text-white truncate">{player.boat?.name || 'Aucun'}</div>
        </div>
      </div>

      {/* Races list */}
      <div className="bg-ocean-900/50 rounded-xl border border-ocean-700 overflow-hidden">
        <div className="p-4 border-b border-ocean-700 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🏁</span>
            <span>Courses disponibles</span>
          </h2>
          <div className="flex items-center gap-2">
            {deleteMode && (
              <>
                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-1 bg-ocean-700 hover:bg-ocean-600 text-ocean-200 text-sm rounded-lg transition-colors"
                >
                  {selected.size === races.length ? 'Tout désélect.' : 'Tout sélect.'}
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selected.size === 0}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors border ${
                    selected.size > 0
                      ? 'bg-red-600/30 hover:bg-red-600/50 border-red-500/60 text-red-300'
                      : 'bg-ocean-800 border-ocean-600 text-ocean-500 cursor-not-allowed'
                  }`}
                >
                  🗑️ Supprimer ({selected.size})
                </button>
                <button
                  onClick={() => { setDeleteMode(false); setSelected(new Set()); }}
                  className="px-3 py-1 bg-ocean-800 hover:bg-ocean-700 text-ocean-300 text-sm rounded-lg transition-colors"
                >
                  Annuler
                </button>
              </>
            )}
            {!deleteMode && (
              <button
                onClick={() => setDeleteMode(true)}
                className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 text-sm rounded-lg transition-colors"
              >
                🗑️ Gérer les courses
              </button>
            )}
          </div>
        </div>

        {races.length === 0 ? (
          <div className="p-8 text-center text-ocean-400">
            Aucune course disponible pour le moment
          </div>
        ) : (
          <div className="divide-y divide-ocean-700">
            {races.map(race => (
              <div
                key={race.id}
                className={`p-4 hover:bg-ocean-800/50 transition-colors ${deleteMode && selected.has(race.id) ? 'bg-red-900/20' : ''}`}
                onClick={deleteMode ? () => toggleSelect(race.id) : undefined}
                style={deleteMode ? { cursor: 'pointer' } : {}}
              >
                <div className="flex items-center justify-between">
                  {deleteMode && (
                    <input
                      type="checkbox"
                      checked={selected.has(race.id)}
                      onChange={() => toggleSelect(race.id)}
                      onClick={e => e.stopPropagation()}
                      className="mr-3 w-4 h-4 accent-red-500 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{race.name}</h3>
                      {getStatusBadge(race)}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-ocean-300">
                      <span className="flex items-center gap-1">
                        <span>📍</span>
                        {race.startLocation} → {race.endLocation}
                      </span>
                      <span className="flex items-center gap-1">
                        <span>🚩</span>
                        {race.waypointCount} waypoints
                      </span>
                      <span className="flex items-center gap-1">
                        <span>👥</span>
                        {race.participantCount} participants
                      </span>
                      {race.status === 'upcoming' && (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <span>⏱️</span>
                          Départ dans {formatCountdown(race.startTime)}
                        </span>
                      )}
                    </div>
                  </div>

                  {!deleteMode && <div className="ml-4">
                    {race.status === 'active' ? (
                      <Link
                        to={`/race/${race.id}`}
                        className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white font-medium rounded-lg transition-colors"
                      >
                        Voir la course
                      </Link>
                    ) : race.status === 'upcoming' ? (
                      <button
                        onClick={() => handleRegister(race.id)}
                        className="px-4 py-2 bg-ocean-500 hover:bg-ocean-400 text-white font-medium rounded-lg transition-colors"
                      >
                        S'inscrire
                      </button>
                    ) : (
                      <Link
                        to={`/race/${race.id}`}
                        className="px-4 py-2 bg-ocean-700 hover:bg-ocean-600 text-white font-medium rounded-lg transition-colors"
                      >
                        Résultats
                      </Link>
                    )}
                  </div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Boat info */}
      {player.boat && (
        <div className="mt-8 bg-ocean-900/50 rounded-xl border border-ocean-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>⛵</span>
            <span>Mon bateau : {player.boat.name}</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-ocean-800/50 rounded-lg p-3">
              <div className="text-ocean-400 text-xs mb-1">Vitesse max</div>
              <div className="text-white font-bold">{player.boat.stats.speedMax} kn</div>
            </div>
            <div className="bg-ocean-800/50 rounded-lg p-3">
              <div className="text-ocean-400 text-xs mb-1">VMG Près</div>
              <div className="text-white font-bold">{(player.boat.stats.vmgUpwind * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-ocean-800/50 rounded-lg p-3">
              <div className="text-ocean-400 text-xs mb-1">VMG Portant</div>
              <div className="text-white font-bold">{(player.boat.stats.vmgDownwind * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-ocean-800/50 rounded-lg p-3">
              <div className="text-ocean-400 text-xs mb-1">VMG Travers</div>
              <div className="text-white font-bold">{(player.boat.stats.vmgReaching * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-ocean-800/50 rounded-lg p-3">
              <div className="text-ocean-400 text-xs mb-1">Résist. tempête</div>
              <div className="text-white font-bold">{(player.boat.stats.stormResistance * 100).toFixed(0)}%</div>
            </div>
          </div>
          <Link
            to="/garage"
            className="mt-4 inline-flex items-center gap-2 text-ocean-300 hover:text-white transition-colors"
          >
            <span>🔧</span>
            <span>Améliorer mon bateau</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
