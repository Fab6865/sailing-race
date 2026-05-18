import { useState, useEffect } from 'react';

function compassPoint(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

function WindForecast({ wind, forecast, windChange }) {
  const [countdown, setCountdown] = useState(wind?.nextChangeIn ?? null);

  // Live countdown tick
  useEffect(() => {
    if (wind?.nextChangeIn == null) return;
    setCountdown(wind.nextChangeIn);
    const iv = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(iv);
  }, [wind?.nextChangeIn]);

  const hasForecast = forecast?.forecast?.length > 0;
  const hasChange = windChange &&
    (Math.abs(windChange.directionChange) > 5 || Math.abs(windChange.speedChange) > 0.5);

  const urgency = countdown != null && countdown < 300; // < 5 min = urgent

  return (
    <div className="border-b border-ocean-700">
      {/* Countdown bar */}
      {countdown != null && (
        <div className={`px-4 py-2.5 flex items-center justify-between gap-3 ${
          urgency ? 'bg-orange-500/10 border-b border-orange-500/30' : ''
        }`}>
          <div className="flex items-center gap-2">
            <span className={`text-lg ${urgency ? 'animate-pulse' : ''}`}>
              {urgency ? '⚠️' : '🌤️'}
            </span>
            <span className={`text-xs font-medium ${urgency ? 'text-orange-300' : 'text-ocean-400'}`}>
              {urgency ? 'Changement imminent' : 'Prochain changement'}
            </span>
          </div>
          <span className={`font-mono text-sm font-bold ${
            urgency ? 'text-orange-300' : 'text-white'
          }`}>
            {countdown > 0 ? fmt(countdown) : '⚡ En cours…'}
          </span>
        </div>
      )}

      {/* Last wind change */}
      {hasChange && (
        <div className="mx-3 my-2 px-3 py-2 bg-sky-500/10 border border-sky-500/25 rounded-lg text-xs flex items-center gap-2">
          <span className="text-sky-300">🌬️</span>
          <span className="text-ocean-300">Dernier changement : </span>
          <span className="text-white font-medium">
            {windChange.directionChange > 0 ? '+' : ''}
            {Math.round(windChange.directionChange)}°
            {' '}
            {windChange.speedChange >= 0 ? '↑' : '↓'}
            {Math.abs(windChange.speedChange).toFixed(1)} kn
          </span>
        </div>
      )}

      {/* Forecast */}
      {hasForecast && (
        <div className="px-4 pb-3 pt-1 space-y-1">
          <div className="text-ocean-500 text-[10px] uppercase tracking-widest mb-1.5">Tendance</div>
          {forecast.forecast.slice(0, 3).map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-ocean-500 w-8">+{f.hour}h</span>
              <span className="text-ocean-300 w-10">{compassPoint(f.direction)}</span>
              <span className="text-white font-medium">{f.direction}°</span>
              <span className="text-sky-300">{f.speed} kn</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WindForecast;
