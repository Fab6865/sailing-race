import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

function nmDistance(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function makeMarkerIcon(index, total, selected) {
  const isStart = index === 0;
  const isEnd = index === total - 1;
  const color = isStart ? '#22c55e' : isEnd ? '#ef4444' : '#f59e0b';
  const s = selected ? 34 : 26;
  return L.divIcon({
    className: '',
    html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${color};
      color:white;display:flex;align-items:center;justify-content:center;
      font-weight:bold;font-size:${selected ? 13 : 11}px;
      border:${selected ? '3px solid white' : '2px solid rgba(255,255,255,0.8)'};
      box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:pointer;">${index + 1}</div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

function MapClickHandler({ waypointsLen, onAdd }) {
  useMapEvents({
    click: (e) => onAdd(e.latlng.lat, e.latlng.lng, waypointsLen),
  });
  return null;
}

function WaypointMapEditor({ waypoints, setWaypoints, selectedWaypoint, setSelectedWaypoint }) {
  const center = waypoints.length > 0
    ? [waypoints.reduce((s, w) => s + w.lat, 0) / waypoints.length,
       waypoints.reduce((s, w) => s + w.lon, 0) / waypoints.length]
    : [48.0, -4.0];

  const totalNm = waypoints.slice(1).reduce((sum, wp, i) =>
    sum + nmDistance(waypoints[i].lat, waypoints[i].lon, wp.lat, wp.lon), 0);

  const handleAdd = (lat, lng, len) => {
    setWaypoints(wps => {
      const n = [...wps];
      n.splice(len - 1, 0, { lat, lon: lng, name: `Waypoint ${len}` });
      return n;
    });
    setSelectedWaypoint(len - 1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-xs text-ocean-400">
        <span>Clic carte = ajouter &nbsp;|&nbsp; Glisser = déplacer &nbsp;|&nbsp; Clic droit = supprimer</span>
        <span className="text-white font-semibold">📏 {totalNm.toFixed(1)} nm</span>
      </div>
      <div style={{ height: '420px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1e4d6b' }}>
        <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap"
          />
          <MapClickHandler waypointsLen={waypoints.length} onAdd={handleAdd} />
          {waypoints.length > 1 && (
            <Polyline
              positions={waypoints.map(w => [w.lat, w.lon])}
              color="rgba(255,255,255,0.65)"
              weight={2}
              dashArray="7,6"
            />
          )}
          {waypoints.map((wp, index) => (
            <Marker
              key={index}
              position={[wp.lat, wp.lon]}
              icon={makeMarkerIcon(index, waypoints.length, selectedWaypoint === index)}
              draggable
              eventHandlers={{
                click: () => setSelectedWaypoint(index),
                contextmenu: () => {
                  if (waypoints.length > 2) {
                    setWaypoints(wps => wps.filter((_, i) => i !== index));
                    setSelectedWaypoint(null);
                  }
                },
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  setWaypoints(wps => {
                    const u = [...wps];
                    u[index] = { ...u[index], lat, lon: lng };
                    return u;
                  });
                },
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -18]}>
                <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{wp.name}</span>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
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
      <div className="bg-ocean-900 rounded-xl border border-ocean-700 w-full max-w-4xl max-h-[95vh] overflow-y-auto">
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
            <div className="mb-2">
              <label className="text-ocean-300 text-sm">Waypoints ({waypoints.length})</label>
            </div>
            
            {/* Interactive Map */}
            <WaypointMapEditor
              waypoints={waypoints}
              setWaypoints={setWaypoints}
              selectedWaypoint={selectedWaypoint}
              setSelectedWaypoint={setSelectedWaypoint}
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
