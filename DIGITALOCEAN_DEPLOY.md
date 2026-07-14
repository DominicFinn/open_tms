# DigitalOcean One-Click Deployment

Deploy Open TMS to DigitalOcean App Platform with a single click!

## Quick Deploy

Click the button below to deploy Open TMS to DigitalOcean:

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/Jrez2010/open_tms-digitalcloud/tree/fix/digitalocean-template)

## What Gets Deployed

- **Backend**: Fastify API server (Node.js)
- **Frontend**: React web application
- **Database**: PostgreSQL 16 (managed database)

## Deployment Steps

1. Click the deploy button above
2. Sign in to your DigitalOcean account (or create one)
3. Review the app configuration
4. Click **Create Resources** to deploy

## After Deployment

Once deployed, your app will be available at the auto-generated URL.

### Initial Setup

Visit the backend health check endpoint to verify deployment:
- **Health Check**: `https://<your-app>.ondigitalocean.app/health`

### Create Admin User

Execute a POST request to set up your initial admin user:
```bash
curl -X POST https://<your-app>.ondigitalocean.app/api/v1/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secure_password_here"
  }'
```

### Seed Demo Data (Optional)

To populate demo data:
```bash
curl -X POST https://<your-app>.ondigitalocean.app/api/v1/seed
```

## Environment Variables

The following environment variables are configured:

- **DATABASE_URL**: Connection string to PostgreSQL (auto-configured)
- **JWT_SECRET**: Auto-generated secret for JWT signing
- **NODE_ENV**: Set to `production`
- **PORT**: Backend runs on port 3001
- **VITE_API_URL**: Frontend API endpoint (auto-configured)
- **CORS_ORIGIN**: Auto-configured to your app URL

## Instance Configuration

- **Backend Service**: basic-xxs (0.25 vCPU, 256MB RAM)
- **Frontend Service**: basic-xxs (0.25 vCPU, 256MB RAM)
- **Database**: PostgreSQL 16, db-s-dev-database (1 node)
- **Region**: New York (nyc) - *can be changed during deployment*

## Pricing

DigitalOcean App Platform pricing includes:
- **Compute**: $0.0197 per vCPU-hour (basic-xxs = 0.25 vCPU)
- **Database**: Starting at $15/month for db-s-dev-database
- **Total Estimated Cost**: ~$15-20/month for this deployment

## Features Included

✅ Automatic SSL/TLS certificates
✅ CDN integration available
✅ Auto-scaling capable
✅ GitHub integration for CI/CD
✅ Environment variable management
✅ Automatic database backups
✅ Built-in monitoring and logs

## Troubleshooting

### "No template found" error
- ✓ FIXED: `app.yaml` is now in the repository root
- Ensure you're using the correct deploy button link
- Clear browser cache and try again

### Build Failures
- Check the build logs in DigitalOcean console
- Ensure both `backend/Dockerfile` and `frontend/Dockerfile` exist
- Verify environment variables are set correctly

### Database Connection Issues
- The `DATABASE_URL` is automatically set by DigitalOcean
- Check that the PostgreSQL database is running
- Verify network policies allow app-to-database communication

### Application Logs
- Access logs from the DigitalOcean dashboard
- Check `/health` endpoint for backend status
- Monitor resource usage for scaling needs

## Next Steps

After successful deployment:

1. **Access the API Documentation**: Visit `/docs` for Swagger/OpenAPI documentation
2. **Configure Backups**: Set up database backup schedules in DigitalOcean
3. **Set Up Monitoring**: Enable alerts for resource usage
4. **Scale Resources**: Upgrade instance types if needed
5. **Configure Custom Domain**: Add your own domain in App settings

## Support

For deployment issues:
- Check [DigitalOcean App Platform documentation](https://docs.digitalocean.com/products/app-platform/)
- Review app logs in the DigitalOcean console
- Visit the [Open TMS repository](https://github.com/DominicFinn/open_tms) for additional support
- Check deployment status in the DigitalOcean dashboard

## Updates

To update your deployment:
1. Push changes to the `fix/digitalocean-template` branch
2. DigitalOcean will automatically rebuild and redeploy
3. Monitor the deployment status in the dashboard

---

**Happy Deploying! 🚀**
