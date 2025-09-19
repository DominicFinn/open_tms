#!/bin/bash

# GCP Deployment Script for Open TMS
# Usage: ./deploy.sh [PROJECT_ID] [REGION]

set -e

PROJECT_ID=${1:-"your-project-id"}
REGION=${2:-"us-central1"}
SERVICE_NAME="open-tms"

echo "🚀 Deploying Open TMS to GCP..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Set the project
echo "📋 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable container.googleapis.com

# Build and push backend image
echo "🏗️ Building and pushing backend image..."
cd backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME-backend:latest .
cd ..

# Build and push frontend image
echo "🏗️ Building and pushing frontend image..."
cd frontend
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME-frontend:latest .
cd ..

# Deploy backend to Cloud Run
echo "🚀 Deploying backend to Cloud Run..."
gcloud run deploy $SERVICE_NAME-backend \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME-backend:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 3001 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production

# Get the backend URL
BACKEND_URL=$(gcloud run services describe $SERVICE_NAME-backend --platform managed --region $REGION --format 'value(status.url)')
echo "✅ Backend deployed at: $BACKEND_URL"

# Deploy frontend to Cloud Run
echo "🚀 Deploying frontend to Cloud Run..."
gcloud run deploy $SERVICE_NAME-frontend \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME-frontend:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 80 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars VITE_API_URL=$BACKEND_URL

# Get the frontend URL
FRONTEND_URL=$(gcloud run services describe $SERVICE_NAME-frontend --platform managed --region $REGION --format 'value(status.url)')
echo "✅ Frontend deployed at: $FRONTEND_URL"

echo ""
echo "🎉 Deployment complete!"
echo "Frontend: $FRONTEND_URL"
echo "Backend: $BACKEND_URL"
echo "API Docs: $BACKEND_URL/docs"
