import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import RaceMap from '../components/RaceMap';
import ControlPanel from '../components/ControlPanel';
import RankingPanel from '../components/RankingPanel';

function RaceLive({ player }) {
  const { raceId } = useParams();
  const [raceData, setRaceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
      const res = await fetch(`/api/race/${raceId}/live?playerId=${player.id}`);
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

  const handleControlUpdate = async (heading, sailType) => {
    try {
      const res = await fetch(`/api/race/${raceId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boatId: player.boat.id,
          heading,
          sailType
        })
      });

      if (res.ok) {
        // Refresh data immediately
        fetchRaceData();
      }
    } catch (err) {
      console.error('Failed to update controls:', err);
    }
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

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row">
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

        {/* Player boat info */}
        {playerBoat && (
          <div className="absolute bottom-4 left-4 bg-ocean-900/90 backdrop-blur-sm rounded-lg px-4 py-3 border border-ocean-700">
            <div className="flex items-center gap-4">
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
      <div className="w-full lg:w-80 bg-ocean-900/80 border-t lg:border-t-0 lg:border-l border-ocean-700 flex flex-col">
        {/* Control panel */}
        {playerBoat && !playerBoat.finished && (
          <ControlPanel
            currentHeading={playerBoat.heading}
            currentSail={playerBoat.sailType}
            windDirection={wind.direction}
            onUpdate={handleControlUpdate}
          />
        )}

        {/* Rankings */}
        <div className="flex-1 overflow-hidden">
          <RankingPanel rankings={rankings} playerId={player.id} />
        </div>
      </div>
    </div>
  );
}

export default RaceLive;
