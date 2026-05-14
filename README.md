# 🚤 Sailing Race - Jeu de Course à la Voile en Temps Réel

Un jeu de course à la voile inspiré de Virtual Regatta Offshore, avec simulation en temps réel 24h/24.

## 🎮 Concept

- **Course continue** : Les bateaux avancent même quand vous êtes déconnecté
- **Simulation réaliste** : Vent évolutif, polaires de voile, VMG
- **Compétition** : Affrontez des bots IA de différents niveaux
- **Progression** : Gagnez des crédits et améliorez votre bateau
- **Boost système** : Énergie par clics ou achats pour +30% vitesse

## 🛠️ Stack Technique

- **Backend** : Node.js + Express + SQL.js
- **Frontend** : Vite + React + TailwindCSS + Canvas 2D
- **Simulation** : Tick serveur toutes les 60 secondes
- **Déploiement** : Render (Backend API + Frontend statique)

## 🌐 Déploiement sur Render

### Prérequis
- Compte Render
- Repository GitHub avec le code

### Étapes
1. **Push sur GitHub** :
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/ton-username/sailing-race.git
git push -u origin main
```

2. **Configuration Render** :
- Importer le repository sur Render
- Le fichier `render.yaml` configure automatiquement les services
- Backend : `/api` sur port 10000
- Frontend : Site statique

## 📦 Installation Local

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
- **Louvoiement automatique** : Évite la zone interdite face au vent
- **Speedomètre** : Vitesse en temps réel avec boost
- **Système de boost** : Énergie par clics ou achats (+30% vitesse)
- **Multiplicateurs de voile** : Selon angle au vent
- **Notifications vent** : Changements de vent en temps réel
- Classement en temps réel
- Garage avec upgrades

## 🌊 Mécanique de Jeu

- **Tick serveur** : 60 secondes
- **Vent** : Change toutes les ~30 minutes avec notifications
- **Voiles** : Spi (vent arrière), Génois (reaching), Grand-voile (près)
- **Louvoiement** : Auto-tacking à 50° du vent si nécessaire
- **Boost** : 2 minutes à +30% vitesse pour 50 crédits
- **Énergie boost** : +5% par clic (max 2 clics/seconde)

## 🤖 IA des Bots

- **Beginner** : Erreurs fréquentes, changement de voile lent
- **Intermediate** : Bonnes décisions, quelques erreurs
- **Advanced** : Décisions optimales, réactives
- **Expert** : Parfaites stratégies, tacking optimal
