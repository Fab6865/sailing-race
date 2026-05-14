import { useState } from 'react';

function ControlPanel({ currentHeading, currentSail, windDirection, onUpdate }) {
  const [heading, setHeading] = useState(currentHeading);
  const [sail, setSail] = useState(currentSail);
  const [showCompass, setShowCompass] = useState(false);

  const sails = [
    { id: 'grandvoile', name: 'Grand-voile', icon: '⛵', desc: 'Près du vent (< 60°)' },
    { id: 'genois', name: 'Génois', icon: '🌊', desc: 'Travers (60-140°)' },
    { id: 'spi', name: 'Spinnaker', icon: '🎈', desc: 'Vent arrière (> 140°)' }
  ];

  const handleHeadingChange = (newHeading) => {
    setHeading(newHeading);
  };

  const handleApply = () => {
    onUpdate(heading, sail);
    setShowCompass(false);
  };

  // Calculate angle to wind
  let angleToWind = Math.abs(heading - windDirection);
  if (angleToWind > 180) angleToWind = 360 - angleToWind;

  // Suggest optimal sail
  const getOptimalSail = () => {
    if (angleToWind < 60) return 'grandvoile';
    if (angleToWind > 140) return 'spi';
    return 'genois';
  };

  const optimalSail = getOptimalSail();

  return (
    <div className="p-4 border-b border-ocean-700">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span>🎮</span>
        <span>Contrôles</span>
      </h3>

      {/* Heading control */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ocean-300 text-sm">Cap actuel</span>
          <span className="text-white font-bold">{heading}°</span>
        </div>

        <button
          onClick={() => setShowCompass(!showCompass)}
          className="w-full py-2 bg-ocean-700 hover:bg-ocean-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>🧭</span>
          <span>Ajuster le cap</span>
        </button>

        {showCompass && (
          <div className="mt-3 bg-ocean-800 rounded-lg p-4">
            {/* Compass rose */}
            <div className="relative w-48 h-48 mx-auto mb-4">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Compass circle */}
                <circle cx="100" cy="100" r="90" fill="none" stroke="#0ea5e9" strokeWidth="2" />
                
                {/* Cardinal directions */}
                {['N', 'E', 'S', 'W'].map((dir, i) => {
                  const angle = i * 90 - 90;
                  const rad = (angle * Math.PI) / 180;
                  const x = 100 + 75 * Math.cos(rad);
                  const y = 100 + 75 * Math.sin(rad);
                  return (
                    <text
                      key={dir}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {dir}
                    </text>
                  );
                })}

                {/* Degree markers */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
                  const rad = ((deg - 90) * Math.PI) / 180;
                  const x1 = 100 + 85 * Math.cos(rad);
                  const y1 = 100 + 85 * Math.sin(rad);
                  const x2 = 100 + 90 * Math.cos(rad);
                  const y2 = 100 + 90 * Math.sin(rad);
                  return (
                    <line
                      key={deg}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#0ea5e9"
                      strokeWidth="2"
                    />
                  );
                })}

                {/* Wind direction arrow */}
                <g transform={`rotate(${windDirection}, 100, 100)`}>
                  <path
                    d="M100,30 L95,50 L100,45 L105,50 Z"
                    fill="#38bdf8"
                  />
                </g>

                {/* Heading arrow */}
                <g transform={`rotate(${heading}, 100, 100)`}>
                  <path
                    d="M100,20 L90,60 L100,50 L110,60 Z"
                    fill="#22c55e"
                  />
                </g>
              </svg>

              {/* Click areas for direction */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-1 w-32 h-32">
                  {[315, 0, 45, 270, null, 90, 225, 180, 135].map((deg, i) => (
                    <button
                      key={i}
                      onClick={() => deg !== null && handleHeadingChange(deg)}
                      className={`${deg !== null ? 'hover:bg-ocean-600/50' : ''} rounded transition-colors`}
                      disabled={deg === null}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Heading slider */}
            <div className="mb-4">
              <input
                type="range"
                min="0"
                max="359"
                value={heading}
                onChange={(e) => handleHeadingChange(parseInt(e.target.value))}
                className="w-full accent-ocean-500"
              />
              <div className="flex justify-between text-xs text-ocean-400 mt-1">
                <span>0°</span>
                <span>90°</span>
                <span>180°</span>
                <span>270°</span>
                <span>360°</span>
              </div>
            </div>

            {/* Quick heading buttons */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                <button
                  key={deg}
                  onClick={() => handleHeadingChange(deg)}
                  className={`py-1 text-sm rounded transition-colors ${
                    heading === deg
                      ? 'bg-ocean-500 text-white'
                      : 'bg-ocean-700 text-ocean-300 hover:bg-ocean-600'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>

            <div className="text-sm text-ocean-300 mb-2">
              Angle au vent: <span className={angleToWind < 45 ? 'text-red-400' : 'text-white'}>{angleToWind}°</span>
              {angleToWind < 45 && <span className="text-red-400 ml-2">(Zone interdite!)</span>}
            </div>
          </div>
        )}
      </div>

      {/* Sail selection */}
      <div className="mb-4">
        <div className="text-ocean-300 text-sm mb-2">Voile</div>
        <div className="space-y-2">
          {sails.map(s => (
            <button
              key={s.id}
              onClick={() => setSail(s.id)}
              className={`w-full p-3 rounded-lg text-left transition-colors flex items-center gap-3 ${
                sail === s.id
                  ? 'bg-ocean-500 text-white'
                  : 'bg-ocean-700 text-ocean-200 hover:bg-ocean-600'
              }`}
            >
              <span className="text-xl">{s.icon}</span>
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs opacity-70">{s.desc}</div>
              </div>
              {optimalSail === s.id && (
                <span className="ml-auto text-xs bg-green-500/30 text-green-300 px-2 py-1 rounded">
                  Optimal
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Apply button */}
      <button
        onClick={handleApply}
        className="w-full py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors"
      >
        ✓ Appliquer les changements
      </button>
    </div>
  );
}

export default ControlPanel;
