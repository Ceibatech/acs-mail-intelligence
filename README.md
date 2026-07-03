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
ADMIN_EMAIL=admin@acs.ci
ADMIN_PASSWORD=Admin123!
ADMIN_FULL_NAME=Administrateur ACS
ETL_REFRESH_SECRET=change-me-for-etl-refresh
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
npm run auth:create-admin
```

## Authentification

L'application utilise une authentification serveur avec sessions stockees en base MySQL.
Le navigateur ne recoit jamais le hash du mot de passe ni les identifiants DB.

Tables creees automatiquement par le login ou le script admin :

- `app_users`
- `app_sessions`
- `app_login_attempts`
- `audit_logs`

Variables requises pour le premier compte admin :

```env
ADMIN_EMAIL=admin@acs.ci
ADMIN_PASSWORD=StrongPasswordHere
ADMIN_FULL_NAME=Administrateur ACS
```

Creation ou mise a jour du premier admin :

```powershell
$env:ADMIN_EMAIL="admin@acs.ci"
$env:ADMIN_PASSWORD="StrongPasswordHere"
$env:ADMIN_FULL_NAME="Administrateur ACS"
npm run auth:create-admin
```

Le login se teste ensuite sur :

```text
http://127.0.0.1:3001/login
```

Pour proteger une route API :

```ts
const user = await requireUser(request);
```

Pour proteger par role :

```ts
const user = await requireRole(["admin", "manager"], request);
```

Regles appliquees :

- `admin` accede a tout.
- `manager` accede a dashboard, emails, analytics et followups.
- `analyst` accede a dashboard, emails et analytics.
- `viewer` accede seulement a dashboard et analytics.
- La supervision technique est reservee au role `admin`.
- `raw_path` reste reserve au role `admin`.
- Creation/modification de relances reservees a `admin` et `manager`.

## Partage email

L'action `Partager` fonctionne sans service externe : elle ouvre un brouillon
email avec le lien interne vers le message archive, les metadonnees utiles, un
extrait du message et l'utilisateur connecte en copie.

Pour envoyer directement depuis le serveur, configurez ces variables dans Vercel :

```env
RESEND_API_KEY=...
SHARE_FROM_EMAIL=archives@votre-domaine.ci
SHARE_FROM_MODE=default
SHARE_ALLOWED_FROM_DOMAIN=acs.ci
SHARE_ADMIN_EMAIL=admin@acs.ci
```

- `SHARE_FROM_EMAIL` doit etre une adresse autorisee par votre service d'envoi.
- `SHARE_FROM_MODE=default` envoie depuis `SHARE_FROM_EMAIL`.
- `SHARE_FROM_MODE=user` envoie depuis l'email du compte connecte quand son domaine
  correspond a `SHARE_ALLOWED_FROM_DOMAIN`.
- `SHARE_ADMIN_EMAIL` est optionnel et recoit une copie des partages.
- L'utilisateur connecte est automatiquement ajoute en copie.

## Extraction des corps de messages

La table `email_messages` peut contenir les metadonnees sans le corps du message.
Dans ce cas, la fiche message indique que le corps reste a extraire.

Pour remplir `body_text`, executez le backfill sur une machine qui peut lire les
chemins `raw_path` Maildir, par exemple le serveur cPanel ou une copie locale des
archives :

```bash
npm run email:backfill-bodies -- --limit=1000 --batch-size=100
```

Options utiles :

```bash
npm run email:backfill-bodies -- --dry-run --limit=100
npm run email:backfill-bodies -- --from-id=1200000 --limit=5000
npm run email:backfill-bodies -- --max-body-chars=80000
```

Le script lit les fichiers bruts, extrait `text/plain`, utilise `text/html` en
secours, puis met a jour `body_text` et `has_body`.

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
