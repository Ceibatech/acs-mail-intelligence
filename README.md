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

La base garde les metadonnees dans `email_messages` et les contenus lisibles dans
`email_message_bodies`. La fiche 360 du message lit directement cette table :

```sql
SELECT
    e.id,
    e.subject,
    e.from_header,
    e.to_header,
    e.cc_header,
    e.bcc_header,
    e.email_date,
    e.imported_at,
    e.folder,
    e.size_bytes,
    e.message_id,
    m.email_address AS mailbox,
    b.body_text,
    b.body_html,
    b.body_preview,
    b.body_length,
    b.extraction_status
FROM email_messages e
JOIN mailboxes m ON m.id = e.mailbox_id
LEFT JOIN email_message_bodies b ON b.message_id = e.id
WHERE e.id = ?
LIMIT 1;
```

Schema propre pour ton script Python d'extraction :

```sql
CREATE TABLE IF NOT EXISTS email_message_bodies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT UNSIGNED NOT NULL,
  body_text LONGTEXT NULL,
  body_html LONGTEXT NULL,
  body_preview TEXT NULL,
  body_length INT UNSIGNED NULL,
  html_length INT UNSIGNED NULL,
  extraction_status VARCHAR(32) NOT NULL DEFAULT 'success',
  extraction_error TEXT NULL,
  extracted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_email_message_bodies_message (message_id),
  INDEX idx_email_message_bodies_status (extraction_status),
  CONSTRAINT fk_email_message_bodies_message
    FOREIGN KEY (message_id) REFERENCES email_messages(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Puis ton Python peut faire un upsert :

```sql
INSERT INTO email_message_bodies
  (message_id, body_text, body_html, body_preview, body_length, html_length,
   extraction_status, extraction_error, extracted_at)
VALUES
  (?, ?, ?, ?, ?, ?, 'success', NULL, NOW())
ON DUPLICATE KEY UPDATE
  body_text = VALUES(body_text),
  body_html = VALUES(body_html),
  body_preview = VALUES(body_preview),
  body_length = VALUES(body_length),
  html_length = VALUES(html_length),
  extraction_status = VALUES(extraction_status),
  extraction_error = VALUES(extraction_error),
  extracted_at = VALUES(extracted_at),
  updated_at = CURRENT_TIMESTAMP;
```

Depuis cPanel ou toute machine qui voit les chemins `/home3/...`, lance le
backfill par lots. Par defaut le script remplit `email_message_bodies` :

```bash
npm run email:backfill-bodies -- --limit=1000 --batch-size=100
```

Options utiles :

```bash
npm run email:backfill-bodies -- --dry-run --limit=100
npm run email:backfill-bodies -- --ids=1227814 --target=bodies
npm run email:backfill-bodies -- --from-id=1200000 --limit=5000
npm run email:backfill-bodies -- --max-body-chars=80000
npm run email:backfill-bodies -- --retry-failed --limit=1000
```

Pour traiter rapidement les messages recents comme ceux de juillet 2026 :

```bash
npm run email:backfill-bodies -- --target=bodies --from-id=1224000 --limit=10000 --batch-size=200
```

Le script lit les fichiers bruts, extrait `text/plain`, garde aussi `text/html`,
calcule `body_preview`, puis fait un upsert dans `email_message_bodies`.

Option legacy si tu veux aussi remplir `email_messages.body_text` :

```bash
npm run email:backfill-bodies -- --target=both --limit=1000 --batch-size=100
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

Si l'integration GitHub -> Vercel ne redeploie pas assez vite, cree un Deploy
Hook dans Vercel puis garde son URL dans une variable locale ou CI :

```bash
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/...
npm run deploy:vercel-hook
```

Ne commit jamais l'URL du hook : elle declenche un deploiement production.
