import { useState } from 'react';
import { API_URL } from '../config';

function Welcome({ onCreatePlayer, onReconnect }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('create'); // 'create' or 'reconnect'

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Veuillez entrer un nom');
      return;
    }

    setLoading(true);
    setError('');

    if (mode === 'reconnect') {
      // Try to find existing player
      try {
        const res = await fetch(`${API_URL}/api/player/find-by-name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() })
        });
        
        if (res.ok) {
          const player = await res.json();
          onReconnect(player);
        } else {
          setError('Joueur non trouvé. Vérifiez le nom ou créez un nouveau compte.');
        }
      } catch (err) {
        setError('Erreur de connexion');
      }
    } else {
      const success = await onCreatePlayer(name.trim());
      if (!success) {
        setError('Erreur lors de la création du joueur');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="text-8xl mb-4 animate-boat-bob">⛵</div>
          <h1 className="text-4xl font-bold text-white mb-2">Sailing Race</h1>
          <p className="text-ocean-300">Course à la Voile en Temps Réel</p>
        </div>

        {/* Features */}
        <div className="bg-ocean-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-ocean-700">
          <h2 className="text-xl font-semibold text-white mb-4">🌊 Bienvenue Marin !</h2>
          <ul className="space-y-3 text-ocean-200">
            <li className="flex items-start gap-2">
              <span className="text-ocean-400">⏱️</span>
              <span>Courses en temps réel 24h/24</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-ocean-400">🌬️</span>
              <span>Vent évolutif et simulation réaliste</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-ocean-400">🤖</span>
              <span>Affrontez des skippers IA de tous niveaux</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-ocean-400">🔧</span>
              <span>Améliorez votre bateau avec des upgrades</span>
            </li>
          </ul>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setMode('create'); setError(''); }}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              mode === 'create' 
                ? 'bg-ocean-500 text-white' 
                : 'bg-ocean-800 text-ocean-300 hover:bg-ocean-700'
            }`}
          >
            🆕 Nouveau
          </button>
          <button
            type="button"
            onClick={() => { setMode('reconnect'); setError(''); }}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              mode === 'reconnect' 
                ? 'bg-ocean-500 text-white' 
                : 'bg-ocean-800 text-ocean-300 hover:bg-ocean-700'
            }`}
          >
            🔄 Reconnexion
          </button>
        </div>

        {/* Registration form */}
        <form onSubmit={handleSubmit} className="bg-ocean-900/50 backdrop-blur-sm rounded-xl p-6 border border-ocean-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            {mode === 'create' ? 'Créer votre profil' : 'Retrouver votre compte'}
          </h2>
          
          <div className="mb-4">
            <label htmlFor="name" className="block text-ocean-200 mb-2">
              {mode === 'create' ? 'Nom de skipper' : 'Votre nom de skipper'}
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === 'create' ? 'Capitaine...' : 'Entrez votre nom exact...'}
              className="w-full px-4 py-3 bg-ocean-800 border border-ocean-600 rounded-lg text-white placeholder-ocean-400 focus:outline-none focus:border-ocean-400 transition-colors"
              maxLength={20}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="mb-4 text-red-400 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-ocean-500 hover:bg-ocean-400 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading 
              ? (mode === 'create' ? 'Création...' : 'Recherche...') 
              : (mode === 'create' ? '🚀 Commencer l\'aventure' : '🔄 Me reconnecter')}
          </button>
        </form>

        <p className="text-center text-ocean-500 text-sm mt-6">
          {mode === 'create' 
            ? 'Votre bateau vous attend au port !' 
            : 'Entrez le même nom que lors de votre inscription'}
        </p>
      </div>
    </div>
  );
}

export default Welcome;
