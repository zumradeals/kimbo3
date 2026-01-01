# KPM Edge Functions

## Qu'est-ce qu'une Edge Function ?

Les **Edge Functions** (fonctions de bord) sont des fonctions serverless qui s'exécutent au plus près des utilisateurs, sur des serveurs distribués géographiquement. Elles permettent d'exécuter du code côté serveur sans gérer d'infrastructure.

### Pourquoi les utiliser ?

1. **Sécurité** : Le code s'exécute côté serveur, les secrets (clés API, tokens) ne sont jamais exposés au client
2. **Performance** : Exécution au plus proche de l'utilisateur (faible latence)
3. **Scalabilité** : Mise à l'échelle automatique selon la charge
4. **Pas de serveur à gérer** : Infrastructure entièrement gérée

### Cas d'usage dans KPM

- **Création d'utilisateurs** : Nécessite le `SERVICE_ROLE_KEY` pour créer des comptes via l'API admin de Supabase
- **Suppression d'utilisateurs** : Idem, opération admin sensible
- **Mise à jour des identifiants** : Modification email/mot de passe par un admin

---

## Liste des Edge Functions KPM

### 1. `create-user`
Crée un nouvel utilisateur avec profil, département et rôles.

**Endpoint** : `POST /functions/v1/create-user`

**Authentification** : Requise (Bearer token d'un admin)

**Body** :
```json
{
  "email": "user@example.com",
  "password": "motdepasse123",
  "first_name": "Jean",
  "last_name": "Dupont",
  "department_id": "uuid-du-departement",
  "roles": ["agent_logistique", "employe"]
}
```

---

### 2. `delete-user`
Supprime un utilisateur (cascade : profil, rôles).

**Endpoint** : `POST /functions/v1/delete-user`

**Authentification** : Requise (Bearer token d'un admin)

**Body** :
```json
{
  "user_id": "uuid-de-lutilisateur"
}
```

**Sécurités** :
- Auto-suppression interdite
- Rate limiting : 10 req/min
- Logging structuré

---

### 3. `admin-update-user`
Met à jour l'email et/ou le mot de passe d'un utilisateur.

**Endpoint** : `POST /functions/v1/admin-update-user`

**Authentification** : Requise (Bearer token d'un admin)

**Body** :
```json
{
  "user_id": "uuid-de-lutilisateur",
  "email": "nouveau@email.com",
  "password": "nouveaumotdepasse",
  "reason": "Demande de changement d'email"
}
```

**Sécurités** :
- Justification obligatoire (min 5 caractères)
- Rate limiting : 10 req/min
- Audit trail automatique
- Modification propre email interdite

---

## Modules partagés (`_shared/`)

### `rate-limiter.ts`
Implémente un rate limiting en mémoire par IP ou utilisateur.

### `structured-logger.ts`
Fournit un logging structuré JSON pour la traçabilité.

---

## Déploiement

### Sur Supabase Cloud (hébergé)
Les functions sont déployées automatiquement via `supabase functions deploy`.

### Sur Supabase Self-Hosted (VPS)
Voir le guide de déploiement VPS pour la configuration complète.

### Variables d'environnement requises
```env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
SUPABASE_ANON_KEY=votre_anon_key
```

---

## Appel depuis le frontend

```typescript
import { supabase } from "@/integrations/supabase/client";

// Créer un utilisateur
const { data, error } = await supabase.functions.invoke('create-user', {
  body: {
    email: 'nouveau@exemple.com',
    password: 'motdepasse123',
    first_name: 'Marie',
    last_name: 'Martin',
    roles: ['employe']
  }
});
```
