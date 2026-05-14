import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Rankings({ player }) {
  const [activeTab, setActiveTab] = useState('history');
  const [playerHistory, setPlayerHistory] = useState([]);
  const [finishedRaces, setFinishedRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState(null);
  const [raceResults, setRaceResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [player.id]);

  const fetchData = async () => {
    try {
      const [historyRes, racesRes] = await Promise.all([
        fetch(`/api/player/${player.id}/history`),
        fetch('/api/race/list?status=finished')
      ]);

      if (historyRes.ok) {
        setPlayerHistory(await historyRes.json());
      }
      if (racesRes.ok) {
        setFinishedRaces(await racesRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
    setLoading(false);
  };

  const fetchRaceResults = async (raceId) => {
    try {
      const res = await fetch(`/api/race/${raceId}/history`);
      if (res.ok) {
        setRaceResults(await res.json());
        setSelectedRace(raceId);
      }
    } catch (err) {
      console.error('Failed to fetch race results:', err);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMedalEmoji = (position) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return `#${position}`;
  };

  const getPositionColor = (position) => {
    if (position === 1) return 'text-yellow-400';
    if (position === 2) return 'text-gray-300';
    if (position === 3) return 'text-orange-400';
    return 'text-ocean-300';
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <span>🏆</span>
          <span>Classements</span>
        </h1>
        <p className="text-ocean-300">Votre historique et les résultats des courses</p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-ocean-900/50 rounded-xl p-4 border border-ocean-700">
          <div className="text-ocean-400 text-sm mb-1">Courses terminées</div>
          <div className="text-3xl font-bold text-white">{player.stats.races}</div>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/20 to-ocean-900/50 rounded-xl p-4 border border-yellow-500/30">
          <div className="text-yellow-400 text-sm mb-1">🥇 Victoires</div>
          <div className="text-3xl font-bold text-yellow-400">{player.stats.wins}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500/20 to-ocean-900/50 rounded-xl p-4 border border-orange-500/30">
          <div className="text-orange-400 text-sm mb-1">🏅 Podiums</div>
          <div className="text-3xl font-bold text-orange-400">{player.stats.podiums}</div>
        </div>
        <div className="bg-ocean-900/50 rounded-xl p-4 border border-ocean-700">
          <div className="text-ocean-400 text-sm mb-1">Taux de podium</div>
          <div className="text-3xl font-bold text-white">
            {player.stats.races > 0 
              ? `${Math.round((player.stats.podiums / player.stats.races) * 100)}%`
              : '-'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'history'
              ? 'bg-ocean-500 text-white'
              : 'bg-ocean-800 text-ocean-300 hover:bg-ocean-700'
          }`}
        >
          Mon historique
        </button>
        <button
          onClick={() => setActiveTab('races')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'races'
              ? 'bg-ocean-500 text-white'
              : 'bg-ocean-800 text-ocean-300 hover:bg-ocean-700'
          }`}
        >
          Courses terminées
        </button>
      </div>

      {/* Content */}
      {activeTab === 'history' ? (
        <div className="bg-ocean-900/50 rounded-xl border border-ocean-700 overflow-hidden">
          {playerHistory.length === 0 ? (
            <div className="p-8 text-center text-ocean-400">
              <div className="text-4xl mb-4">🚤</div>
              <p>Vous n'avez pas encore terminé de course</p>
              <Link to="/" className="text-ocean-300 hover:text-white mt-2 inline-block">
                Inscrivez-vous à une course →
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-ocean-800/50">
                <tr>
                  <th className="text-left p-4 text-ocean-300 font-medium">Course</th>
                  <th className="text-center p-4 text-ocean-300 font-medium">Position</th>
                  <th className="text-center p-4 text-ocean-300 font-medium">Crédits</th>
                  <th className="text-right p-4 text-ocean-300 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ocean-700/50">
                {playerHistory.map((race, index) => (
                  <tr key={index} className="hover:bg-ocean-800/30 transition-colors">
                    <td className="p-4">
                      <span className="text-white font-medium">{race.raceName}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-xl font-bold ${getPositionColor(race.position)}`}>
                        {getMedalEmoji(race.position)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-yellow-400 font-medium">
                        +{race.creditsEarned}
                      </span>
                    </td>
                    <td className="p-4 text-right text-ocean-400">
                      {formatDate(race.finishTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Race list */}
          <div className="bg-ocean-900/50 rounded-xl border border-ocean-700 overflow-hidden">
            <div className="p-4 border-b border-ocean-700">
              <h3 className="text-lg font-bold text-white">Courses terminées</h3>
            </div>
            {finishedRaces.length === 0 ? (
              <div className="p-8 text-center text-ocean-400">
                Aucune course terminée
              </div>
            ) : (
              <div className="divide-y divide-ocean-700/50">
                {finishedRaces.map(race => (
                  <button
                    key={race.id}
                    onClick={() => fetchRaceResults(race.id)}
                    className={`w-full p-4 text-left hover:bg-ocean-800/50 transition-colors ${
                      selectedRace === race.id ? 'bg-ocean-800/50' : ''
                    }`}
                  >
                    <div className="text-white font-medium">{race.name}</div>
                    <div className="text-sm text-ocean-400">
                      {race.participantCount} participants
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Race results */}
          <div className="bg-ocean-900/50 rounded-xl border border-ocean-700 overflow-hidden">
            <div className="p-4 border-b border-ocean-700">
              <h3 className="text-lg font-bold text-white">
                {selectedRace ? 'Résultats' : 'Sélectionnez une course'}
              </h3>
            </div>
            {!selectedRace ? (
              <div className="p-8 text-center text-ocean-400">
                Cliquez sur une course pour voir les résultats
              </div>
            ) : raceResults.length === 0 ? (
              <div className="p-8 text-center text-ocean-400">
                Aucun résultat disponible
              </div>
            ) : (
              <div className="divide-y divide-ocean-700/50">
                {raceResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 flex items-center gap-4 ${
                      result.playerId === player.id ? 'bg-green-500/10' : ''
                    }`}
                  >
                    <div className={`text-2xl font-bold w-12 text-center ${getPositionColor(result.position)}`}>
                      {getMedalEmoji(result.position)}
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${
                        result.playerId === player.id ? 'text-green-400' : 'text-white'
                      }`}>
                        {result.boatName}
                        {result.playerId === player.id && <span className="ml-2 text-xs">(Vous)</span>}
                      </div>
                      {result.isBot && (
                        <span className="text-xs text-ocean-500">BOT</span>
                      )}
                    </div>
                    <div className="text-yellow-400 font-medium">
                      +{result.creditsEarned}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Rankings;
