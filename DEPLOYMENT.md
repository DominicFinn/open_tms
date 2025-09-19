# Open TMS - GCP Deployment Guide

This guide will help you deploy the Open TMS application to Google Cloud Platform using Cloud Run and Cloud SQL.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Docker** installed locally
4. **Git** repository access

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Cloud SQL     │
│   (Cloud Run)   │◄──►│   (Cloud Run)   │◄──►│   (PostgreSQL)  │
│   Port 80       │    │   Port 3001     │    │   Port 5432     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Step 1: Initial Setup

### 1.1 Create a GCP Project

```bash
# Create a new project
gcloud projects create your-project-id --name="Open TMS"

# Set the project
gcloud config set project your-project-id

# Enable billing (required for Cloud Run and Cloud SQL)
# Go to: https://console.cloud.google.com/billing
```

### 1.2 Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable container.googleapis.com
```

## Step 2: Database Setup

### 2.1 Create Cloud SQL Instance

```bash
# Run the database setup script
./setup-database.sh your-project-id us-central1 open-tms-db
```

Or manually:

```bash
gcloud sql instances create open-tms-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase
```

### 2.2 Create Database and User

```bash
# Create database
gcloud sql databases create tms --instance=open-tms-db

# Create user
gcloud sql users create tms_user --instance=open-tms-db --password=YOUR_SECURE_PASSWORD
```

## Step 3: Deploy Application

### 3.1 Quick Deployment

```bash
# Make scripts executable
chmod +x deploy.sh setup-database.sh

# Deploy everything
./deploy.sh your-project-id us-central1
```

### 3.2 Manual Deployment

#### Deploy Backend

```bash
cd backend

# Build and push image
gcloud builds submit --tag gcr.io/your-project-id/open-tms-backend:latest .

# Deploy to Cloud Run
gcloud run deploy open-tms-backend \
  --image gcr.io/your-project-id/open-tms-backend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3001 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production,PORT=3001
```

#### Deploy Frontend

```bash
cd frontend

# Build and push image
gcloud builds submit --tag gcr.io/your-project-id/open-tms-frontend:latest .

# Deploy to Cloud Run
gcloud run deploy open-tms-frontend \
  --image gcr.io/your-project-id/open-tms-frontend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 80 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars VITE_API_URL=https://open-tms-backend-XXXXX-uc.a.run.app
```

## Step 4: Configure CI/CD (Optional)

### 4.1 Set up GitHub Secrets

In your GitHub repository, go to Settings > Secrets and variables > Actions, and add:

- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_SA_KEY`: Service account key (JSON)

### 4.2 Create Service Account

```bash
# Create service account
gcloud iam service-accounts create open-tms-deploy \
  --display-name="Open TMS Deploy Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:open-tms-deploy@your-project-id.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:open-tms-deploy@your-project-id.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:open-tms-deploy@your-project-id.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and download key
gcloud iam service-accounts keys create key.json \
  --iam-account=open-tms-deploy@your-project-id.iam.gserviceaccount.com
```

## Step 5: Environment Configuration

### 5.1 Backend Environment Variables

Set these in Cloud Run:

```bash
DATABASE_URL=postgresql://tms_user:password@/tms?host=/cloudsql/your-project-id:us-central1:open-tms-db
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://open-tms-frontend-XXXXX-uc.a.run.app
```

### 5.2 Frontend Environment Variables

Set these in Cloud Run:

```bash
VITE_API_URL=https://open-tms-backend-XXXXX-uc.a.run.app
```

## Step 6: Database Migration

### 6.1 Run Prisma Migrations

```bash
# Connect to Cloud SQL and run migrations
gcloud sql connect open-tms-db --user=tms_user --database=tms

# Or use Cloud SQL Proxy
cloud_sql_proxy -instances=your-project-id:us-central1:open-tms-db=tcp:5432

# Then run migrations locally
cd backend
npx prisma migrate deploy
```

## Step 7: Monitoring and Logging

### 7.1 View Logs

```bash
# Backend logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=open-tms-backend"

# Frontend logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=open-tms-frontend"
```

### 7.2 Monitor Performance

- Go to [Cloud Console > Cloud Run](https://console.cloud.google.com/run)
- Monitor metrics, logs, and performance
- Set up alerts for errors and high latency

## Step 8: Custom Domain (Optional)

### 8.1 Map Custom Domain

```bash
# Map domain to Cloud Run service
gcloud run domain-mappings create \
  --service=open-tms-frontend \
  --domain=your-domain.com \
  --region=us-central1
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check Cloud SQL instance is running
   - Verify connection string format
   - Ensure Cloud SQL Admin API is enabled

2. **CORS Issues**
   - Update CORS_ORIGIN environment variable
   - Check frontend URL matches exactly

3. **Build Failures**
   - Check Dockerfile syntax
   - Verify all dependencies are included
   - Check build logs in Cloud Build

4. **Service Won't Start**
   - Check environment variables
   - Verify port configuration
   - Check health check endpoints

### Useful Commands

```bash
# Check service status
gcloud run services list

# View service details
gcloud run services describe open-tms-backend --region=us-central1

# Update service
gcloud run services update open-tms-backend --region=us-central1

# Delete service
gcloud run services delete open-tms-backend --region=us-central1
```

## Cost Optimization

1. **Use appropriate instance sizes** (db-f1-micro for development)
2. **Set max instances** to prevent runaway costs
3. **Enable auto-scaling** to handle traffic spikes
4. **Monitor usage** in Cloud Console
5. **Use Cloud SQL Proxy** for local development

## Security Best Practices

1. **Use Cloud SQL Auth Proxy** for database connections
2. **Enable VPC** for private networking
3. **Use IAM** for fine-grained access control
4. **Enable audit logging**
5. **Regular security updates**

## Support

For issues and questions:
- Check [Cloud Run documentation](https://cloud.google.com/run/docs)
- Review [Cloud SQL documentation](https://cloud.google.com/sql/docs)
- Open an issue in this repository
