import { useState, useEffect, useRef } from 'react';

function WindAlert({ wind }) {
  const [visible, setVisible] = useState(false);
  const [change, setChange] = useState(null);
  const [shake, setShake] = useState(false);
  const previousWind = useRef(null);
  const dismissTimer = useRef(null);

  useEffect(() => {
    if (!wind) return;

    if (previousWind.current) {
      let dirDelta = wind.direction - previousWind.current.direction;
      if (dirDelta > 180) dirDelta -= 360;
      if (dirDelta < -180) dirDelta += 360;

      const speedDelta = wind.speed - previousWind.current.speed;

      if (Math.abs(dirDelta) > 10 || Math.abs(speedDelta) > 3) {
        setChange({
          direction: { from: previousWind.current.direction, to: wind.direction, delta: dirDelta },
          speed: { from: previousWind.current.speed, to: wind.speed, delta: speedDelta }
        });
        setVisible(true);
        setShake(true);
        setTimeout(() => setShake(false), 600);

        clearTimeout(dismissTimer.current);
        dismissTimer.current = setTimeout(() => setVisible(false), 15000);
      }
    }

    previousWind.current = { ...wind };
  }, [wind?.direction, wind?.speed]);

  useEffect(() => () => clearTimeout(dismissTimer.current), []);

  if (!visible || !change) return null;

  const isStrong = wind?.speed > 25;
  const isBigShift = Math.abs(change.direction.delta) > 25;

  const getSailSuggestion = () => {
    if (!wind) return null;
    if (wind.speed > 25) return { icon: '🔺', text: 'Vent fort — passez en grand-voile !' };
    if (wind.speed < 8) return { icon: '🪂', text: 'Vent faible — essayez le spi' };
    return { icon: '⛵', text: 'Vérifiez votre voile selon le nouvel angle' };
  };

  const suggestion = getSailSuggestion();

  return (
    <div
      className={`fixed top-20 left-1/2 z-50 -translate-x-1/2 w-[min(420px,90vw)]
        ${shake ? 'animate-[wiggle_0.1s_ease-in-out_6]' : ''}
      `}
      style={shake ? { animation: 'wiggle 0.08s ease-in-out 6' } : {}}
    >
      {/* Keyframe injected inline */}
      <style>{`
        @keyframes wiggle {
          0%,100% { transform: translateX(-50%) rotate(0deg); }
          25% { transform: translateX(calc(-50% - 6px)) rotate(-1.5deg); }
          75% { transform: translateX(calc(-50% + 6px)) rotate(1.5deg); }
        }
      `}</style>

      <div className={`rounded-2xl border shadow-2xl overflow-hidden
        ${isStrong
          ? 'bg-red-950/95 border-red-500 shadow-red-500/30'
          : 'bg-ocean-950/95 border-yellow-500 shadow-yellow-500/20'
        } backdrop-blur-md`}
      >
        {/* Header band */}
        <div className={`px-4 py-3 flex items-center gap-3 ${
          isStrong ? 'bg-red-500/20' : 'bg-yellow-500/15'
        }`}>
          <span className="text-3xl">
            {isStrong ? '⛈️' : isBigShift ? '🌬️' : '💨'}
          </span>
          <div className="flex-1">
            <div className={`font-bold text-base ${isStrong ? 'text-red-300' : 'text-yellow-300'}`}>
              {isStrong ? 'TEMPÊTE !' : 'Changement de vent !'}
            </div>
            <div className="text-ocean-400 text-xs">Ajustez votre cap et vos voiles</div>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="text-ocean-500 hover:text-white text-xl leading-none p-1"
          >✕</button>
        </div>

        {/* Wind values */}
        <div className="px-4 py-3 grid grid-cols-2 gap-4">
          <div className="bg-ocean-800/50 rounded-xl p-3 text-center">
            <div className="text-ocean-400 text-xs mb-1">Direction</div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-ocean-300">{change.direction.from}°</span>
              <span className="text-yellow-400 font-bold">→</span>
              <span className="text-white font-bold text-base">{change.direction.to}°</span>
            </div>
            <div className={`text-xs mt-1 font-medium ${
              change.direction.delta > 0 ? 'text-blue-400' : 'text-orange-400'
            }`}>
              {change.direction.delta > 0 ? '▶ ' : '◀ '}
              {Math.abs(Math.round(change.direction.delta))}° {change.direction.delta > 0 ? 'tribord' : 'bâbord'}
            </div>
          </div>

          <div className="bg-ocean-800/50 rounded-xl p-3 text-center">
            <div className="text-ocean-400 text-xs mb-1">Force</div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-ocean-300">{change.speed.from.toFixed(1)}</span>
              <span className="text-yellow-400 font-bold">→</span>
              <span className={`font-bold text-base ${isStrong ? 'text-red-300' : 'text-white'}`}>
                {change.speed.to.toFixed(1)} kn
              </span>
            </div>
            <div className={`text-xs mt-1 font-medium ${
              change.speed.delta > 0 ? 'text-red-400' : 'text-green-400'
            }`}>
              {change.speed.delta > 0 ? '↑ +' : '↓ '}
              {Math.abs(change.speed.delta).toFixed(1)} kn
            </div>
          </div>
        </div>

        {/* Suggestion */}
        {suggestion && (
          <div className={`mx-4 mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
            isStrong ? 'bg-red-500/15 text-red-300' : 'bg-yellow-500/10 text-yellow-300'
          }`}>
            <span>{suggestion.icon}</span>
            <span>{suggestion.text}</span>
          </div>
        )}

        {/* Beaufort */}
        {wind?.beaufort && (
          <div className="px-4 pb-3 text-xs text-ocean-400 text-center">
            Beaufort {wind.beaufort.force} — {wind.beaufort.description}
          </div>
        )}
      </div>
    </div>
  );
}

export default WindAlert;
