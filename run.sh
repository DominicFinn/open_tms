#!/bin/bash

# Open TMS Local Development Run Script
# Starts database in Docker, applies migrations, and runs backend/frontend from code

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_SERVICE="db"
DB_PORT=55432
DB_USER="tms"
DB_PASSWORD="tms"
DB_NAME="tms"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}"
BACKEND_PORT=3001
FRONTEND_PORT=5173

# Function to print colored messages
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to cleanup on exit
cleanup() {
    info "Shutting down..."
    # Kill background processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    # Stop database (optional - comment out if you want to keep it running)
    # docker compose stop $DB_SERVICE
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Check if Docker is running
info "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi
success "Docker is running"

# Check if docker-compose is available and working
DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
    success "Using 'docker compose'"
elif command -v docker-compose &> /dev/null && docker-compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
    success "Using 'docker-compose'"
else
    warning "Docker Compose not available, will use 'docker run' directly"
    DOCKER_COMPOSE_CMD=""
fi

# Start database
info "Starting database container..."
cd "$(dirname "$0")"
CONTAINER_NAME="open-tms-db"

if [ ! -z "$DOCKER_COMPOSE_CMD" ]; then
    # Use docker compose
    DB_CONTAINER_ID=$($DOCKER_COMPOSE_CMD ps -q $DB_SERVICE 2>/dev/null || echo "")
    if [ ! -z "$DB_CONTAINER_ID" ] && docker ps --format '{{.ID}}' | grep -q "^${DB_CONTAINER_ID}$"; then
        info "Database container is already running"
    else
        $DOCKER_COMPOSE_CMD up -d $DB_SERVICE
    fi
    DB_CONTAINER_ID=$($DOCKER_COMPOSE_CMD ps -q $DB_SERVICE 2>/dev/null || echo "")
else
    # Use docker run directly
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            info "Database container is already running"
        else
            info "Starting existing database container..."
            docker start $CONTAINER_NAME
        fi
    else
        info "Creating new database container..."
        docker run -d \
            --name $CONTAINER_NAME \
            -e POSTGRES_USER=$DB_USER \
            -e POSTGRES_PASSWORD=$DB_PASSWORD \
            -e POSTGRES_DB=$DB_NAME \
            -p ${DB_PORT}:5432 \
            -v open-tms-db-data:/var/lib/postgresql/data \
            postgres:16-alpine
    fi
    DB_CONTAINER_ID=$(docker ps -q -f name=$CONTAINER_NAME)
fi

# Wait for database to be ready
info "Waiting for database to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if [ ! -z "$DB_CONTAINER_ID" ] && docker exec $DB_CONTAINER_ID pg_isready -U $DB_USER -d $DB_NAME > /dev/null 2>&1; then
        success "Database is ready"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        error "Database failed to start after $MAX_ATTEMPTS attempts"
        exit 1
    fi
    sleep 1
    # Refresh container ID in case it just started
    if [ -z "$DB_CONTAINER_ID" ]; then
        if [ ! -z "$DOCKER_COMPOSE_CMD" ]; then
            DB_CONTAINER_ID=$($DOCKER_COMPOSE_CMD ps -q $DB_SERVICE 2>/dev/null || echo "")
        else
            DB_CONTAINER_ID=$(docker ps -q -f name=$CONTAINER_NAME)
        fi
    fi
done

# Set environment variables for backend
export DATABASE_URL="$DATABASE_URL"
export PORT="$BACKEND_PORT"
export NODE_ENV="development"

# Apply Prisma migrations
info "Applying database migrations..."
cd backend
if [ ! -f "node_modules/.prisma/client/index.js" ]; then
    info "Generating Prisma client..."
    npm run prisma:generate
fi

# Check if there are pending migrations
info "Checking for pending migrations..."
if npx prisma migrate deploy 2>&1 | grep -q "All migrations have been successfully applied\|No pending migrations"; then
    success "Database migrations applied"
else
    warning "Migration deploy had issues, checking status..."
    MIGRATION_STATUS=$(npx prisma migrate status 2>&1)
    if echo "$MIGRATION_STATUS" | grep -q "Database schema is up to date"; then
        success "Database schema is up to date"
    elif echo "$MIGRATION_STATUS" | grep -q "following migrations have not yet been applied"; then
        warning "Some migrations failed. Attempting to resolve..."
        # Try to resolve failed migrations
        npx prisma migrate resolve --applied $(echo "$MIGRATION_STATUS" | grep -A 10 "not yet been applied" | grep -E "^\s+[0-9]" | head -1 | xargs) 2>/dev/null || true
        # Try deploy again
        npx prisma migrate deploy || {
            error "Failed to apply migrations. You may need to reset the database."
            error "Run: cd backend && npx prisma migrate reset (WARNING: This will delete all data)"
            exit 1
        }
        success "Database migrations applied"
    else
        error "Failed to apply migrations"
        echo "$MIGRATION_STATUS"
        exit 1
    fi
fi

# Generate Prisma client (ensure it's up to date)
info "Ensuring Prisma client is generated..."
npm run prisma:generate
success "Prisma client ready"

cd ..

# Check if node_modules exist
info "Checking dependencies..."
if [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    warning "Dependencies not installed. Running npm install..."
    npm install
fi

# Create frontend .env if it doesn't exist
if [ ! -f "frontend/.env" ]; then
    info "Creating frontend/.env file..."
    echo "VITE_API_URL=http://localhost:${BACKEND_PORT}" > frontend/.env
    success "Created frontend/.env"
fi

# Create backend .env if it doesn't exist
if [ ! -f "backend/.env" ]; then
    info "Creating backend/.env file..."
    cat > backend/.env << EOF
DATABASE_URL=${DATABASE_URL}
PORT=${BACKEND_PORT}
NODE_ENV=development
EOF
    success "Created backend/.env"
fi

# Start backend
info "Starting backend on port $BACKEND_PORT..."
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    error "Backend failed to start. Check backend.log for details."
    cat backend.log
    exit 1
fi

# Start frontend
info "Starting frontend on port $FRONTEND_PORT..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 2

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    error "Frontend failed to start. Check frontend.log for details."
    cat frontend.log
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Success message
echo ""
success "=========================================="
success "Open TMS is running!"
success "=========================================="
echo ""
info "Backend API:  http://localhost:${BACKEND_PORT}"
info "API Docs:     http://localhost:${BACKEND_PORT}/docs"
info "Frontend:     http://localhost:${FRONTEND_PORT}"
info "Database:    postgresql://${DB_USER}:***@localhost:${DB_PORT}/${DB_NAME}"
echo ""
info "Logs:"
info "  Backend:  tail -f backend.log"
info "  Frontend: tail -f frontend.log"
echo ""
warning "Press Ctrl+C to stop all services"
echo ""

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID

