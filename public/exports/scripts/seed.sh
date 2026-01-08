#!/bin/bash
# ==============================================================================
# KPM - Script de seed (données initiales)
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

echo -e "${YELLOW}🌱 Initialisation des données KPM${NC}"
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

echo -e "${YELLOW}📦 Insertion des données initiales...${NC}"

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" << 'EOF'

-- Vérifier si les données existent déjà
DO $$
BEGIN
    -- Départements par défaut
    IF NOT EXISTS (SELECT 1 FROM public.departments LIMIT 1) THEN
        INSERT INTO public.departments (name, description) VALUES
            ('Direction Générale', 'Direction générale de l''entreprise'),
            ('Direction Administrative et Financière', 'DAF - Gestion financière et administrative'),
            ('Service Logistique', 'Gestion des stocks et livraisons'),
            ('Service Achats', 'Gestion des achats et fournisseurs'),
            ('Comptabilité', 'Service comptabilité'),
            ('Ressources Humaines', 'Gestion du personnel'),
            ('Production', 'Service production'),
            ('Commercial', 'Service commercial et ventes');
        RAISE NOTICE 'Départements créés';
    ELSE
        RAISE NOTICE 'Départements déjà présents';
    END IF;

    -- Catégories de paiement par défaut
    IF NOT EXISTS (SELECT 1 FROM public.payment_categories LIMIT 1) THEN
        INSERT INTO public.payment_categories (code, name, description) VALUES
            ('FOURNITURES', 'Fournitures de bureau', 'Fournitures et consommables de bureau'),
            ('EQUIPEMENT', 'Équipement', 'Matériel et équipements'),
            ('SERVICES', 'Services', 'Prestations de services'),
            ('TRAVAUX', 'Travaux', 'Travaux et aménagements'),
            ('MAINTENANCE', 'Maintenance', 'Entretien et maintenance'),
            ('TRANSPORT', 'Transport', 'Frais de transport et déplacement'),
            ('TELECOMMUNICATION', 'Télécommunications', 'Téléphone, internet, etc.'),
            ('ENERGIE', 'Énergie', 'Électricité, eau, gaz'),
            ('LOCATION', 'Location', 'Loyers et locations'),
            ('AUTRES', 'Autres', 'Autres dépenses');
        RAISE NOTICE 'Catégories de paiement créées';
    ELSE
        RAISE NOTICE 'Catégories de paiement déjà présentes';
    END IF;

    -- Méthodes de paiement par défaut
    IF NOT EXISTS (SELECT 1 FROM public.payment_methods LIMIT 1) THEN
        INSERT INTO public.payment_methods (code, name, description, requires_reference) VALUES
            ('ESPECES', 'Espèces', 'Paiement en espèces', false),
            ('CHEQUE', 'Chèque', 'Paiement par chèque', true),
            ('VIREMENT', 'Virement bancaire', 'Paiement par virement', true),
            ('CARTE', 'Carte bancaire', 'Paiement par carte', true),
            ('MOBILE', 'Mobile Money', 'Paiement mobile (Orange Money, MTN, etc.)', true),
            ('COMPENSATION', 'Compensation', 'Compensation inter-comptes', true);
        RAISE NOTICE 'Méthodes de paiement créées';
    ELSE
        RAISE NOTICE 'Méthodes de paiement déjà présentes';
    END IF;

    -- Caisse principale par défaut
    IF NOT EXISTS (SELECT 1 FROM public.caisses LIMIT 1) THEN
        INSERT INTO public.caisses (code, name, description, type, devise, solde_initial, solde_actuel) VALUES
            ('CAISSE-PRINCIPALE', 'Caisse Principale', 'Caisse principale de l''entreprise', 'principale', 'XAF', 0, 0),
            ('CAISSE-MENUES', 'Caisse Menues Dépenses', 'Petite caisse pour les menues dépenses', 'secondaire', 'XAF', 0, 0);
        RAISE NOTICE 'Caisses créées';
    ELSE
        RAISE NOTICE 'Caisses déjà présentes';
    END IF;

    -- Catégories de stock par défaut
    IF NOT EXISTS (SELECT 1 FROM public.stock_categories LIMIT 1) THEN
        INSERT INTO public.stock_categories (name, description) VALUES
            ('Fournitures de bureau', 'Papeterie, stylos, classeurs, etc.'),
            ('Consommables informatiques', 'Cartouches, câbles, accessoires'),
            ('Mobilier', 'Bureaux, chaises, armoires'),
            ('Équipement informatique', 'Ordinateurs, imprimantes, écrans'),
            ('Équipement électrique', 'Câbles, prises, éclairage'),
            ('Produits d''entretien', 'Nettoyage, hygiène'),
            ('Outillage', 'Outils divers'),
            ('Pièces détachées', 'Pièces de rechange');
        RAISE NOTICE 'Catégories de stock créées';
    ELSE
        RAISE NOTICE 'Catégories de stock déjà présentes';
    END IF;

    -- Comptes comptables SYSCOHADA de base
    IF NOT EXISTS (SELECT 1 FROM public.comptes_comptables LIMIT 1) THEN
        INSERT INTO public.comptes_comptables (code, libelle, classe) VALUES
            ('601', 'Achats de marchandises', 6),
            ('602', 'Achats de matières premières', 6),
            ('604', 'Achats stockés de matières et fournitures', 6),
            ('605', 'Autres achats', 6),
            ('606', 'Achats non stockés', 6),
            ('611', 'Sous-traitance', 6),
            ('612', 'Redevances de crédit-bail', 6),
            ('613', 'Locations', 6),
            ('614', 'Charges locatives', 6),
            ('615', 'Entretien et réparations', 6),
            ('616', 'Primes d''assurance', 6),
            ('617', 'Études, recherches', 6),
            ('618', 'Divers', 6),
            ('621', 'Personnel extérieur', 6),
            ('622', 'Rémunérations intermédiaires', 6),
            ('623', 'Publicité, publications', 6),
            ('624', 'Transports de biens', 6),
            ('625', 'Déplacements, missions', 6),
            ('626', 'Frais postaux et télécommunications', 6),
            ('627', 'Services bancaires', 6),
            ('628', 'Autres services extérieurs', 6);
        RAISE NOTICE 'Comptes comptables créés';
    ELSE
        RAISE NOTICE 'Comptes comptables déjà présents';
    END IF;

END $$;

EOF

echo -e "${GREEN}✓ Données initiales insérées${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    Seed terminé avec succès!           ${NC}"
echo -e "${GREEN}========================================${NC}"
