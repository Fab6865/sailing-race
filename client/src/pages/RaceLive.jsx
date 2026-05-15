import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import RaceMap from '../components/RaceMap';
import RankingPanel from '../components/RankingPanel';
import HeadingIndicator from '../components/HeadingIndicator';
import WindAlert from '../components/WindAlert';
import { API_URL } from '../config';

// Helper functions
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}

function getCreditsForPosition(position) {
  const creditTable = {
    1: 500, 2: 350, 3: 250, 4: 180, 5: 150,
    6: 120, 7: 100, 8: 80, 9: 60, 10: 50
  };
  return creditTable[position] || Math.max(10, 60 - position * 5);
}

function BoostPanel({ raceId, boatId, playerId, boostEnergy, boostActive, boostTimeLeft, onBoostUpdate, onPlayerUpdate }) {
  const [energy, setEnergy] = useState(boostEnergy);
  const [active, setActive] = useState(boostActive);
  const [timeLeft, setTimeLeft] = useState(boostTimeLeft);
  const [clicking, setClicking] = useState(false);

  // Sync with props
  useEffect(() => {
    setEnergy(boostEnergy);
    setActive(boostActive);
    setTimeLeft(boostTimeLeft);
  }, [boostEnergy, boostActive, boostTimeLeft]);

  // Countdown timer
  useEffect(() => {
    if (active && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(t => Math.max(0, t - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [active, timeLeft]);

  const handleClick = async () => {
    if (clicking || active) return;
    setClicking(true);
    
    try {
      const res = await fetch(`${API_URL}/api/race/${raceId}/boost-click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boatId })
      });
      
      if (res.ok) {
        const data = await res.json();
        setEnergy(data.energy);
        setActive(data.boostActive);
        setTimeLeft(data.boostTimeLeft);
        
        if (data.boostActivated) {
          onBoostUpdate();
        }
      }
    } catch (err) {
      console.error('Boost click failed:', err);
    }
    
    setTimeout(() => setClicking(false), 100);
  };

  const handleBuyBoost = async () => {
    if (!confirm('Acheter un boost pour 50 crédits ?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/race/${raceId}/boost-buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boatId, playerId })
      });
      
      if (res.ok) {
        const data = await res.json();
        setEnergy(0);
        setActive(true);
        setTimeLeft(data.boostTimeLeft);
        onBoostUpdate();
        // Refresh player data to update credits immediately
        if (onPlayerUpdate) {
          onPlayerUpdate();
        }
      } else {
        const error = await res.json();
        alert(error.error || 'Erreur');
      }
    } catch (err) {
      console.error('Buy boost failed:', err);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 border-b border-ocean-700">
      <h3 className="text-white font-medium mb-3">🚀 Boost</h3>
      
      {active ? (
        <div className="bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border border-yellow-500 rounded-lg p-4 text-center animate-pulse">
          <div className="text-2xl mb-1">⚡</div>
          <div className="text-yellow-400 font-bold text-lg">BOOST ACTIF!</div>
          <div className="text-white text-2xl font-bold">{formatTime(timeLeft)}</div>
          <div className="text-yellow-300 text-xs mt-1">+30% vitesse</div>
        </div>
      ) : (
        <>
          {/* Energy bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-ocean-400 mb-1">
              <span>Énergie</span>
              <span>{energy}%</span>
            </div>
            <div className="h-4 bg-ocean-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200"
                style={{ width: `${energy}%` }}
              />
            </div>
          </div>

          {/* Click button */}
          <button
            onClick={handleClick}
            disabled={clicking}
            className="w-full py-4 bg-gradient-to-b from-ocean-600 to-ocean-700 hover:from-ocean-500 hover:to-ocean-600 
                       active:from-ocean-700 active:to-ocean-800 text-white rounded-lg font-bold text-lg
                       transition-all transform active:scale-95 border border-ocean-500 shadow-lg
                       disabled:opacity-50"
          >
            <div className="text-2xl mb-1">⛵</div>
            <div>CLIQUER!</div>
            <div className="text-xs opacity-70">+5% énergie par clic</div>
          </button>

          {/* Buy boost option */}
          <button
            onClick={handleBuyBoost}
            className="w-full mt-2 py-2 bg-yellow-600/20 hover:bg-yellow-600/40 border border-yellow-500/50 
                       text-yellow-400 rounded-lg text-sm transition-colors"
          >
            💰 Acheter boost (50 crédits)
          </button>

          <div className="text-ocean-400 text-xs text-center mt-2">
            100% énergie = Boost 2 min (+30% vitesse)
          </div>
        </>
      )}
    </div>
  );
}

function RaceLive({ player, onPlayerUpdate }) {
  const { raceId } = useParams();
  const [raceData, setRaceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSail, setSelectedSail] = useState('genois');
  const [nextRaces, setNextRaces] = useState([]);
  const [registering, setRegistering] = useState(false);
  const [showMobileRanking, setShowMobileRanking] = useState(false);
  const pollInterval = useRef(null);

  useEffect(() => {
    fetchRaceData();
    
    // Poll every 10 seconds
    pollInterval.current = setInterval(fetchRaceData, 10000);
    
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [raceId, player.id]);

  const fetchRaceData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/race/${raceId}/live?playerId=${player.id}`);
      if (res.ok) {
        const data = await res.json();
        setRaceData(data);
        setError(null);
      } else {
        setError('Course non trouvée');
      }
    } catch (err) {
      console.error('Failed to fetch race data:', err);
      setError('Erreur de connexion');
    }
    setLoading(false);
  };

  // Change sail type
  const handleSailChange = async (sailType) => {
    setSelectedSail(sailType);
    try {
      await fetch(`${API_URL}/api/race/${raceId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boatId: player.boat.id,
          heading: raceData?.playerBoat?.heading || 0,
          sailType
        })
      });
      fetchRaceData();
    } catch (err) {
      console.error('Failed to change sail:', err);
    }
  };

  // Force finish race (debug button)
  const handleForceFinish = async () => {
    if (!confirm('Terminer la course de force ? (debug)')) return;
    try {
      await fetch(`${API_URL}/api/race/${raceId}/force-finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boatId: player.boat.id })
      });
      fetchRaceData();
    } catch (err) {
      console.error('Failed to force finish:', err);
    }
  };

  // Sync selected sail from server
  useEffect(() => {
    if (raceData?.playerBoat?.sailType) {
      setSelectedSail(raceData.playerBoat.sailType);
    }
  }, [raceData?.playerBoat?.sailType]);

  // Fetch next available races when player finishes
  useEffect(() => {
    if (raceData?.playerBoat?.finished) {
      fetchNextRaces();
    }
  }, [raceData?.playerBoat?.finished]);

  const fetchNextRaces = async () => {
    try {
      const res = await fetch(`${API_URL}/api/race/list?status=upcoming`);
      if (res.ok) {
        const races = await res.json();
        setNextRaces(races);
      }
    } catch (err) {
      console.error('Failed to fetch next races:', err);
    }
  };

  const handleRegisterNextRace = async (nextRaceId) => {
    setRegistering(true);
    try {
      const res = await fetch(`${API_URL}/api/race/${nextRaceId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boatId: player.boat.id })
      });
      if (res.ok) {
        window.location.href = `/race/${nextRaceId}`;
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur lors de l\'inscription');
      }
    } catch (err) {
      console.error('Failed to register:', err);
      alert('Erreur de connexion');
    }
    setRegistering(false);
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-white text-xl">Chargement de la course...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <Link to="/" className="text-ocean-300 hover:text-white">
            Retour au dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!raceData) return null;

  const { race, wind, boats, playerBoat, rankings } = raceData;

  // Get target waypoint for heading indicator
  const targetWaypoint = playerBoat && race.waypoints[playerBoat.currentWaypoint];

  // Check if player has finished
  const playerFinished = playerBoat?.finished;
  const playerRanking = rankings.find(r => r.boatId === playerBoat?.boatId);

  // Show finish screen if player finished
  if (playerFinished && playerRanking) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center p-4">
        <div className="bg-ocean-900/95 backdrop-blur-sm rounded-2xl border border-ocean-700 p-8 max-w-lg w-full text-center">
          {/* Trophy */}
          <div className="text-6xl mb-4">
            {playerRanking.finishPosition === 1 ? '🥇' : 
             playerRanking.finishPosition === 2 ? '🥈' : 
             playerRanking.finishPosition === 3 ? '🥉' : '🏁'}
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">Course terminée !</h1>
          <p className="text-ocean-300 mb-6">{race.name}</p>

          {/* Position */}
          <div className="bg-ocean-800/50 rounded-xl p-6 mb-6">
            <div className="text-ocean-400 text-sm mb-1">Votre position</div>
            <div className="text-5xl font-bold text-white mb-2">
              {playerRanking.finishPosition}
              <span className="text-2xl text-ocean-400">/{rankings.length}</span>
            </div>
            {playerRanking.finishPosition <= 3 && (
              <div className="text-yellow-400 font-medium">🎉 Podium !</div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-ocean-800/30 rounded-lg p-3">
              <div className="text-ocean-400 text-xs">Temps de course</div>
              <div className="text-white font-bold">
                {playerRanking.finishTime ? 
                  formatDuration(playerRanking.finishTime - race.startTime) : 
                  '-'}
              </div>
            </div>
            <div className="bg-ocean-800/30 rounded-lg p-3">
              <div className="text-ocean-400 text-xs">Crédits gagnés</div>
              <div className="text-green-400 font-bold">
                +{getCreditsForPosition(playerRanking.finishPosition)} 💰
              </div>
            </div>
          </div>

          {/* Race still ongoing info */}
          {race.status === 'active' && (
            <div className="text-ocean-400 text-sm mb-4 bg-ocean-800/30 rounded-lg p-3">
              <span className="animate-pulse">🟢</span> La course continue pour les autres participants...
              <div className="text-xs mt-1">
                {rankings.filter(r => r.finished).length}/{rankings.length} ont terminé
              </div>
            </div>
          )}

          {/* Next races */}
          {nextRaces.length > 0 && (
            <div className="mb-6">
              <div className="text-ocean-300 text-sm mb-3">🚀 Prochaines courses disponibles</div>
              <div className="space-y-2">
                {nextRaces.slice(0, 3).map(nextRace => (
                  <button
                    key={nextRace.id}
                    onClick={() => handleRegisterNextRace(nextRace.id)}
                    disabled={registering}
                    className="w-full p-3 bg-green-600/20 hover:bg-green-600/40 border border-green-500/50 rounded-lg text-left transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">{nextRace.name}</div>
                        <div className="text-ocean-300 text-xs">
                          {new Date(nextRace.startTime * 1000).toLocaleString('fr-FR')}
                        </div>
                      </div>
                      <div className="text-green-400 text-sm">
                        {registering ? '...' : 'S\'inscrire →'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            <Link
              to="/"
              className="px-6 py-3 bg-ocean-600 hover:bg-ocean-500 text-white rounded-lg transition-colors"
            >
              Retour au dashboard
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-ocean-700 hover:bg-ocean-600 text-white rounded-lg transition-colors"
            >
              Voir la course
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row">
      {/* Wind change alert */}
      <WindAlert wind={wind} />

      {/* Main map area */}
      <div className="flex-1 relative">
        {/* Race header */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          <div className="bg-ocean-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-ocean-700">
            <h1 className="text-lg font-bold text-white">{race.name}</h1>
            <div className="text-sm text-ocean-300">
              {race.status === 'active' ? '🟢 En cours' : race.status === 'finished' ? '🏁 Terminée' : '⏳ À venir'}
            </div>
          </div>

          {/* Wind indicator */}
          <div className="bg-ocean-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-ocean-700">
            <div className="flex items-center gap-3">
              <div className="text-2xl" style={{ transform: `rotate(${wind.direction}deg)` }}>
                ➤
              </div>
              <div>
                <div className="text-white font-medium">{wind.speed} kn</div>
                <div className="text-ocean-300 text-sm">{wind.directionText} ({wind.direction}°)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <RaceMap
          waypoints={race.waypoints}
          boats={boats}
          playerBoat={playerBoat}
          wind={wind}
        />

        {/* Player boat info with Speedometer */}
        {playerBoat && (
          <div className="absolute bottom-4 left-4 bg-ocean-900/90 backdrop-blur-sm rounded-lg px-4 py-3 border border-ocean-700">
            <div className="flex items-center gap-4">
              {/* Speedometer */}
              <div className="flex items-center gap-2 pr-3 border-r border-ocean-600">
                <div className={`text-3xl font-bold ${
                  playerBoat.boostActive ? 'text-yellow-400' : 
                  playerBoat.speed >= 6 ? 'text-green-400' : 
                  playerBoat.speed >= 4 ? 'text-white' : 'text-red-400'
                }`}>
                  {playerBoat.speed || 0}
                </div>
                <div className="flex flex-col">
                  <span className="text-ocean-400 text-xs">kn</span>
                  <span className={`text-xs ${
                    playerBoat.speed >= (playerBoat.maxSpeed * 0.8) ? 'text-green-400' : 
                    playerBoat.speed >= (playerBoat.maxSpeed * 0.5) ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    /{playerBoat.maxSpeed}
                  </span>
                </div>
                {playerBoat.boostActive && (
                  <span className="text-yellow-400 text-lg animate-pulse">⚡</span>
                )}
              </div>
              
              <div>
                <div className="text-ocean-400 text-xs">Position</div>
                <div className="text-white font-bold">
                  {rankings.find(r => r.boatId === playerBoat.boatId)?.livePosition || '-'}
                  <span className="text-ocean-400 text-sm">/{rankings.length}</span>
                </div>
              </div>
              <div>
                <div className="text-ocean-400 text-xs">Cap</div>
                <div className="text-white font-bold">{playerBoat.heading}°</div>
              </div>
              <div>
                <div className="text-ocean-400 text-xs">Voile</div>
                <div className="text-white font-bold capitalize">{playerBoat.sailType}</div>
              </div>
              <div>
                <div className="text-ocean-400 text-xs">Waypoint</div>
                <div className="text-white font-bold">
                  {playerBoat.currentWaypoint}/{race.waypoints.length}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Side panel */}
      <div className="w-full lg:w-80 bg-ocean-900/80 border-t lg:border-t-0 lg:border-l border-ocean-700 flex flex-col overflow-y-auto">
        {/* Sail controls - SIMPLIFIED */}
        {playerBoat && !playerBoat.finished && (
          <div className="p-4 border-b border-ocean-700">
            <h3 className="text-white font-medium mb-3">⛵ Choisir la voile</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleSailChange('spi')}
                className={`p-3 rounded-lg text-center transition-all ${
                  selectedSail === 'spi' 
                    ? 'bg-yellow-500 text-black font-bold' 
                    : 'bg-ocean-700 text-white hover:bg-ocean-600'
                }`}
              >
                <div className="text-2xl">🪂</div>
                <div className="text-xs mt-1">Spi</div>
                <div className="text-[10px] opacity-70">Vent arrière</div>
              </button>
              <button
                onClick={() => handleSailChange('genois')}
                className={`p-3 rounded-lg text-center transition-all ${
                  selectedSail === 'genois' 
                    ? 'bg-green-500 text-black font-bold' 
                    : 'bg-ocean-700 text-white hover:bg-ocean-600'
                }`}
              >
                <div className="text-2xl">⛵</div>
                <div className="text-xs mt-1">Génois</div>
                <div className="text-[10px] opacity-70">Polyvalent</div>
              </button>
              <button
                onClick={() => handleSailChange('grandvoile')}
                className={`p-3 rounded-lg text-center transition-all ${
                  selectedSail === 'grandvoile' 
                    ? 'bg-blue-500 text-white font-bold' 
                    : 'bg-ocean-700 text-white hover:bg-ocean-600'
                }`}
              >
                <div className="text-2xl">🔺</div>
                <div className="text-xs mt-1">GV</div>
                <div className="text-[10px] opacity-70">Près du vent</div>
              </button>
            </div>
            {/* Sail efficiency indicator */}
            {playerBoat.sailEfficiency && (
              <div className={`mt-3 p-2 rounded-lg text-center ${
                playerBoat.sailEfficiency.status === 'optimal' 
                  ? 'bg-green-500/20 border border-green-500/50' 
                  : playerBoat.sailEfficiency.status === 'good'
                  ? 'bg-yellow-500/20 border border-yellow-500/50'
                  : 'bg-red-500/20 border border-red-500/50'
              }`}>
                <div className="flex items-center justify-center gap-2">
                  <span className={`text-lg ${
                    playerBoat.sailEfficiency.status === 'optimal' ? 'text-green-400' :
                    playerBoat.sailEfficiency.status === 'good' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {playerBoat.sailEfficiency.status === 'optimal' ? '✓' :
                     playerBoat.sailEfficiency.status === 'good' ? '~' : '✗'}
                  </span>
                  <span className="text-white font-bold">
                    {playerBoat.sailEfficiency.efficiency}% efficacité
                  </span>
                </div>
                {playerBoat.sailEfficiency.status !== 'optimal' && (
                  <div className="text-xs mt-1 text-ocean-300">
                    Voile optimale : <span className="font-medium text-white">
                      {playerBoat.sailEfficiency.optimalSail === 'spi' ? 'Spi 🪂' :
                       playerBoat.sailEfficiency.optimalSail === 'genois' ? 'Génois ⛵' : 'GV 🔺'}
                    </span>
                  </div>
                )}
                <div className="text-[10px] text-ocean-400 mt-1">
                  Angle au vent : {Math.round(playerBoat.sailEfficiency.angleToWind)}°
                </div>
              </div>
            )}
          </div>
        )}

        {/* Boost System */}
        {playerBoat && !playerBoat.finished && (
          <BoostPanel 
            raceId={raceId}
            boatId={player.boat.id}
            playerId={player.id}
            boostEnergy={playerBoat.boostEnergy || 0}
            boostActive={playerBoat.boostActive}
            boostTimeLeft={playerBoat.boostTimeLeft || 0}
            onBoostUpdate={fetchRaceData}
            onPlayerUpdate={onPlayerUpdate}
          />
        )}

        {/* Heading indicator */}
        {playerBoat && !playerBoat.finished && targetWaypoint && (
          <div className="p-4 border-b border-ocean-700">
            <HeadingIndicator
              currentHeading={playerBoat.heading}
              targetWaypoint={targetWaypoint}
              boatPosition={{ lat: playerBoat.lat, lon: playerBoat.lon }}
              windDirection={wind.direction}
            />
          </div>
        )}

        {/* Rankings */}
        <div className="flex-1 overflow-hidden">
          <RankingPanel rankings={rankings} playerId={player.id} />
        </div>

        {/* Debug: Force finish button */}
        {playerBoat && !playerBoat.finished && (
          <div className="p-4 border-t border-ocean-700">
            <button
              onClick={handleForceFinish}
              className="w-full py-2 px-4 bg-red-900/50 hover:bg-red-800/50 text-red-300 rounded-lg text-sm border border-red-700"
            >
              🛑 Terminer la course (debug)
            </button>
          </div>
        )}
      </div>

      {/* Mobile ranking button - visible only on small screens */}
      <button
        onClick={() => setShowMobileRanking(true)}
        className="lg:hidden fixed bottom-20 left-4 z-40 bg-ocean-600 hover:bg-ocean-500 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2"
      >
        <span>🏆</span>
        <span className="font-medium">Classement</span>
      </button>

      {/* Mobile ranking modal */}
      {showMobileRanking && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70 flex items-end">
          <div className="w-full bg-ocean-900 rounded-t-2xl max-h-[70vh] flex flex-col">
            <div className="p-4 border-b border-ocean-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🏆</span>
                <span>Classement</span>
              </h3>
              <button
                onClick={() => setShowMobileRanking(false)}
                className="text-ocean-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <RankingPanel rankings={rankings} playerId={player.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RaceLive;
