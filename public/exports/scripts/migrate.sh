#!/bin/bash
# ==============================================================================
# KPM - Script de migration de base de données
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPORTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🗄️  Migration de la base de données KPM${NC}"
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

# Variables de connexion
PGHOST="${POSTGRES_HOST:-localhost}"
PGPORT="${POSTGRES_PORT:-5432}"
PGDATABASE="${POSTGRES_DB:-postgres}"
PGUSER="${POSTGRES_USER:-postgres}"
PGPASSWORD="${POSTGRES_PASSWORD}"

export PGPASSWORD

# Vérifier la connexion
echo -e "${YELLOW}🔍 Vérification de la connexion PostgreSQL...${NC}"
if ! psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}❌ Impossible de se connecter à PostgreSQL${NC}"
    echo "  Host: $PGHOST"
    echo "  Port: $PGPORT"
    echo "  Database: $PGDATABASE"
    echo "  User: $PGUSER"
    exit 1
fi
echo -e "${GREEN}✓ Connexion établie${NC}"
echo ""

# Appliquer le schéma principal
echo -e "${YELLOW}📦 Application du schéma principal...${NC}"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$EXPORTS_DIR/kpm-database-schema.sql"
echo -e "${GREEN}✓ Schéma appliqué${NC}"
echo ""

# Créer le trigger sur auth.users si nécessaire
echo -e "${YELLOW}🔧 Configuration du trigger d'authentification...${NC}"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" << 'EOF'
-- Créer le trigger sur auth.users pour la création automatique de profils
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
        RAISE NOTICE 'Trigger on_auth_user_created créé';
    ELSE
        RAISE NOTICE 'Trigger on_auth_user_created existe déjà';
    END IF;
END $$;
EOF
echo -e "${GREEN}✓ Trigger configuré${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    Migration terminée avec succès!     ${NC}"
echo -e "${GREEN}========================================${NC}"
