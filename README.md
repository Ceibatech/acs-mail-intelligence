# ACS Mail Intelligence

ACS Mail Intelligence est une application Next.js pour piloter, rechercher et analyser les archives email d'assurance à partir d'une base MySQL. Elle couvre le pilotage exécutif, le monitoring ETL, la recherche mail et l'analyse métier.

## Fonctionnalités principales

- Tableau de bord exécutif avec KPI métier et synthèse quotidienne
- Recherche email côté serveur avec filtres avancés et pagination
- Fiche message avec headers, contenu texte, tags, relances et partage de métadonnées
- Gestion des relances avec statuts, priorités, échéances et audit
- Analyse assurance (sinistres, devis, réclamations, attestations, branches)
- Monitoring ETL avec historique, erreurs et imports récents
- Paramètres d'administration et diagnostic de connexion MySQL
- Authentification par cookie et gestion des comptes par rôle

## Stack technique

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- MySQL avec `mysql2/promise`
- Recharts
- lucide-react
- date-fns
- shadcn-style UI primitives

## Prérequis

- Node.js 20+
- npm
- Une base MySQL accessible

## Configuration locale

Créez un fichier local d'environnement avec vos vraies valeurs :

```text
.env.local
```

Exemple de contenu :

```env
DB_HOST=
DB_HOST_IPV4=
DB_PORT=3306
DB_NAME=assureur_acs_mail_archive
DB_USER=
DB_PASSWORD=

APP_NAME=ACS Mail Intelligence
APP_USER_EMAIL=manager@acs.ci
APP_USER_ROLE=manager
AUTH_SECRET=change-me-in-production
ADMIN_EMAIL=admin@acs.ci
ADMIN_PASSWORD=Admin123!
```

Le fichier [.env.local](.env.local) est ignoré par Git. Le fichier [.env.example](.env.example) sert de modèle sans secret.

## Installation et lancement

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Ouvrez ensuite :

```text
http://127.0.0.1:3001/dashboard
```

## Scripts disponibles

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Sécurité et confidentialité

- Les identifiants MySQL sont conservés côté serveur.
- Les routes API utilisent un runtime Node.js et des requêtes SQL paramétrées.
- Les accès sensibles sont contrôlés par rôle (`admin`, `manager`, `analyst`, `viewer`).
- Les secrets sont stockés dans un fichier local non versionné et ignoré par Git.

## Déploiement

Pour Vercel ou une autre plateforme, ajoutez les mêmes variables d'environnement côté hébergement. Le build de production doit rester propre avec :

```bash
npm run build
```
