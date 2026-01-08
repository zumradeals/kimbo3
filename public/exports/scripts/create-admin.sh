#!/bin/bash
# ==============================================================================
# KPM - Création du premier administrateur
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPORTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}👤 Création du premier administrateur KPM${NC}"
echo ""

# Charger les variables d'environnement
if [ -f "$EXPORTS_DIR/.env" ]; then
    set -a
    source "$EXPORTS_DIR/.env"
    set +a
else
    echo -e "${RED}❌ Fichier .env manquant${NC}"
    exit 1
fi

# Demander les informations
read -p "Email de l'administrateur: " ADMIN_EMAIL
read -s -p "Mot de passe (min 6 caractères): " ADMIN_PASSWORD
echo ""
read -p "Prénom: " ADMIN_FIRST_NAME
read -p "Nom: " ADMIN_LAST_NAME

# Validation
if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ] || [ -z "$ADMIN_FIRST_NAME" ] || [ -z "$ADMIN_LAST_NAME" ]; then
    echo -e "${RED}❌ Tous les champs sont obligatoires${NC}"
    exit 1
fi

if [ ${#ADMIN_PASSWORD} -lt 6 ]; then
    echo -e "${RED}❌ Le mot de passe doit faire au moins 6 caractères${NC}"
    exit 1
fi

API_URL="${SUPABASE_URL:-http://localhost:8000}"
ANON_KEY="${SUPABASE_ANON_KEY}"

echo ""
echo -e "${YELLOW}📡 Création de l'utilisateur via l'API...${NC}"

# Créer l'utilisateur via l'API Supabase Auth
RESPONSE=$(curl -s -X POST "${API_URL}/auth/v1/signup" \
    -H "Content-Type: application/json" \
    -H "apikey: ${ANON_KEY}" \
    -d "{
        \"email\": \"${ADMIN_EMAIL}\",
        \"password\": \"${ADMIN_PASSWORD}\",
        \"data\": {
            \"first_name\": \"${ADMIN_FIRST_NAME}\",
            \"last_name\": \"${ADMIN_LAST_NAME}\"
        }
    }")

# Extraire l'ID utilisateur
USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
    echo -e "${RED}❌ Erreur lors de la création de l'utilisateur${NC}"
    echo "Réponse: $RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Utilisateur créé: $USER_ID${NC}"

# Assigner le rôle admin
echo -e "${YELLOW}🔐 Attribution du rôle administrateur...${NC}"

PGHOST="${POSTGRES_HOST:-localhost}"
PGPORT="${POSTGRES_PORT:-5432}"
PGDATABASE="${POSTGRES_DB:-postgres}"
PGUSER="${POSTGRES_USER:-postgres}"
PGPASSWORD="${POSTGRES_PASSWORD}"

export PGPASSWORD

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" << EOF
-- Supprimer le rôle employé par défaut
DELETE FROM public.user_roles WHERE user_id = '${USER_ID}';

-- Ajouter le rôle admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('${USER_ID}', 'admin');

-- Mettre à jour le profil
UPDATE public.profiles
SET first_name = '${ADMIN_FIRST_NAME}',
    last_name = '${ADMIN_LAST_NAME}'
WHERE id = '${USER_ID}';
EOF

echo -e "${GREEN}✓ Rôle admin attribué${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    Administrateur créé avec succès!    ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Email: ${BLUE}${ADMIN_EMAIL}${NC}"
echo -e "Vous pouvez maintenant vous connecter à KPM"
echo ""
