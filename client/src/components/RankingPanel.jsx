function RankingPanel({ rankings, playerId }) {
  const getMedalEmoji = (position) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return position;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-ocean-700">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🏆</span>
          <span>Classement</span>
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rankings.length === 0 ? (
          <div className="p-4 text-center text-ocean-400">
            Aucun participant
          </div>
        ) : (
          <div className="divide-y divide-ocean-700/50">
            {rankings.map((boat, index) => {
              const isPlayer = boat.playerId === playerId;
              
              return (
                <div
                  key={boat.participantId}
                  className={`p-3 flex items-center gap-3 ${
                    isPlayer ? 'bg-green-500/10' : 'hover:bg-ocean-800/50'
                  } transition-colors`}
                >
                  {/* Position */}
                  <div className={`w-8 text-center font-bold ${
                    boat.livePosition <= 3 ? 'text-xl' : 'text-ocean-300'
                  }`}>
                    {getMedalEmoji(boat.livePosition)}
                  </div>

                  {/* Boat info */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${
                      isPlayer ? 'text-green-400' : 'text-white'
                    }`}>
                      {boat.name}
                      {isPlayer && <span className="ml-2 text-xs">(Vous)</span>}
                    </div>
                    <div className="text-xs text-ocean-400">
                      {boat.finished ? (
                        <span className="text-green-400">🏁 Arrivé</span>
                      ) : (
                        <>
                          WP {boat.currentWaypoint} • {boat.distanceToNext} nm restants
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bot indicator */}
                  {boat.isBot && (
                    <div className="text-xs text-ocean-500 bg-ocean-800 px-2 py-1 rounded">
                      BOT
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-ocean-700 text-xs text-ocean-400">
        <div className="flex items-center gap-4">
          <span>WP = Waypoint</span>
          <span>nm = Milles nautiques</span>
        </div>
      </div>
    </div>
  );
}

export default RankingPanel;
