import { useState } from 'react';

function Welcome({ onCreatePlayer }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Veuillez entrer un nom');
      return;
    }

    setLoading(true);
    setError('');

    const success = await onCreatePlayer(name.trim());
    if (!success) {
      setError('Erreur lors de la création du joueur');
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

        {/* Registration form */}
        <form onSubmit={handleSubmit} className="bg-ocean-900/50 backdrop-blur-sm rounded-xl p-6 border border-ocean-700">
          <h2 className="text-xl font-semibold text-white mb-4">Créer votre profil</h2>
          
          <div className="mb-4">
            <label htmlFor="name" className="block text-ocean-200 mb-2">
              Nom de skipper
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Capitaine..."
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
            {loading ? 'Création...' : '🚀 Commencer l\'aventure'}
          </button>
        </form>

        <p className="text-center text-ocean-500 text-sm mt-6">
          Votre bateau vous attend au port !
        </p>
      </div>
    </div>
  );
}

export default Welcome;
