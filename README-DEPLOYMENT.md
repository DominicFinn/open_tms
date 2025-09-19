# 🚀 Open TMS - GCP Deployment

Complete deployment setup for Open TMS on Google Cloud Platform using Cloud Run and Cloud SQL.

## 📋 Quick Start

### Option 1: Automated Deployment (Recommended)

```bash
# 1. Set up your GCP project
gcloud config set project your-project-id

# 2. Run the database setup
./setup-database.sh your-project-id us-central1

# 3. Deploy the application
./deploy.sh your-project-id us-central1
```

### Option 2: Terraform (Infrastructure as Code)

```bash
# 1. Navigate to terraform directory
cd terraform

# 2. Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 3. Initialize and apply
terraform init
terraform plan
terraform apply
```

### Option 3: Manual Step-by-Step

Follow the detailed [DEPLOYMENT.md](./DEPLOYMENT.md) guide.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Cloud SQL     │
│   (Cloud Run)   │◄──►│   (Cloud Run)   │◄──►│   (PostgreSQL)  │
│   Port 80       │    │   Port 3001     │    │   Port 5432     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Files Overview

### Deployment Scripts
- `deploy.sh` - Main deployment script
- `setup-database.sh` - Database setup script

### Cloud Run Configurations
- `cloud-run-backend.yaml` - Backend service configuration
- `cloud-run-frontend.yaml` - Frontend service configuration

### CI/CD
- `.github/workflows/deploy.yml` - GitHub Actions workflow

### Infrastructure as Code
- `terraform/main.tf` - Main Terraform configuration
- `terraform/variables.tf` - Terraform variables
- `terraform/terraform.tfvars.example` - Variables template

### Configuration
- `production.env.template` - Production environment template

## 🔧 Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Docker** installed locally
4. **Terraform** (optional, for IaC approach)

## 🚀 Deployment Methods

### Method 1: Quick Deploy (5 minutes)

```bash
# Clone and deploy
git clone <your-repo>
cd open_tms
./deploy.sh your-project-id us-central1
```

### Method 2: Terraform (10 minutes)

```bash
# Set up infrastructure
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars
terraform init
terraform apply

# Deploy applications
cd ..
./deploy.sh your-project-id us-central1
```

### Method 3: Manual (15 minutes)

Follow the step-by-step guide in [DEPLOYMENT.md](./DEPLOYMENT.md).

## 🔐 Security

- **Database**: Cloud SQL with private IP
- **Authentication**: IAM-based access control
- **Network**: VPC connector for private communication
- **SSL**: Automatic HTTPS with Cloud Run

## 📊 Monitoring

- **Logs**: Cloud Logging integration
- **Metrics**: Cloud Monitoring
- **Traces**: Cloud Trace (if enabled)
- **Alerts**: Configurable alerting

## 💰 Cost Optimization

- **Auto-scaling**: Scales to zero when not in use
- **Resource limits**: Appropriate CPU/memory allocation
- **Database**: db-f1-micro for development
- **Monitoring**: Cost alerts and budgets

## 🔄 CI/CD Pipeline

The GitHub Actions workflow automatically:
1. **Tests** the application
2. **Builds** Docker images
3. **Pushes** to Google Container Registry
4. **Deploys** to Cloud Run
5. **Updates** environment variables

## 🛠️ Development

### Local Development

```bash
# Start local development
npm run dev
```

### Database Migrations

```bash
# Run migrations
cd backend
npx prisma migrate deploy
```

### Environment Variables

Copy `production.env.template` to `.env.production` and update values.

## 📚 Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed deployment guide
- [API Documentation](http://localhost:3001/docs) - Swagger/OpenAPI docs
- [Frontend](http://localhost:5174) - React application

## 🆘 Troubleshooting

### Common Issues

1. **Permission denied**: Check IAM roles
2. **Database connection**: Verify Cloud SQL instance
3. **Build failures**: Check Docker configuration
4. **CORS errors**: Update CORS_ORIGIN environment variable

### Useful Commands

```bash
# Check service status
gcloud run services list

# View logs
gcloud logging read "resource.type=cloud_run_revision"

# Update service
gcloud run services update open-tms-backend --region=us-central1
```

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: [Cloud Run Docs](https://cloud.google.com/run/docs)
- **Community**: [Discord/Slack channel]

## 🎯 Next Steps

1. **Custom Domain**: Set up your own domain
2. **SSL Certificate**: Enable HTTPS
3. **Monitoring**: Set up alerts and dashboards
4. **Backup**: Configure automated backups
5. **Scaling**: Optimize for production traffic

---

**Happy Deploying! 🚀**
