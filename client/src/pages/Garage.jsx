import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function Garage({ player, onUpdate }) {
  const [upgrades, setUpgrades] = useState([]);
  const [playerUpgrades, setPlayerUpgrades] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);

  useEffect(() => {
    fetchData();
  }, [player.id]);

  const fetchData = async () => {
    try {
      const [upgradesRes, playerUpgradesRes, categoriesRes] = await Promise.all([
        fetch(`${API_URL}/api/upgrade/list`),
        fetch(`${API_URL}/api/upgrade/player/${player.id}`),
        fetch(`${API_URL}/api/upgrade/categories`)
      ]);

      if (upgradesRes.ok) {
        setUpgrades(await upgradesRes.json());
      }
      if (playerUpgradesRes.ok) {
        setPlayerUpgrades(await playerUpgradesRes.json());
      }
      if (categoriesRes.ok) {
        setCategories(await categoriesRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch upgrades:', err);
    }
    setLoading(false);
  };

  const handlePurchase = async (upgradeId) => {
    setPurchasing(upgradeId);
    try {
      const res = await fetch(`${API_URL}/api/upgrade/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.id, upgradeId })
      });

      if (res.ok) {
        await fetchData();
        onUpdate(); // Refresh player data
      } else {
        const error = await res.json();
        alert(error.error || 'Erreur lors de l\'achat');
      }
    } catch (err) {
      console.error('Failed to purchase:', err);
    }
    setPurchasing(null);
  };

  const isOwned = (upgradeId) => {
    return playerUpgrades.some(pu => pu.id === upgradeId);
  };

  const getCategoryIcon = (category) => {
    const icons = {
      sail: '⛵',
      hull: '🚤',
      weather: '🌤️'
    };
    return icons[category] || '📦';
  };

  const getEffectLabel = (effectType, effectValue) => {
    const labels = {
      speed_max: `+${effectValue} nœuds vitesse max`,
      vmg_upwind: `+${(effectValue * 100).toFixed(0)}% VMG au près`,
      vmg_downwind: `+${(effectValue * 100).toFixed(0)}% VMG portant`,
      vmg_reaching: `+${(effectValue * 100).toFixed(0)}% VMG travers`,
      storm_resistance: `+${(effectValue * 100).toFixed(0)}% résistance tempête`,
      weather_forecast: `${effectValue}h de prévisions météo`
    };
    return labels[effectType] || `+${effectValue}`;
  };

  const filteredUpgrades = selectedCategory === 'all'
    ? upgrades
    : upgrades.filter(u => u.category === selectedCategory);

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
          <span>🔧</span>
          <span>Garage</span>
        </h1>
        <p className="text-ocean-300">Améliorez votre bateau pour dominer les courses</p>
      </div>

      {/* Current boat stats */}
      <div className="bg-ocean-900/50 rounded-xl border border-ocean-700 p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>⛵</span>
          <span>{player.boat?.name || 'Mon bateau'}</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Vitesse max" value={`${player.boat?.stats.speedMax || 8} kn`} />
          <StatCard label="VMG Près" value={`${((player.boat?.stats.vmgUpwind || 0.7) * 100).toFixed(0)}%`} />
          <StatCard label="VMG Portant" value={`${((player.boat?.stats.vmgDownwind || 0.85) * 100).toFixed(0)}%`} />
          <StatCard label="VMG Travers" value={`${((player.boat?.stats.vmgReaching || 1) * 100).toFixed(0)}%`} />
          <StatCard label="Résist. tempête" value={`${((player.boat?.stats.stormResistance || 0.5) * 100).toFixed(0)}%`} />
        </div>
      </div>

      {/* Credits */}
      <div className="bg-gradient-to-r from-yellow-600/20 to-ocean-600/20 rounded-xl p-4 mb-8 border border-yellow-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💰</span>
            <div>
              <div className="text-ocean-300 text-sm">Crédits disponibles</div>
              <div className="text-2xl font-bold text-white">{player.credits.toLocaleString()}</div>
            </div>
          </div>
          <div className="text-ocean-400 text-sm">
            Gagnez des crédits en terminant des courses !
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedCategory === 'all'
              ? 'bg-ocean-500 text-white'
              : 'bg-ocean-800 text-ocean-300 hover:bg-ocean-700'
          }`}
        >
          Tous
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              selectedCategory === cat.id
                ? 'bg-ocean-500 text-white'
                : 'bg-ocean-800 text-ocean-300 hover:bg-ocean-700'
            }`}
          >
            <span>{getCategoryIcon(cat.id)}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Upgrades grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUpgrades.map(upgrade => {
          const owned = isOwned(upgrade.id);
          const canAfford = player.credits >= upgrade.price;

          return (
            <div
              key={upgrade.id}
              className={`bg-ocean-900/50 rounded-xl border p-5 transition-all ${
                owned
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-ocean-700 hover:border-ocean-500'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getCategoryIcon(upgrade.category)}</span>
                  <h3 className="text-lg font-semibold text-white">{upgrade.name}</h3>
                </div>
                {owned && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                    ✓ Possédé
                  </span>
                )}
              </div>

              <p className="text-ocean-300 text-sm mb-3">{upgrade.description}</p>

              <div className="bg-ocean-800/50 rounded-lg px-3 py-2 mb-4">
                <div className="text-xs text-ocean-400 mb-1">Effet</div>
                <div className="text-white font-medium">
                  {getEffectLabel(upgrade.effectType, upgrade.effectValue)}
                </div>
              </div>

              {!owned && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400">💰</span>
                    <span className={`font-bold ${canAfford ? 'text-white' : 'text-red-400'}`}>
                      {upgrade.price.toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handlePurchase(upgrade.id)}
                    disabled={!canAfford || purchasing === upgrade.id}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      canAfford
                        ? 'bg-ocean-500 hover:bg-ocean-400 text-white'
                        : 'bg-ocean-700 text-ocean-500 cursor-not-allowed'
                    }`}
                  >
                    {purchasing === upgrade.id ? '...' : 'Acheter'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredUpgrades.length === 0 && (
        <div className="text-center text-ocean-400 py-12">
          Aucune amélioration dans cette catégorie
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-ocean-800/50 rounded-lg p-3">
      <div className="text-ocean-400 text-xs mb-1">{label}</div>
      <div className="text-white font-bold">{value}</div>
    </div>
  );
}

export default Garage;
