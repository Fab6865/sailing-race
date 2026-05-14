import { useState, useEffect, useRef } from 'react';

function WindAlert({ wind, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [change, setChange] = useState(null);
  const previousWind = useRef(null);

  useEffect(() => {
    if (!wind) return;

    // Check for significant wind change
    if (previousWind.current) {
      const dirChange = wind.direction - previousWind.current.direction;
      const speedChange = wind.speed - previousWind.current.speed;

      // Normalize direction change
      let normalizedDirChange = dirChange;
      if (normalizedDirChange > 180) normalizedDirChange -= 360;
      if (normalizedDirChange < -180) normalizedDirChange += 360;

      // Show alert if significant change
      if (Math.abs(normalizedDirChange) > 10 || Math.abs(speedChange) > 3) {
        setChange({
          direction: {
            from: previousWind.current.direction,
            to: wind.direction,
            delta: normalizedDirChange
          },
          speed: {
            from: previousWind.current.speed,
            to: wind.speed,
            delta: speedChange
          }
        });
        setVisible(true);

        // Auto-dismiss after 10 seconds
        const timer = setTimeout(() => {
          setVisible(false);
        }, 10000);

        return () => clearTimeout(timer);
      }
    }

    previousWind.current = { ...wind };
  }, [wind?.direction, wind?.speed]);

  const handleDismiss = () => {
    setVisible(false);
    if (onDismiss) onDismiss();
  };

  const getSailSuggestion = () => {
    if (!wind) return null;

    // Suggestion based on wind speed and general conditions
    if (wind.speed > 25) {
      return { sail: 'grandvoile', icon: '🔺', reason: 'Vent fort - utilisez la grand-voile' };
    }
    if (wind.speed < 8) {
      return { sail: 'spi', icon: '🪂', reason: 'Vent faible - utilisez le spi si possible' };
    }
    return { sail: 'genois', icon: '⛵', reason: 'Vérifiez votre voile selon le nouvel angle' };
  };

  const sailSuggestion = getSailSuggestion();

  if (!visible || !change) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-pulse">
      <div className="bg-ocean-900/95 backdrop-blur-sm border border-yellow-500 rounded-xl p-4 shadow-lg max-w-md">
        <div className="flex items-start gap-3">
          <div className="text-3xl animate-bounce">🌬️</div>
          <div className="flex-1">
            <h3 className="text-yellow-400 font-bold mb-2">Changement de vent !</h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              {/* Direction change */}
              <div>
                <div className="text-ocean-400 text-xs mb-1">Direction</div>
                <div className="flex items-center gap-2">
                  <span className="text-ocean-300">{change.direction.from}°</span>
                  <span className="text-yellow-400">→</span>
                  <span className="text-white font-bold">{change.direction.to}°</span>
                  <span className={`text-xs ${change.direction.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ({change.direction.delta > 0 ? '+' : ''}{Math.round(change.direction.delta)}°)
                  </span>
                </div>
              </div>

              {/* Speed change */}
              <div>
                <div className="text-ocean-400 text-xs mb-1">Force</div>
                <div className="flex items-center gap-2">
                  <span className="text-ocean-300">{change.speed.from.toFixed(1)}</span>
                  <span className="text-yellow-400">→</span>
                  <span className="text-white font-bold">{change.speed.to.toFixed(1)} kn</span>
                  <span className={`text-xs ${change.speed.delta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    ({change.speed.delta > 0 ? '+' : ''}{change.speed.delta.toFixed(1)})
                  </span>
                </div>
              </div>
            </div>

            {sailSuggestion && (
              <div className="bg-yellow-500/10 rounded-lg px-3 py-2 text-sm mb-3">
                <span className="text-yellow-400">💡 Suggestion:</span>
                <span className="text-white ml-1">{sailSuggestion.reason}</span>
              </div>
            )}

            <div className="text-ocean-400 text-xs">
              Ajustez votre cap et vos voiles en conséquence !
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-ocean-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export default WindAlert;
