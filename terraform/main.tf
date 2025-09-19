# Open TMS - GCP Infrastructure as Code
# This Terraform configuration creates all necessary GCP resources

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
}

# Variables
variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# Local values
locals {
  service_name = "open-tms"
  common_labels = {
    project     = local.service_name
    environment = var.environment
    managed_by  = "terraform"
  }
}

# Cloud SQL Instance
resource "google_sql_database_instance" "main" {
  name             = "${local.service_name}-db-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = "db-f1-micro"
    disk_type         = "PD_SSD"
    disk_size         = 10
    disk_autoresize   = true
    availability_type = "ZONAL"

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
    }

    maintenance_window {
      day          = 7
      hour         = 3
      update_track = "stable"
    }

    ip_configuration {
      ipv4_enabled = false
      require_ssl  = true
    }
  }

  deletion_protection = true

  labels = local.common_labels
}

# Cloud SQL Database
resource "google_sql_database" "main" {
  name     = "tms"
  instance = google_sql_database_instance.main.name
}

# Cloud SQL User
resource "google_sql_user" "main" {
  name     = "tms_user"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}

# Cloud Run Backend Service
resource "google_cloud_run_v2_service" "backend" {
  name     = "${local.service_name}-backend-${var.environment}"
  location = var.region

  template {
    containers {
      image = "gcr.io/${var.project_id}/${local.service_name}-backend:latest"
      ports {
        container_port = 3001
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "3001"
      }
      env {
        name = "DATABASE_URL"
        value = "postgresql://${google_sql_user.main.name}:${var.db_password}@/${google_sql_database.main.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 3001
        }
        initial_delay_seconds = 30
        period_seconds        = 10
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 3001
        }
        initial_delay_seconds = 5
        period_seconds        = 10
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }
  }

  labels = local.common_labels
}

# Cloud Run Frontend Service
resource "google_cloud_run_v2_service" "frontend" {
  name     = "${local.service_name}-frontend-${var.environment}"
  location = var.region

  template {
    containers {
      image = "gcr.io/${var.project_id}/${local.service_name}-frontend:latest"
      ports {
        container_port = 80
      }

      env {
        name  = "VITE_API_URL"
        value = google_cloud_run_v2_service.backend.uri
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  labels = local.common_labels
}

# IAM policy for Cloud Run services
resource "google_cloud_run_service_iam_policy" "backend" {
  location = google_cloud_run_v2_service.backend.location
  service  = google_cloud_run_v2_service.backend.name

  policy_data = data.google_iam_policy.run_policy.policy_data
}

resource "google_cloud_run_service_iam_policy" "frontend" {
  location = google_cloud_run_v2_service.frontend.location
  service  = google_cloud_run_v2_service.frontend.name

  policy_data = data.google_iam_policy.run_policy.policy_data
}

# IAM policy data
data "google_iam_policy" "run_policy" {
  binding {
    role = "roles/run.invoker"
    members = [
      "allUsers",
    ]
  }
}

# VPC Access Connector for Cloud SQL
resource "google_vpc_access_connector" "main" {
  name          = "${local.service_name}-connector-${var.environment}"
  ip_cidr_range = "10.8.0.0/28"
  network       = "default"
  region        = var.region
}

# Outputs
output "backend_url" {
  description = "Backend service URL"
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "Frontend service URL"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "database_connection_name" {
  description = "Cloud SQL connection name"
  value       = google_sql_database_instance.main.connection_name
}

output "database_private_ip" {
  description = "Cloud SQL private IP"
  value       = google_sql_database_instance.main.private_ip_address
}
