import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';

function Admin() {
  const [races, setRaces] = useState([]);
  const [simulation, setSimulation] = useState({ speedMultiplier: 1 });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRace, setEditingRace] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [racesRes, simRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/races`),
        fetch(`${API_URL}/api/admin/simulation`)
      ]);

      if (racesRes.ok) setRaces(await racesRes.json());
      if (simRes.ok) setSimulation(await simRes.json());
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    }
    setLoading(false);
  };

  const handleSpeedChange = async (multiplier) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/simulation/speed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier })
      });

      if (res.ok) {
        setSimulation({ ...simulation, speedMultiplier: multiplier });
      }
    } catch (err) {
      console.error('Failed to change speed:', err);
    }
  };

  const handleTriggerTick = async () => {
    try {
      await fetch(`${API_URL}/api/admin/simulation/tick`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Failed to trigger tick:', err);
    }
  };

  const handleForceStart = async (raceId) => {
    try {
      await fetch(`${API_URL}/api/admin/race/${raceId}/force-start`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Failed to force start:', err);
    }
  };

  const handleResetRace = async (raceId) => {
    if (!confirm('Réinitialiser cette course ?')) return;
    try {
      await fetch(`${API_URL}/api/admin/race/${raceId}/reset`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Failed to reset race:', err);
    }
  };

  const handleDeleteRace = async (raceId) => {
    if (!confirm('Supprimer cette course ?')) return;
    try {
      await fetch(`${API_URL}/api/admin/race/${raceId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error('Failed to delete race:', err);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('fr-FR');
  };

  const getStatusColor = (status) => {
    const colors = {
      upcoming: 'bg-yellow-500/20 text-yellow-400',
      active: 'bg-green-500/20 text-green-400',
      finished: 'bg-gray-500/20 text-gray-400'
    };
    return colors[status] || colors.upcoming;
  };

  const getDifficultyLabel = (difficulty) => {
    const labels = {
      amateur: '🟢 Amateur',
      intermediate: '🟡 Intermédiaire',
      pro: '🔴 Pro',
      mixed: '🎲 Mélangé'
    };
    return labels[difficulty] || labels.mixed;
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <span>🔧</span>
            <span>Panel Admin</span>
          </h1>
          <p className="text-ocean-300">Gérer les courses et la simulation</p>
        </div>
        <Link to="/" className="text-ocean-300 hover:text-white">
          ← Retour au jeu
        </Link>
      </div>

      {/* Simulation controls */}
      <div className="bg-ocean-900/50 rounded-xl border border-ocean-700 p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>⏱️</span>
          <span>Contrôle de la simulation</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Speed control */}
          <div>
            <div className="text-ocean-300 text-sm mb-2">Vitesse de simulation</div>
            <div className="flex flex-wrap gap-2">
              {[1, 10, 60, 600].map(speed => (
                <button
                  key={speed}
                  onClick={() => handleSpeedChange(speed)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    simulation.speedMultiplier === speed
                      ? 'bg-ocean-500 text-white'
                      : 'bg-ocean-700 text-ocean-300 hover:bg-ocean-600'
                  }`}
                >
                  x{speed}
                </button>
              ))}
            </div>
            <div className="text-ocean-400 text-xs mt-2">
              {simulation.speedMultiplier === 1 
                ? 'Temps réel (1 tick = 60s)'
                : `Accéléré: 1 tick = ${(60 / simulation.speedMultiplier).toFixed(1)}s`}
            </div>
          </div>

          {/* Manual tick */}
          <div>
            <div className="text-ocean-300 text-sm mb-2">Actions manuelles</div>
            <button
              onClick={handleTriggerTick}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
            >
              ⚡ Déclencher un tick
            </button>
            <div className="text-ocean-400 text-xs mt-2">
              Force l'avancement immédiat de tous les bateaux
            </div>
          </div>
        </div>
      </div>

      {/* Create race button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🏁</span>
          <span>Courses ({races.length})</span>
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <span>➕</span>
          <span>Nouvelle course</span>
        </button>
      </div>

      {/* Races list */}
      <div className="bg-ocean-900/50 rounded-xl border border-ocean-700 overflow-hidden">
        {races.length === 0 ? (
          <div className="p-8 text-center text-ocean-400">
            Aucune course. Créez-en une !
          </div>
        ) : (
          <div className="divide-y divide-ocean-700">
            {races.map(race => (
              <div key={race.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{race.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(race.status)}`}>
                        {race.status}
                      </span>
                      <span className="text-sm text-ocean-400">
                        {getDifficultyLabel(race.difficulty)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-ocean-300">
                      <span>📅 {formatDate(race.startTime)}</span>
                      <span>🚩 {race.waypointCount} waypoints</span>
                      <span>👥 {race.participantCount} participants</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {race.status === 'upcoming' && (
                      <>
                        <button
                          onClick={() => handleForceStart(race.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors"
                        >
                          ▶️ Démarrer
                        </button>
                        <button
                          onClick={() => setEditingRace(race)}
                          className="px-3 py-1 bg-ocean-600 hover:bg-ocean-500 text-white text-sm rounded transition-colors"
                        >
                          ✏️ Éditer
                        </button>
                      </>
                    )}
                    {race.status === 'active' && (
                      <Link
                        to={`/race/${race.id}`}
                        className="px-3 py-1 bg-ocean-600 hover:bg-ocean-500 text-white text-sm rounded transition-colors"
                      >
                        👁️ Voir
                      </Link>
                    )}
                    {race.status !== 'active' && (
                      <>
                        <button
                          onClick={() => handleResetRace(race.id)}
                          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded transition-colors"
                        >
                          🔄 Reset
                        </button>
                        <button
                          onClick={() => handleDeleteRace(race.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingRace) && (
        <RaceModal
          race={editingRace}
          onClose={() => {
            setShowCreateModal(false);
            setEditingRace(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingRace(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function WaypointMapEditor({ waypoints, setWaypoints, selectedWaypoint, setSelectedWaypoint, mapZoom }) {
  const canvasRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  // Canvas internal size tracks its actual displayed size → no scaling needed
  const [size, setSize] = React.useState({ w: 560, h: 260 });
  const [dragging, setDragging] = React.useState(null);
  const [mapOffset, setMapOffset] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });

  // Keep size in sync with container via ResizeObserver
  React.useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;

  const getBounds = () => {
    if (waypoints.length === 0) return { minLat: 47, maxLat: 49, minLon: -5, maxLon: -2 };
    let minLat = Math.min(...waypoints.map(p => p.lat));
    let maxLat = Math.max(...waypoints.map(p => p.lat));
    let minLon = Math.min(...waypoints.map(p => p.lon));
    let maxLon = Math.max(...waypoints.map(p => p.lon));
    const latPad = Math.max((maxLat - minLat) * 0.3, 0.5) / mapZoom;
    const lonPad = Math.max((maxLon - minLon) * 0.3, 0.5) / mapZoom;
    return { minLat: minLat - latPad, maxLat: maxLat + latPad, minLon: minLon - lonPad, maxLon: maxLon + lonPad };
  };

  // All coordinate math uses actual canvas pixel dimensions (= display dimensions)
  const toCanvas = (lat, lon, bounds) => ({
    x: ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * w + mapOffset.x,
    y: h - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * h + mapOffset.y,
  });

  const toLatLon = (x, y, bounds) => ({
    lon: ((x - mapOffset.x) / w) * (bounds.maxLon - bounds.minLon) + bounds.minLon,
    lat: ((h - (y - mapOffset.y)) / h) * (bounds.maxLat - bounds.minLat) + bounds.minLat,
  });

  // Exact mouse position relative to canvas (no scaling)
  const getXY = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const findWaypointAt = (x, y, bounds) => {
    for (let i = waypoints.length - 1; i >= 0; i--) {
      const pos = toCanvas(waypoints[i].lat, waypoints[i].lon, bounds);
      if (Math.hypot(pos.x - x, pos.y - y) < 16) return i;
    }
    return -1;
  };

  // Redraw whenever state changes
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || w === 0) return;
    const ctx = canvas.getContext('2d');
    const bounds = getBounds();

    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(14,165,233,0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    if (waypoints.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      waypoints.forEach((wp, i) => {
        const p = toCanvas(wp.lat, wp.lon, bounds);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    waypoints.forEach((wp, i) => {
      const p = toCanvas(wp.lat, wp.lon, bounds);
      const sel = selectedWaypoint === i;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sel ? 14 : 10, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#22c55e' : i === waypoints.length - 1 ? '#ef4444' : '#f59e0b';
      ctx.fill();
      if (sel) { ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.fillStyle = 'white';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, p.x, p.y);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '10px sans-serif';
      ctx.fillText(wp.name, p.x, p.y + 18);
    });

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Clic = ajouter  |  Glisser = déplacer  |  Clic droit = supprimer', 10, h - 10);
  }, [waypoints, selectedWaypoint, mapZoom, mapOffset, w, h]);

  const handleMouseDown = e => {
    const { x, y } = getXY(e);
    if (e.button === 1 || e.shiftKey) {
      setIsPanning(true);
      setPanStart({ x: x - mapOffset.x, y: y - mapOffset.y });
      return;
    }
    const idx = findWaypointAt(x, y, getBounds());
    if (idx >= 0) { setSelectedWaypoint(idx); setDragging(idx); }
  };

  const handleMouseMove = e => {
    const { x, y } = getXY(e);
    if (isPanning) { setMapOffset({ x: x - panStart.x, y: y - panStart.y }); return; }
    if (dragging !== null) {
      const { lat, lon } = toLatLon(x, y, getBounds());
      setWaypoints(wps => { const u = [...wps]; u[dragging] = { ...u[dragging], lat, lon }; return u; });
    }
  };

  const handleMouseUp = e => {
    if (isPanning) { setIsPanning(false); return; }
    if (dragging !== null) { setDragging(null); return; }
    if (e.button === 0) {
      const { x, y } = getXY(e);
      const bounds = getBounds();
      if (findWaypointAt(x, y, bounds) < 0) {
        const { lat, lon } = toLatLon(x, y, bounds);
        setWaypoints(wps => {
          const n = [...wps];
          n.splice(wps.length - 1, 0, { lat, lon, name: `Waypoint ${wps.length}` });
          return n;
        });
        setSelectedWaypoint(waypoints.length - 1);
      }
    }
  };

  const handleContextMenu = e => {
    e.preventDefault();
    const { x, y } = getXY(e);
    const idx = findWaypointAt(x, y, getBounds());
    if (idx >= 0 && waypoints.length > 2) {
      setWaypoints(wps => wps.filter((_, i) => i !== idx));
      setSelectedWaypoint(null);
    }
  };

  return (
    <div ref={wrapRef} className="w-full rounded-lg border border-ocean-600 overflow-hidden" style={{ height: '260px' }}>
      <canvas
        ref={canvasRef}
        width={w}
        height={h}
        className="cursor-crosshair"
        style={{ display: 'block', width: '100%', height: '100%' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDragging(null); setIsPanning(false); }}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
}

function RaceModal({ race, onClose, onSave }) {
  const [name, setName] = useState(race?.name || '');
  const [difficulty, setDifficulty] = useState(race?.difficulty || 'mixed');
  const [startTime, setStartTime] = useState(() => {
    if (race?.startTime) {
      return new Date(race.startTime * 1000).toISOString().slice(0, 16);
    }
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  });
  const [waypoints, setWaypoints] = useState(race?.waypoints || [
    { lat: 48.0, lon: -4.0, name: 'Départ' },
    { lat: 48.2, lon: -3.8, name: 'Arrivée' }
  ]);
  const [saving, setSaving] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 48.1, lon: -4.0 });
  const [mapZoom, setMapZoom] = useState(1);

  const handleAddWaypoint = () => {
    const lastWp = waypoints[waypoints.length - 1];
    setWaypoints([...waypoints, {
      lat: lastWp.lat + 0.1,
      lon: lastWp.lon + 0.1,
      name: `Waypoint ${waypoints.length + 1}`
    }]);
  };

  const handleRemoveWaypoint = (index) => {
    if (waypoints.length <= 2) return;
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  const handleWaypointChange = (index, field, value) => {
    const updated = [...waypoints];
    updated[index] = { ...updated[index], [field]: field === 'name' ? value : parseFloat(value) };
    setWaypoints(updated);
  };

  const handleSave = async () => {
    if (!name.trim() || waypoints.length < 2) {
      alert('Nom et au moins 2 waypoints requis');
      return;
    }

    setSaving(true);
    try {
      const url = race 
        ? `${API_URL}/api/admin/race/${race.id}`
        : `${API_URL}/api/admin/race/create`;
      
      const method = race ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          difficulty,
          startTime: Math.floor(new Date(startTime).getTime() / 1000),
          waypoints
        })
      });

      if (res.ok) {
        onSave();
      } else {
        const error = await res.json();
        alert(error.error || 'Erreur');
      }
    } catch (err) {
      console.error('Failed to save race:', err);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-ocean-900 rounded-xl border border-ocean-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-ocean-700">
          <h2 className="text-xl font-bold text-white">
            {race ? 'Modifier la course' : 'Nouvelle course'}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-ocean-300 text-sm mb-1">Nom de la course</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-ocean-800 border border-ocean-600 rounded-lg text-white"
              placeholder="Course Bretagne..."
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-ocean-300 text-sm mb-1">Difficulté des bots</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'amateur', label: '🟢 Amateur' },
                { id: 'intermediate', label: '🟡 Inter.' },
                { id: 'pro', label: '🔴 Pro' },
                { id: 'mixed', label: '🎲 Mélangé' }
              ].map(d => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={`py-2 rounded-lg text-sm transition-colors ${
                    difficulty === d.id
                      ? 'bg-ocean-500 text-white'
                      : 'bg-ocean-700 text-ocean-300 hover:bg-ocean-600'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start time */}
          <div>
            <label className="block text-ocean-300 text-sm mb-1">Date de départ</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 bg-ocean-800 border border-ocean-600 rounded-lg text-white"
            />
          </div>

          {/* Waypoints with Map Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-ocean-300 text-sm">Waypoints ({waypoints.length})</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setMapZoom(z => Math.min(z + 0.5, 4))}
                  className="text-sm px-2 py-1 bg-ocean-700 hover:bg-ocean-600 text-white rounded"
                >
                  🔍+
                </button>
                <button
                  onClick={() => setMapZoom(z => Math.max(z - 0.5, 0.5))}
                  className="text-sm px-2 py-1 bg-ocean-700 hover:bg-ocean-600 text-white rounded"
                >
                  🔍-
                </button>
              </div>
            </div>
            
            {/* Interactive Map */}
            <WaypointMapEditor
              waypoints={waypoints}
              setWaypoints={setWaypoints}
              selectedWaypoint={selectedWaypoint}
              setSelectedWaypoint={setSelectedWaypoint}
              mapZoom={mapZoom}
            />

            {/* Waypoint List */}
            <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
              {waypoints.map((wp, index) => (
                <div 
                  key={index} 
                  className={`flex items-center gap-2 rounded-lg p-2 cursor-pointer transition-colors ${
                    selectedWaypoint === index 
                      ? 'bg-ocean-600 border border-ocean-400' 
                      : 'bg-ocean-800 hover:bg-ocean-700'
                  }`}
                  onClick={() => setSelectedWaypoint(index)}
                >
                  <span className={`text-sm w-6 h-6 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-green-500' : index === waypoints.length - 1 ? 'bg-red-500' : 'bg-yellow-500'
                  } text-white font-bold`}>
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={wp.name}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleWaypointChange(index, 'name', e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 px-2 py-1 bg-ocean-700 border border-ocean-600 rounded text-white text-sm"
                    placeholder="Nom"
                  />
                  <span className="text-ocean-400 text-xs">
                    {wp.lat.toFixed(2)}, {wp.lon.toFixed(2)}
                  </span>
                  {waypoints.length > 2 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveWaypoint(index);
                      }}
                      className="text-red-400 hover:text-red-300 px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-2 text-ocean-400 text-xs text-center">
              💡 Clic sur la carte = ajouter un waypoint | Glisser un waypoint = le déplacer
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-ocean-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-ocean-700 hover:bg-ocean-600 text-white rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Admin;
