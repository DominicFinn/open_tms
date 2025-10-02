# 🚛 Open TMS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-202020?logo=fastify&logoColor=white)](https://www.fastify.io/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?logo=prisma&logoColor=white)](https://www.prisma.io/)

A simple, open-source Transport Management System built with TypeScript, featuring a Fastify backend, React frontend, and comprehensive CRUD operations. Perfect for managing shipments, customers, and locations with a beautiful Material Design 3 interface.

## 🚨 Help needed please
Under development at the moment. I have really made this as a demo to show off our data platform capabilities at System Loco, we develop IoT devices and the supporting data and intelligence platform. We integrate with real time visibility platforms and TMS systems to provide a complete end to end solution.

Please feel free to contribute to the project, ideally with feature requests, bug reports, or documentation improvements.

I'm outlining a roadmap. It's high level. It can be ticketed up as it goes along as issues [Roadmap](./roadmap.md)

> **🌟 Live Demo**: [Try it now!](https://open-tms-frontend-iutj2b4iaa-uc.a.run.app) | **📖 API Docs**: [View API](https://open-tms-backend-iutj2b4iaa-uc.a.run.app/docs)
>
> *Note: The demo URLs above are for the project maintainer's deployment. Deploy your own instance using the [Quick Demo Guide](./HOSTING-DEMO-GCP.md).*

## ✨ Features

### 🎯 Core Functionality
- **Customer Management** - Create, edit, and manage customer information
- **Location Management** - Handle warehouses, distribution centers, and retail locations
- **Shipment Tracking** - Complete shipment lifecycle management with status tracking
- **Real-time Updates** - Live data synchronization across the application
- **Interactive Maps** - OpenStreetMap integration for shipment visualization

### 🎨 Modern UI/UX
- **Material Design 3** - Beautiful, consistent design system
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **Dark/Light Themes** - Automatic theme switching based on system preferences
- **Loading States** - Smooth user experience with proper feedback
- **Error Handling** - Graceful error management and user notifications

### 🔧 Technical Excellence
- **TypeScript** - Full type safety across frontend and backend
- **RESTful API** - Well-documented API with Swagger/OpenAPI
- **Database Migrations** - Prisma-powered database management
- **Repository Pattern** - Clean data access layer with interface-based design
- **Dependency Injection** - Testable, loosely-coupled architecture
- **DTO Pattern** - Type-safe data transfer with validation
- **Soft Delete** - Data preservation with archive functionality
- **Validation** - Comprehensive input validation and error handling

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   React + Vite  │◄──►│   Fastify API   │◄──►│   PostgreSQL    │
│   TypeScript    │    │   TypeScript    │    │   Prisma ORM    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Backend Architecture

The backend follows a clean, layered architecture with:

- **Routes Layer** - HTTP endpoints and request/response handling
- **Repository Layer** - Data access abstraction using the Repository Pattern
- **Dependency Injection** - Custom DI container for loose coupling and testability
- **Type Safety** - TypeScript interfaces (DTOs) for all data structures

```
Routes (HTTP)
    ↓ (uses interfaces)
Repositories (Data Access)
    ↓ (uses Prisma)
Database (PostgreSQL)
```

**Key Patterns:**
- **Repository Pattern** - All database operations abstracted into repository classes
- **Dependency Injection** - Interface-based DI container for testability
- **DTO Pattern** - Type-safe data transfer objects for API contracts
- **Interface Segregation** - Each repository has a corresponding interface

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### Local Development

1. **Clone and install dependencies:**
```bash
git clone https://github.com/DominicFinn/open_tms.git
cd open_tms
npm install
```

2. **Start the database:**
```bash
docker compose up -d db
```

3. **Start development servers:**
```bash
npm run dev
```

4. **Access the application:**
- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/docs

### First Time Setup

1. **Seed the database with sample data:**
```bash
curl -X POST http://localhost:3001/api/v1/seed
```

2. **Explore the features:**
- Navigate through Customers, Locations, and Shipments
- Create, edit, and delete records
- View shipment details with interactive maps

### 🛡️ Rate Limiting

The demo deployment includes built-in rate limiting to protect against abuse:

- **50 requests per minute** per IP address
- **Automatic reset** every 60 seconds
- **429 status code** when limit exceeded
- **Clear error messages** with retry information

IMPORTANT: If you are using the demo, please do not abuse the rate limit. If you need to make more requests, please contact me.

Rate limiting is implemented in the demo backend (`backend/src/index-demo.ts`) and configured via the Docker container. See the [Dockerfile](./backend/Dockerfile) and [TypeScript configuration](./backend/tsconfig.json) for implementation details.

## 🌐 Deployment Options

### 🎪 Demo Deployment (5 minutes)
Perfect for showcasing the system to stakeholders:

**[📖 Hosting a Demo on GCP →](./HOSTING-DEMO-GCP.md)**

### 🏭 Production Deployment
Complete production setup with monitoring and security:

**[📖 Production Deployment Guide →](./DEPLOYMENT.md)**

### 🐳 Docker Deployment
Simple containerized deployment:

```bash
# Build and run with Docker Compose
docker compose up --build -d

# Or build individual services
docker build -t open-tms-backend ./backend
docker build -t open-tms-frontend ./frontend
```

## 📚 API Documentation

### Endpoints Overview

#### Customers
- `GET /api/v1/customers` - List all customers
- `POST /api/v1/customers` - Create new customer
- `GET /api/v1/customers/:id` - Get customer details
- `PUT /api/v1/customers/:id` - Update customer
- `DELETE /api/v1/customers/:id` - Archive customer

#### Locations
- `GET /api/v1/locations` - List all locations
- `POST /api/v1/locations` - Create new location
- `GET /api/v1/locations/:id` - Get location details
- `PUT /api/v1/locations/:id` - Update location
- `DELETE /api/v1/locations/:id` - Archive location

#### Shipments
- `GET /api/v1/shipments` - List all shipments
- `POST /api/v1/shipments` - Create new shipment
- `GET /api/v1/shipments/:id` - Get shipment details
- `PUT /api/v1/shipments/:id` - Update shipment
- `DELETE /api/v1/shipments/:id` - Archive shipment

### Interactive API Documentation
Visit http://localhost:3001/docs for the complete Swagger/OpenAPI documentation.

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Leaflet** - Interactive maps
- **Material Icons** - Icon system

### Backend
- **Fastify** - Fast and efficient web framework
- **TypeScript** - Type-safe server development
- **Prisma** - Modern database ORM
- **PostgreSQL** - Robust relational database
- **Zod** - Schema validation
- **Swagger** - API documentation

### Architecture Patterns
- **Repository Pattern** - Data access abstraction layer
- **Dependency Injection** - Custom DI container for loose coupling
- **DTO Pattern** - Type-safe data transfer objects
- **Interface Segregation** - Interface-based repository contracts
- **Layered Architecture** - Clear separation of routes, repositories, and services

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Docker** - Containerization
- **GitHub Actions** - CI/CD pipeline

## 📁 Project Structure

```
open_tms/
├── backend/                 # Fastify API server
│   ├── src/
│   │   ├── index.ts        # Main server file
│   │   ├── routes/         # HTTP route handlers
│   │   ├── repositories/   # Data access layer (Repository Pattern)
│   │   ├── di/             # Dependency Injection container
│   │   │   ├── container.ts   # DI container implementation
│   │   │   ├── tokens.ts      # Dependency tokens
│   │   │   └── registry.ts    # Dependency registration
│   │   ├── services/       # Business logic services
│   │   └── plugins/        # Fastify plugins
│   ├── prisma/             # Database schema and migrations
│   └── Dockerfile          # Backend container
├── frontend/               # React application
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── layout.tsx      # App layout
│   │   └── theme.css       # Material Design styles
│   └── Dockerfile          # Frontend container
├── packages/
│   └── shared/             # Shared TypeScript types
├── terraform/              # Infrastructure as Code
├── .github/workflows/      # CI/CD pipelines
└── docs/                   # Documentation
```

### Backend Code Organization

The backend follows a modular architecture with clear separation of concerns:

#### **Routes** (`src/routes/`)
- HTTP endpoint definitions
- Request/response handling
- Validation using Zod schemas
- Depends on repository interfaces (not implementations)

#### **Repositories** (`src/repositories/`)
Each repository provides:
- **Interface** - Contract definition (e.g., `ICustomersRepository`)
- **DTOs** - Data Transfer Objects (e.g., `CreateCustomerDTO`, `UpdateCustomerDTO`)
- **Implementation** - Concrete class with Prisma database operations

Example:
```typescript
// Interface defines the contract
export interface ICustomersRepository {
  all(): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  create(data: CreateCustomerDTO): Promise<Customer>;
  // ...
}

// Implementation uses Prisma
export class CustomersRepository implements ICustomersRepository {
  constructor(private prisma: PrismaClient) {}
  // ... method implementations
}
```

#### **Dependency Injection** (`src/di/`)
- **Container** - Simple DI container for managing dependencies
- **Tokens** - Symbol-based identifiers for each dependency
- **Registry** - Central registration of all application dependencies

Usage in routes:
```typescript
const customersRepo = container.resolve<ICustomersRepository>(
  TOKENS.ICustomersRepository
);
```

This architecture enables:
- ✅ **Testability** - Easy to inject mock repositories
- ✅ **Loose Coupling** - Routes depend on interfaces, not concrete classes
- ✅ **Flexibility** - Swap implementations without changing routes
- ✅ **Type Safety** - Full TypeScript support with generics

#### Testing with Dependency Injection

The DI container makes testing straightforward:

```typescript
import { container, TOKENS } from '../di';
import { ICustomersRepository } from '../repositories/CustomersRepository';

// Create a mock repository
const mockCustomersRepo: ICustomersRepository = {
  all: jest.fn().mockResolvedValue([]),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  archive: jest.fn(),
};

// Replace the binding for testing
container.singleton(TOKENS.ICustomersRepository)
  .toFactory(() => mockCustomersRepo);

// Now your routes will use the mock!
```

## 🎯 Key Features in Detail

### Customer Management
- **Complete CRUD operations** with inline editing
- **Email validation** and contact management
- **Soft delete** with archive functionality
- **Real-time updates** across the interface

### Location Management
- **Comprehensive address handling** with coordinates
- **Geographic data support** for mapping
- **Warehouse and retail location** management
- **Address validation** and formatting

### Shipment Tracking
- **Full lifecycle management** from draft to delivery
- **Status tracking** with visual indicators
- **Interactive maps** showing shipment routes
- **Item management** with SKU tracking
- **Date management** for pickup and delivery

### Modern UI/UX
- **Material Design 3** implementation
- **Responsive grid layouts** that adapt to screen size
- **Floating labels** and smooth animations
- **Loading states** and error handling
- **Confirmation dialogs** for destructive actions

## 🔒 Security Features

- **Input validation** with Zod schemas
- **SQL injection protection** via Prisma ORM
- **CORS configuration** for secure cross-origin requests
- **Rate limiting** for demo protection (50 requests/minute per IP)
- **Environment variable** management
- **Soft delete** for data preservation

## 📊 Performance

- **Fastify** for high-performance API responses
- **Vite** for lightning-fast development and builds
- **Prisma** for optimized database queries
- **React** with efficient re-rendering
- **Docker** for consistent deployment environments

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, improving documentation, or helping with project management, your contributions make this project better for everyone.

### How to Contribute

1. **Fork the repository** and clone your fork
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and test them thoroughly
4. **Add tests** if you're adding new functionality
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to your branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request** with a clear description of your changes

### Ways to Contribute

- 🐛 **Bug Reports**: Found a bug? [Open an issue](https://github.com/DominicFinn/open_tms/issues) with detailed steps to reproduce
- ✨ **Feature Requests**: Have an idea? [Start a discussion](https://github.com/DominicFinn/open_tms/discussions) or open an issue
- 📝 **Documentation**: Help improve docs, add examples, or fix typos
- 🎨 **UI/UX**: Improve the design, add animations, or enhance user experience
- 🔧 **Backend**: Add new API endpoints, improve performance, or add features
- 🧪 **Testing**: Add unit tests, integration tests, or help improve test coverage
- 📊 **Project Management**: Help triage issues, review PRs, or organize milestones

### Development Guidelines

- Follow the existing code style and patterns
- Write clear, descriptive commit messages
- Update documentation for any new features
- Ensure all tests pass before submitting a PR
- Be respectful and constructive in discussions

### Getting Help

- 💬 **Discussions**: [GitHub Discussions](https://github.com/DominicFinn/open_tms/discussions) for questions and ideas
- 🐛 **Issues**: [GitHub Issues](https://github.com/DominicFinn/open_tms/issues) for bug reports and feature requests
- 📖 **Documentation**: Check the [deployment guide](./DEPLOYMENT.md) and [API docs](https://open-tms-backend-iutj2b4iaa-uc.a.run.app/docs)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the [deployment guide](./DEPLOYMENT.md)
- **Issues**: [GitHub Issues](https://github.com/DominicFinn/open_tms/issues)
- **Discussions**: [GitHub Discussions](https://github.com/DominicFinn/open_tms/discussions)

## 🎉 Acknowledgments

- **Material Design** for the beautiful design system
- **Fastify** team for the excellent web framework
- **Prisma** team for the amazing database ORM
- **React** team for the powerful UI library

---

**Ready to get started?** Check out the [Quick Start](#-quick-start) section or [deploy a demo](./HOSTING-DEMO-GCP.md) in 5 minutes! 🚀
