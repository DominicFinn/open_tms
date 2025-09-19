# 🌐 Hosting a Demo on GCP

This guide will help you quickly deploy the Open TMS application to Google Cloud Platform for demonstration purposes. Perfect for showcasing the system to stakeholders, clients, or for testing in a production-like environment.

## 🚀 Quick Demo Deployment (5 minutes)

### Prerequisites
- Google Cloud Account (free tier available)
- gcloud CLI installed
- Docker installed locally

### Step 1: Set Up GCP Project

```bash
# Create a new project (or use existing)
gcloud projects create your-demo-project-id --name="Open TMS Demo"

# Set the project
gcloud config set project your-demo-project-id

# Enable billing (required for Cloud Run)
# Go to: https://console.cloud.google.com/billing
```

### Step 2: One-Command Deployment

```bash
# Clone the repository
git clone https://github.com/DominicFinn/open_tms.git
cd open_tms

# Deploy everything with one command
./deploy.sh your-demo-project-id us-central1
```

That's it! Your demo will be live in about 5 minutes.

## 🎯 Demo URLs

After deployment, you'll get:
- **Frontend**: `https://open-tms-frontend-XXXXX-uc.a.run.app`
- **Backend API**: `https://open-tms-backend-XXXXX-uc.a.run.app`
- **API Documentation**: `https://open-tms-backend-XXXXX-uc.a.run.app/docs`

## 🎨 Demo Features to Showcase

### 1. **Customer Management**
- Create, edit, and delete customers
- Real-time updates
- Professional UI with Material Design

### 2. **Location Management**
- Add warehouses and distribution centers
- Full address management with coordinates
- Geographic data support

### 3. **Shipment Tracking**
- Create and manage shipments
- Status tracking (Draft → In Transit → Delivered)
- Interactive shipment details page with maps

### 4. **Modern UI/UX**
- Responsive design
- Dark/Light theme support
- Intuitive navigation
- Loading states and error handling

## 💰 Demo Cost Optimization

### Free Tier Usage
- **Cloud Run**: 2 million requests/month free
- **Cloud SQL**: db-f1-micro instance (minimal cost)
- **Storage**: 1GB free
- **Bandwidth**: 1GB free per month

### Estimated Monthly Cost
- **Development/Demo**: $5-15/month
- **Small Production**: $20-50/month
- **Medium Production**: $100-300/month

## 🔧 Demo Configuration

### Environment Variables
The demo automatically configures:
- **Database**: PostgreSQL with sample data
- **CORS**: Configured for frontend access
- **Logging**: Production-level logging
- **Security**: Basic security headers

### Sample Data
The demo includes:
- **10 Customers** (Walmart, Best Buy, Target, etc.)
- **42 Locations** (Warehouses, stores across US)
- **15 Sample Shipments** with various statuses
- **Real-world addresses** and coordinates

## 🎪 Demo Scenarios

### Scenario 1: Customer Onboarding
1. Navigate to Customers page
2. Add a new customer
3. Edit existing customer details
4. Show the real-time updates

### Scenario 2: Shipment Lifecycle
1. Go to Shipments page
2. Create a new shipment
3. Update status from Draft → In Transit → Delivered
4. View shipment details with map integration

### Scenario 3: Location Management
1. Visit Locations page
2. Add a new warehouse
3. Edit location details
4. Show address validation and coordinates

### Scenario 4: API Integration
1. Visit API documentation at `/docs`
2. Show RESTful endpoints
3. Demonstrate CRUD operations
4. Show real-time data updates

## 🛠️ Demo Customization

### Adding Your Own Data
```bash
# Connect to the demo database
gcloud sql connect open-tms-db --user=tms_user --database=tms

# Or use the API to add data
curl -X POST https://your-backend-url/api/v1/customers \
  -H "Content-Type: application/json" \
  -d '{"name": "Your Company", "contactEmail": "demo@yourcompany.com"}'
```

### Customizing the UI
1. Fork the repository
2. Modify the frontend components
3. Redeploy with `./deploy.sh`
4. Your changes will be live in minutes

## 🔒 Demo Security

### What's Included
- **HTTPS**: Automatic SSL certificates
- **CORS**: Properly configured
- **Database**: Private IP access only
- **IAM**: Service account permissions

### What to Add for Production
- **Authentication**: User login system
- **Authorization**: Role-based access
- **API Keys**: Rate limiting
- **Monitoring**: Security alerts

## 📊 Demo Monitoring

### Built-in Monitoring
- **Health Checks**: Automatic service monitoring
- **Logs**: Cloud Logging integration
- **Metrics**: Basic performance metrics
- **Alerts**: Service availability alerts

### Viewing Demo Metrics
1. Go to [Cloud Console](https://console.cloud.google.com)
2. Navigate to Cloud Run
3. Select your services
4. View logs, metrics, and performance data

## 🎯 Demo Best Practices

### Before the Demo
1. **Test the deployment** beforehand
2. **Prepare sample data** if needed
3. **Check all URLs** are working
4. **Have backup plans** ready

### During the Demo
1. **Start with the overview** (Dashboard)
2. **Show key features** in logical order
3. **Demonstrate real-time updates**
4. **Highlight the modern UI/UX**

### After the Demo
1. **Share the URLs** with stakeholders
2. **Provide access credentials** if needed
3. **Document any customizations**
4. **Plan next steps** based on feedback

## 🚨 Troubleshooting Demo Issues

### Common Issues

#### Service Won't Start
```bash
# Check service status
gcloud run services list

# View logs
gcloud logging read "resource.type=cloud_run_revision"
```

#### Database Connection Issues
```bash
# Check database status
gcloud sql instances list

# Test connection
gcloud sql connect open-tms-db --user=tms_user --database=tms
```

#### Frontend Not Loading
- Check CORS configuration
- Verify environment variables
- Check browser console for errors

### Quick Fixes
```bash
# Restart services
gcloud run services update open-tms-backend --region=us-central1
gcloud run services update open-tms-frontend --region=us-central1

# Check service health
curl https://your-backend-url/health
```

## 🎉 Demo Success Tips

### 1. **Prepare Your Story**
- Start with the problem the system solves
- Show the business value
- Highlight the modern technology stack

### 2. **Use Real Data**
- Import your actual customer data
- Use real shipment scenarios
- Show realistic business workflows

### 3. **Show Technical Excellence**
- Demonstrate the API documentation
- Show the responsive design
- Highlight the real-time updates

### 4. **Engage Your Audience**
- Ask for feedback during the demo
- Show how easy it is to customize
- Demonstrate the scalability

## 🔄 Demo Updates

### Updating the Demo
```bash
# Pull latest changes
git pull origin main

# Redeploy
./deploy.sh your-demo-project-id us-central1
```

### Adding New Features
1. Develop locally
2. Test thoroughly
3. Deploy to demo environment
4. Showcase to stakeholders

## 📞 Demo Support

### Getting Help
- **Documentation**: Check the main README
- **Issues**: Open a GitHub issue
- **Community**: Join our Discord/Slack

### Demo Feedback
We love feedback! Please share:
- What worked well
- What could be improved
- Feature requests
- Technical questions

---

## 🎯 Ready to Demo?

```bash
# Start your demo deployment now!
./deploy.sh your-demo-project-id us-central1
```

**Your demo will be live in 5 minutes! 🚀**

---

*Need help? Check out the [main README](../README.md) or [detailed deployment guide](./DEPLOYMENT.md).*
