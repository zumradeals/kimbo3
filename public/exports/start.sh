#!/bin/bash
# ==============================================================================
# KPM - Script de démarrage pour IKOMA MCP
# ==============================================================================

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    KPM - KIMBO Procurement Management   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ==============================================================================
# Vérification des prérequis
# ==============================================================================
check_prerequisites() {
    echo -e "${YELLOW}🔍 Vérification des prérequis...${NC}"
    
    # Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker n'est pas installé${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker installé${NC}"
    
    # Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}❌ Docker Compose n'est pas installé${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker Compose installé${NC}"
    
    # Fichier .env
    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        echo -e "${YELLOW}⚠️  Fichier .env manquant, copie depuis .env.example...${NC}"
        cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
        echo -e "${YELLOW}📝 Veuillez éditer $SCRIPT_DIR/.env avec vos valeurs${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Fichier .env présent${NC}"
    
    echo ""
}

# ==============================================================================
# Chargement des variables d'environnement
# ==============================================================================
load_env() {
    echo -e "${YELLOW}📦 Chargement des variables d'environnement...${NC}"
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
    echo -e "${GREEN}✓ Variables chargées${NC}"
    echo ""
}

# ==============================================================================
# Création des répertoires nécessaires
# ==============================================================================
create_directories() {
    echo -e "${YELLOW}📁 Création des répertoires...${NC}"
    mkdir -p "$SCRIPT_DIR/kong"
    mkdir -p "$SCRIPT_DIR/nginx"
    echo -e "${GREEN}✓ Répertoires créés${NC}"
    echo ""
}

# ==============================================================================
# Vérification de la configuration Kong
# ==============================================================================
check_kong_config() {
    if [ ! -f "$SCRIPT_DIR/kong/kong.yml" ]; then
        echo -e "${YELLOW}📝 Génération de la configuration Kong...${NC}"
        cat > "$SCRIPT_DIR/kong/kong.yml" << 'KONGEOF'
_format_version: "2.1"

services:
  # Auth Service
  - name: auth-v1
    url: http://auth:9999
    routes:
      - name: auth-v1-route
        strip_path: true
        paths:
          - /auth/v1
        
  # REST Service
  - name: rest-v1
    url: http://rest:3000
    routes:
      - name: rest-v1-route
        strip_path: true
        paths:
          - /rest/v1
          
  # Realtime Service
  - name: realtime-v1
    url: http://realtime:4000/socket
    routes:
      - name: realtime-v1-route
        strip_path: true
        paths:
          - /realtime/v1

  # Storage Service
  - name: storage-v1
    url: http://storage:5000
    routes:
      - name: storage-v1-route
        strip_path: true
        paths:
          - /storage/v1

  # Edge Functions
  - name: functions-v1
    url: http://edge-functions:9000/functions/v1
    routes:
      - name: functions-v1-route
        strip_path: true
        paths:
          - /functions/v1

plugins:
  - name: cors
    config:
      origins:
        - "*"
      methods:
        - GET
        - POST
        - PUT
        - PATCH
        - DELETE
        - OPTIONS
      headers:
        - Accept
        - Authorization
        - Content-Type
        - apikey
        - x-client-info
      exposed_headers:
        - Content-Length
        - Content-Range
      credentials: true
      max_age: 3600
KONGEOF
        echo -e "${GREEN}✓ Configuration Kong générée${NC}"
    else
        echo -e "${GREEN}✓ Configuration Kong existante${NC}"
    fi
    echo ""
}

# ==============================================================================
# Démarrage des services
# ==============================================================================
start_services() {
    echo -e "${YELLOW}🚀 Démarrage des services...${NC}"
    
    cd "$SCRIPT_DIR"
    
    # Arrêter les conteneurs existants
    docker compose down --remove-orphans 2>/dev/null || true
    
    # Construire et démarrer
    docker compose up -d --build
    
    echo ""
    echo -e "${GREEN}✓ Services démarrés${NC}"
    echo ""
}

# ==============================================================================
# Attente de la disponibilité des services
# ==============================================================================
wait_for_services() {
    echo -e "${YELLOW}⏳ Attente de la disponibilité des services...${NC}"
    
    # Attendre PostgreSQL
    echo -n "  PostgreSQL: "
    for i in {1..30}; do
        if docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
            echo -e "${GREEN}prêt${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}timeout${NC}"
            exit 1
        fi
        sleep 2
    done
    
    # Attendre Kong
    echo -n "  API Gateway: "
    for i in {1..30}; do
        if curl -s http://localhost:8000/rest/v1/ > /dev/null 2>&1; then
            echo -e "${GREEN}prêt${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${YELLOW}en cours...${NC}"
        fi
        sleep 2
    done
    
    # Attendre le frontend
    echo -n "  Frontend: "
    for i in {1..30}; do
        if curl -s http://localhost:3000/ > /dev/null 2>&1; then
            echo -e "${GREEN}prêt${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${YELLOW}en cours...${NC}"
        fi
        sleep 2
    done
    
    echo ""
}

# ==============================================================================
# Affichage des informations
# ==============================================================================
show_info() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}    KPM démarré avec succès!            ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "📱 Frontend:       ${BLUE}http://localhost:3000${NC}"
    echo -e "🔌 API Supabase:   ${BLUE}http://localhost:8000${NC}"
    echo -e "🗄️  PostgreSQL:     ${BLUE}localhost:5432${NC}"
    echo -e "⚡ Edge Functions: ${BLUE}http://localhost:54321${NC}"
    echo ""
    echo -e "${YELLOW}📋 Commandes utiles:${NC}"
    echo "  docker compose logs -f          # Voir les logs"
    echo "  docker compose down             # Arrêter"
    echo "  docker compose restart          # Redémarrer"
    echo "  docker compose ps               # Statut des services"
    echo ""
    echo -e "${YELLOW}📝 Pour créer le premier admin:${NC}"
    echo "  Voir la documentation: public/exports/GUIDE-DEPLOIEMENT-VPS.md"
    echo ""
}

# ==============================================================================
# Fonction principale
# ==============================================================================
main() {
    case "${1:-start}" in
        start)
            check_prerequisites
            load_env
            create_directories
            check_kong_config
            start_services
            wait_for_services
            show_info
            ;;
        stop)
            echo -e "${YELLOW}🛑 Arrêt des services...${NC}"
            cd "$SCRIPT_DIR"
            docker compose down
            echo -e "${GREEN}✓ Services arrêtés${NC}"
            ;;
        restart)
            echo -e "${YELLOW}🔄 Redémarrage des services...${NC}"
            cd "$SCRIPT_DIR"
            docker compose restart
            echo -e "${GREEN}✓ Services redémarrés${NC}"
            ;;
        logs)
            cd "$SCRIPT_DIR"
            docker compose logs -f
            ;;
        status)
            cd "$SCRIPT_DIR"
            docker compose ps
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|logs|status}"
            exit 1
            ;;
    esac
}

main "$@"
