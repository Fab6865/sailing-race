import { Link, useLocation } from 'react-router-dom';

function Layout({ player, onLogout, children }) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/garage', label: 'Garage', icon: '⚙️' },
    { path: '/rankings', label: 'Classements', icon: '🏆' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-ocean-900/80 backdrop-blur-sm border-b border-ocean-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-3xl">⛵</span>
            <span className="text-xl font-bold text-white">Sailing Race</span>
          </Link>

          <nav className="flex items-center gap-6">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-ocean-600 text-white'
                    : 'text-ocean-200 hover:bg-ocean-800 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-white font-medium">{player.name}</div>
              <div className="text-ocean-300 text-sm flex items-center gap-1">
                <span>💰</span>
                <span>{player.credits.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="text-ocean-400 hover:text-white transition-colors"
              title="Déconnexion"
            >
              🚪
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 ocean-bg">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-ocean-950 border-t border-ocean-800 py-3">
        <div className="max-w-7xl mx-auto px-4 text-center text-ocean-400 text-sm">
          Sailing Race - Course à la Voile en Temps Réel
        </div>
      </footer>
    </div>
  );
}

export default Layout;
