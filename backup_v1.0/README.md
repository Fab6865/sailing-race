# 🚤 Sailing Race - Jeu de Course à la Voile en Temps Réel

Un jeu de course à la voile inspiré de Virtual Regatta Offshore, avec simulation en temps réel 24h/24.

## 🎮 Concept

- **Course continue** : Les bateaux avancent même quand vous êtes déconnecté
- **Simulation réaliste** : Vent évolutif, polaires de voile, VMG
- **Compétition** : Affrontez des bots IA de différents niveaux
- **Progression** : Gagnez des crédits et améliorez votre bateau

## 🛠️ Stack Technique

- **Backend** : Node.js + Express + SQL.js
- **Frontend** : Vite + React + TailwindCSS + Canvas 2D
- **Simulation** : Tick serveur toutes les 60 secondes

## 📦 Installation

### Backend
```bash
cd server
npm install
npm run dev
```

### Frontend
```bash
cd client
npm install
npm run dev
```

## 🎯 Fonctionnalités

- Dashboard avec courses à venir
- Carte live avec tous les bateaux
- Contrôle du cap (0-360°) et choix de voile
- Système de waypoints
- Classement en temps réel
- Garage avec upgrades

## 🌊 Mécanique de Jeu

- **Tick serveur** : 60 secondes
- **Vent** : Change toutes les ~30 minutes
- **Voiles** : Spi (vent arrière), Génois (reaching), Grand-voile (près)
- **VMG** : Vitesse × coefficient selon angle au vent
