# Guide de Déploiement KPM sur VPS

Ce guide explique comment déployer KPM (KIMBO Procurement Management) sur votre propre infrastructure (VPS, serveur dédié, cloud privé).

---

## 📋 Prérequis

### Logiciels requis
- **Docker** & **Docker Compose** (v2.0+)
- **Node.js** 18+ et npm/pnpm
- **Git**
- Un nom de domaine (optionnel mais recommandé)
- Certificat SSL (Let's Encrypt gratuit)

### Ressources minimales
- **CPU** : 2 vCPU
- **RAM** : 4 Go minimum (8 Go recommandé)
- **Stockage** : 50 Go SSD
- **Ports ouverts** : 80, 443, 5432 (interne)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         NGINX                                │
│                    (Reverse Proxy + SSL)                     │
└─────────────────┬────────────────────────┬──────────────────┘
                  │                        │
         ┌────────▼────────┐      ┌────────▼────────┐
         │   Frontend      │      │   Supabase      │
         │   (React/Vite)  │      │   (API + Auth)  │
         │   Port 3000     │      │   Port 8000     │
         └─────────────────┘      └────────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │   PostgreSQL    │
                                  │   Port 5432     │
                                  └─────────────────┘
```

---

## 📦 Étape 1 : Installation de Supabase Self-Hosted

### 1.1 Cloner Supabase

```bash
# Créer le répertoire de travail
mkdir -p /opt/kpm && cd /opt/kpm

# Cloner le repo Supabase
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
```

### 1.2 Configurer les variables d'environnement

```bash
# Copier le fichier exemple
cp .env.example .env

# Éditer les variables CRITIQUES
nano .env
```

**Variables à modifier obligatoirement** :

```env
# ⚠️ CHANGER CES VALEURS - NE PAS UTILISER LES VALEURS PAR DÉFAUT
POSTGRES_PASSWORD=votre_mot_de_passe_postgres_tres_long_et_complexe
JWT_SECRET=votre_jwt_secret_de_minimum_32_caracteres_aleatoires
ANON_KEY=votre_anon_key_genere
SERVICE_ROLE_KEY=votre_service_role_key_genere
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=votre_mot_de_passe_dashboard

# URL de votre domaine
SITE_URL=https://kpm.votredomaine.com
API_EXTERNAL_URL=https://api.kpm.votredomaine.com

# Email (SMTP)
SMTP_HOST=smtp.votrefournisseur.com
SMTP_PORT=587
SMTP_USER=votre_email
SMTP_PASS=votre_mot_de_passe
SMTP_SENDER_NAME=KPM
```

### 1.3 Générer les clés JWT

```bash
# Générer les clés avec ce script
node -e "
const jwt = require('jsonwebtoken');
const secret = require('crypto').randomBytes(32).toString('hex');
console.log('JWT_SECRET=' + secret);
console.log('ANON_KEY=' + jwt.sign({ role: 'anon', iss: 'supabase' }, secret, { expiresIn: '10y' }));
console.log('SERVICE_ROLE_KEY=' + jwt.sign({ role: 'service_role', iss: 'supabase' }, secret, { expiresIn: '10y' }));
"
```

### 1.4 Démarrer Supabase

```bash
docker compose up -d
```

Vérifier le statut :
```bash
docker compose ps
```

---

## 📦 Étape 2 : Importer le schéma de base de données

### 2.1 Copier le fichier SQL

```bash
# Télécharger le schéma depuis l'export
curl -o /opt/kpm/schema.sql https://votre-url/exports/kpm-database-schema.sql

# Ou copier manuellement le fichier kpm-database-schema.sql
```

### 2.2 Importer dans PostgreSQL

```bash
# Se connecter au conteneur PostgreSQL
docker compose exec db psql -U postgres -d postgres

# Importer le schéma (dans psql)
\i /path/to/kpm-database-schema.sql

# Ou depuis l'extérieur
docker compose exec -T db psql -U postgres -d postgres < /opt/kpm/schema.sql
```

---

## 📦 Étape 3 : Déployer les Edge Functions

### 3.1 Installer Supabase CLI

```bash
npm install -g supabase
```

### 3.2 Préparer les fonctions

```bash
mkdir -p /opt/kpm/supabase/functions
cd /opt/kpm/supabase

# Copier les edge functions depuis l'export
cp -r /chemin/vers/exports/edge-functions/* functions/
```

### 3.3 Créer le fichier config.toml

```toml
# /opt/kpm/supabase/config.toml
[api]
enabled = true
port = 54321

[db]
port = 54322

[functions.create-user]
verify_jwt = true

[functions.delete-user]
verify_jwt = true

[functions.admin-update-user]
verify_jwt = true
```

### 3.4 Déployer les fonctions

```bash
# Lier au projet
supabase link --project-ref votre-project-ref

# Déployer
supabase functions deploy create-user
supabase functions deploy delete-user
supabase functions deploy admin-update-user
```

---

## 📦 Étape 4 : Déployer le Frontend

### 4.1 Builder l'application React

```bash
cd /opt/kpm/frontend

# Installer les dépendances
npm install

# Créer le fichier .env
cat > .env << EOF
VITE_SUPABASE_URL=https://api.kpm.votredomaine.com
VITE_SUPABASE_ANON_KEY=votre_anon_key
EOF

# Builder pour la production
npm run build
```

### 4.2 Servir avec NGINX

Créer `/etc/nginx/sites-available/kpm` :

```nginx
server {
    listen 80;
    server_name kpm.votredomaine.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name kpm.votredomaine.com;

    ssl_certificate /etc/letsencrypt/live/kpm.votredomaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kpm.votredomaine.com/privkey.pem;

    root /opt/kpm/frontend/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# API Supabase
server {
    listen 443 ssl http2;
    server_name api.kpm.votredomaine.com;

    ssl_certificate /etc/letsencrypt/live/kpm.votredomaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kpm.votredomaine.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activer le site :
```bash
ln -s /etc/nginx/sites-available/kpm /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 📦 Étape 5 : Créer le premier utilisateur Admin

### 5.1 Via SQL

```sql
-- Se connecter à PostgreSQL
docker compose exec db psql -U postgres -d postgres

-- Créer l'utilisateur dans auth.users (utilisez l'API Supabase de préférence)
-- Puis assigner le rôle admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('uuid-du-nouvel-utilisateur', 'admin');
```

### 5.2 Via l'API (recommandé)

```bash
curl -X POST 'https://api.kpm.votredomaine.com/auth/v1/signup' \
  -H 'apikey: votre_anon_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@votreentreprise.com",
    "password": "VotreMotDePasse123!",
    "data": {
      "first_name": "Admin",
      "last_name": "KPM"
    }
  }'
```

---

## 🔒 Sécurité en Production

### Checklist obligatoire

- [ ] Changer TOUS les mots de passe par défaut
- [ ] Configurer un firewall (UFW)
- [ ] Activer fail2ban
- [ ] Configurer les backups PostgreSQL
- [ ] Mettre en place la surveillance (monitoring)
- [ ] Configurer les alertes email/SMS

### Firewall UFW

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Backups PostgreSQL

```bash
# Script de backup quotidien
cat > /opt/kpm/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/kpm/backups
mkdir -p $BACKUP_DIR
docker compose exec -T db pg_dump -U postgres postgres | gzip > $BACKUP_DIR/kpm_$DATE.sql.gz
find $BACKUP_DIR -mtime +30 -delete
EOF
chmod +x /opt/kpm/backup.sh

# Cron quotidien à 2h du matin
echo "0 2 * * * /opt/kpm/backup.sh" | crontab -
```

---

## 🔄 Mises à jour

### Mettre à jour le frontend

```bash
cd /opt/kpm/frontend
git pull origin main
npm install
npm run build
```

### Mettre à jour les Edge Functions

```bash
cd /opt/kpm/supabase
supabase functions deploy --all
```

### Appliquer les migrations SQL

```bash
docker compose exec -T db psql -U postgres -d postgres < nouvelle_migration.sql
```

---

## 🆘 Dépannage

### Logs Supabase
```bash
docker compose logs -f
```

### Logs NGINX
```bash
tail -f /var/log/nginx/error.log
```

### Redémarrer les services
```bash
docker compose restart
systemctl restart nginx
```

### Vérifier la connectivité PostgreSQL
```bash
docker compose exec db pg_isready -U postgres
```

---

## 📞 Support

Pour toute question sur le déploiement :
- Consultez la documentation Supabase : https://supabase.com/docs/guides/self-hosting
- Ouvrez une issue sur le repo du projet

---

*Guide généré le 2025-12-30 - Version 1.0*
