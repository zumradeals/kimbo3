# KPM - Package de Déploiement IKOMA MCP

> **KIMBO Procurement Management** - Système de gestion des achats et approvisionnements

---

## 📋 Contenu du Package

Ce package contient **TOUS** les éléments nécessaires au déploiement autonome de KPM, sans aucune dépendance à Lovable ou à une infrastructure propriétaire.

```
public/exports/
├── .env.example              # Variables d'environnement (COPIER en .env)
├── Dockerfile                # Build du frontend
├── docker-compose.yml        # Stack complète (frontend + Supabase)
├── start.sh                  # Script de démarrage principal
├── kpm-database-schema.sql   # Schéma complet PostgreSQL
├── nginx/
│   └── default.conf          # Configuration Nginx
├── kong/
│   └── kong.yml              # Configuration API Gateway (généré auto)
├── scripts/
│   ├── migrate.sh            # Migration base de données
│   ├── seed.sh               # Données initiales
│   └── create-admin.sh       # Créer le premier admin
├── edge-functions/           # Fonctions serverless
│   ├── _shared/              # Modules partagés
│   ├── create-user/          # Création utilisateur
│   ├── delete-user/          # Suppression utilisateur
│   └── admin-update-user/    # Mise à jour utilisateur
├── GUIDE-DEPLOIEMENT-VPS.md  # Guide détaillé
└── README-IKOMA.md           # Ce fichier
```

---

## 🚀 Déploiement Rapide

### Prérequis

- **Docker** >= 20.10 avec Docker Compose v2
- **Git**
- **Ports disponibles**: 3000, 5432, 8000, 9999

### Étapes

```bash
# 1. Cloner le projet
git clone <repository-url>
cd <project>

# 2. Configurer l'environnement
cd public/exports
cp .env.example .env
nano .env  # Éditer les valeurs

# 3. Rendre les scripts exécutables
chmod +x start.sh scripts/*.sh

# 4. Démarrer
./start.sh start
```

### Vérification

- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000
- **PostgreSQL**: localhost:5432

---

## 📦 Composants

### Frontend (React + Vite + TypeScript)

Application SPA complète avec:
- Gestion des besoins
- Demandes d'achat avec workflow
- Bons de livraison
- Gestion de stock
- Notes de frais
- Comptabilité (SYSCOHADA)
- Gestion des caisses
- Administration utilisateurs

**Build**:
```bash
npm ci
npm run build
# Résultat: ./dist/
```

### Backend (Supabase Self-Hosted)

Stack complète incluant:
- **PostgreSQL 15**: Base de données relationnelle
- **GoTrue**: Authentification (email/password)
- **PostgREST**: API REST automatique
- **Realtime**: WebSocket pour temps réel
- **Storage**: Stockage de fichiers
- **Kong**: API Gateway

### Edge Functions (Deno)

Fonctions serverless pour opérations admin:
- `create-user`: Création utilisateur avec rôles
- `delete-user`: Suppression sécurisée
- `admin-update-user`: Mise à jour email/password

**Sécurité**:
- Rate limiting (10 req/min)
- Logging structuré JSON
- Vérification rôle admin
- Audit trail automatique

---

## 🗄️ Base de Données

### Schéma

Le fichier `kpm-database-schema.sql` contient:
- 30+ tables métier
- Enums pour statuts et catégories
- Fonctions de sécurité (RLS helpers)
- Triggers automatiques (audit, timestamps, stock)
- Politiques RLS complètes
- Données initiales (rôles, unités, catégories)

### Migration

```bash
# Via Docker
docker compose exec -T db psql -U postgres < kpm-database-schema.sql

# Ou avec le script
./scripts/migrate.sh
```

### Seed (Données Initiales)

```bash
./scripts/seed.sh
```

Crée: départements, catégories de paiement, méthodes de paiement, caisses, catégories stock, comptes comptables SYSCOHADA.

---

## 🔐 Sécurité

### Row Level Security (RLS)

Toutes les tables ont RLS activé avec politiques par rôle:
- `admin`: Accès complet
- `dg`: Vision globale
- `daf`: Finances et validation
- `responsable_*`: Leur périmètre
- `employe`: Leurs propres données

### Authentification

- Sessions JWT sécurisées
- Refresh token automatique
- Rate limiting sur les endpoints sensibles

### Variables Sensibles

**Ne jamais exposer**:
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `POSTGRES_PASSWORD`

---

## 📝 Configuration

### Variables Obligatoires

```env
# Supabase
SUPABASE_URL=https://api.votredomaine.com
SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_key>
JWT_SECRET=<32+ caractères>

# PostgreSQL
POSTGRES_PASSWORD=<password_complexe>

# Frontend
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY}
```

### Génération des Clés JWT

```bash
node -e "
const jwt = require('jsonwebtoken');
const secret = require('crypto').randomBytes(32).toString('hex');
console.log('JWT_SECRET=' + secret);
console.log('ANON_KEY=' + jwt.sign({role:'anon',iss:'supabase'}, secret, {expiresIn:'10y'}));
console.log('SERVICE_ROLE_KEY=' + jwt.sign({role:'service_role',iss:'supabase'}, secret, {expiresIn:'10y'}));
"
```

---

## 🔧 Commandes

### Gestion des Services

```bash
./start.sh start    # Démarrer
./start.sh stop     # Arrêter
./start.sh restart  # Redémarrer
./start.sh logs     # Voir les logs
./start.sh status   # Statut des conteneurs
```

### Création Admin

```bash
./scripts/create-admin.sh
# Saisir: email, password, prénom, nom
```

### Backup Base de Données

```bash
docker compose exec db pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql
```

### Restauration

```bash
docker compose exec -T db psql -U postgres postgres < backup_YYYYMMDD.sql
```

---

## 📊 Observabilité

### Logs

Tous les services écrivent sur `stdout` en JSON structuré:

```bash
# Tous les logs
docker compose logs -f

# Service spécifique
docker compose logs -f frontend
docker compose logs -f db
docker compose logs -f edge-functions
```

### Healthchecks

- PostgreSQL: `pg_isready`
- Frontend: HTTP GET `/health`
- Kong: HTTP GET `/`

---

## 🔄 Mises à Jour

### Frontend

```bash
git pull origin main
cd public/exports
docker compose build frontend
docker compose up -d frontend
```

### Edge Functions

```bash
# Les fonctions sont montées en volume, redémarrage suffit
docker compose restart edge-functions
```

### Base de Données

```bash
# Appliquer une migration
docker compose exec -T db psql -U postgres < nouvelle_migration.sql
```

---

## ❓ Dépannage

### La base ne démarre pas

```bash
docker compose logs db
# Vérifier POSTGRES_PASSWORD dans .env
```

### Le frontend ne se connecte pas à l'API

```bash
# Vérifier les variables VITE_*
cat .env | grep VITE_
# Reconstruire
docker compose build --no-cache frontend
```

### Erreur 401 sur les Edge Functions

```bash
# Vérifier SUPABASE_SERVICE_ROLE_KEY
docker compose logs edge-functions
```

### Reset Complet

```bash
docker compose down -v  # Supprime les volumes
./start.sh start
./scripts/migrate.sh
./scripts/seed.sh
./scripts/create-admin.sh
```

---

## 📞 Support

- Documentation: `GUIDE-DEPLOIEMENT-VPS.md`
- Issues: Créer une issue sur le repository

---

*Package IKOMA MCP - Version 1.0 - Janvier 2026*
