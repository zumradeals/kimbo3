# KPM - Package d'Export pour Déploiement Indépendant

Ce dossier contient tous les fichiers nécessaires pour déployer KPM (KIMBO Procurement Management) sur votre propre infrastructure.

---

## 📁 Contenu du package

```
exports/
├── README.md                      # Ce fichier
├── GUIDE-DEPLOIEMENT-VPS.md       # Guide complet de déploiement
├── kpm-database-schema.sql        # Schéma complet de la base de données
└── edge-functions/                # Fonctions serverless
    ├── README.md                  # Documentation des edge functions
    ├── create-user.ts             # Création d'utilisateur
    ├── delete-user.ts             # Suppression d'utilisateur
    ├── admin-update-user.ts       # Modification email/password
    └── _shared/                   # Modules partagés
        ├── rate-limiter.ts        # Rate limiting
        └── structured-logger.ts   # Logging structuré
```

---

## 🚀 Démarrage rapide

### 1. Préparer l'infrastructure
- Suivez le [Guide de Déploiement VPS](./GUIDE-DEPLOIEMENT-VPS.md)

### 2. Importer la base de données
```bash
psql -U postgres -d postgres < kpm-database-schema.sql
```

### 3. Déployer les Edge Functions
```bash
supabase functions deploy create-user
supabase functions deploy delete-user
supabase functions deploy admin-update-user
```

### 4. Builder le frontend
```bash
npm install && npm run build
```

---

## 📊 Schéma de base de données

Le fichier `kpm-database-schema.sql` contient :

| Section | Contenu |
|---------|---------|
| **Enums** | 10 types énumérés (app_role, besoin_status, da_status, etc.) |
| **Tables** | 25+ tables (besoins, demandes_achat, bons_livraison, etc.) |
| **Fonctions** | 20+ fonctions de sécurité et utilitaires |
| **Triggers** | Triggers d'audit, mise à jour automatique, verrouillage |
| **RLS** | Politiques de sécurité Row-Level Security |
| **Storage** | Buckets pour pièces jointes |
| **Données** | Rôles, unités, catégories par défaut |

---

## 🔐 Edge Functions

Les **Edge Functions** sont des fonctions serverless qui s'exécutent côté serveur. Elles sont nécessaires pour les opérations sensibles qui requièrent le `SERVICE_ROLE_KEY` :

| Fonction | Description | Sécurité |
|----------|-------------|----------|
| `create-user` | Crée un utilisateur avec profil et rôles | Admin requis |
| `delete-user` | Supprime un utilisateur | Admin requis, rate limit |
| `admin-update-user` | Modifie email/password | Admin requis, justification obligatoire |

Voir [edge-functions/README.md](./edge-functions/README.md) pour la documentation détaillée.

---

## ⚠️ Notes importantes

1. **Ce package est un export** : Il est destiné à un déploiement indépendant, pas à remplacer Lovable Cloud
2. **Sécurité** : Changez TOUS les mots de passe et secrets avant la production
3. **Mises à jour** : Ce fichier est généré manuellement, demandez une nouvelle version si nécessaire
4. **Support** : Le déploiement self-hosted nécessite des compétences DevOps

---

## 📅 Versioning

| Date | Version | Changements |
|------|---------|-------------|
| 2025-12-30 | 1.0 | Export initial complet |

---

## 📞 Besoin d'aide ?

- **Lovable Cloud** : Contactez le support Lovable
- **Self-hosted** : Consultez la documentation Supabase
- **Bugs applicatifs** : Ouvrez une issue sur le repo

---

*Généré automatiquement par KPM Export System*
