#!/bin/bash

# Cloud SQL Database Setup Script for Open TMS
# Usage: ./setup-database.sh [PROJECT_ID] [REGION] [INSTANCE_NAME]

set -e

PROJECT_ID=${1:-"your-project-id"}
REGION=${2:-"us-central1"}
INSTANCE_NAME=${3:-"open-tms-db"}
DATABASE_NAME="tms"
DB_USER="tms_user"
DB_PASSWORD=$(openssl rand -base64 32)

echo "🗄️ Setting up Cloud SQL database..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Instance: $INSTANCE_NAME"

# Set the project
gcloud config set project $PROJECT_ID

# Create Cloud SQL instance
echo "🏗️ Creating Cloud SQL instance..."
gcloud sql instances create $INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=03 \
  --maintenance-release-channel=production \
  --deletion-protection

# Create database
echo "📊 Creating database..."
gcloud sql databases create $DATABASE_NAME --instance=$INSTANCE_NAME

# Create user
echo "👤 Creating database user..."
gcloud sql users create $DB_USER --instance=$INSTANCE_NAME --password=$DB_PASSWORD

# Get connection name
CONNECTION_NAME="$PROJECT_ID:$REGION:$INSTANCE_NAME"

echo ""
echo "✅ Database setup complete!"
echo "Connection Name: $CONNECTION_NAME"
echo "Database: $DATABASE_NAME"
echo "User: $DB_USER"
echo "Password: $DB_PASSWORD"
echo ""
echo "Update your DATABASE_URL to:"
echo "postgresql://$DB_USER:$DB_PASSWORD@/$DATABASE_NAME?host=/cloudsql/$CONNECTION_NAME"
echo ""
echo "⚠️  Save the password securely - it won't be shown again!"
