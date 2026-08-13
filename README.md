<div align="center">

# ⚙️ Inventory Manager Demo API

A sanitized NestJS backend powering the public **Inventory Manager** demo.

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeORM](https://img.shields.io/badge/TypeORM-FE0803?logo=typeorm&logoColor=white)](https://typeorm.io/)
[![Firebase](https://img.shields.io/badge/Firebase_Auth-DD2C00?logo=firebase&logoColor=white)](https://firebase.google.com/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?logo=vercel)](https://vercel.com/)

### 🌐 [Live API](https://inventory-manager-demo-backend.vercel.app)

### 🖥️ [Open Frontend Demo](https://inv-manager-frontend-alpha.vercel.app)

</div>

---

## 📖 Overview

This repository contains the backend API used by the public **Inventory Manager** demonstration.

It provides REST endpoints for inventory operations including:

- Stock management
- Sales transactions
- Dealer returns
- Goods delivery notes
- Invoice data
- Transaction history
- Bin card reports
- Dashboard metrics

The repository contains only **sanitized application code and fictional demo data**.

It is completely isolated from any other deployment or database.

---

## 🧰 Tech Stack

| Area | Technology |
| --- | --- |
| Framework | NestJS |
| Language | TypeScript |
| ORM | TypeORM |
| Database | PostgreSQL |
| Authentication | Firebase Admin SDK |
| Validation | class-validator / Nest ValidationPipe |
| Logging | Winston |
| API Style | REST |
| Demo Hosting | Vercel Functions |

---

## 🔐 Authentication

The public demo frontend uses Firebase Anonymous Authentication.

After authentication, the frontend obtains a Firebase ID token and sends it with API requests:

```http
Authorization: Bearer <firebase-id-token>
```

The backend verifies the token using the Firebase Admin SDK before allowing access to protected routes.

Example flow:

```text
Guest
  │
  ▼
Firebase Anonymous Login
  │
  ▼
Firebase ID Token
  │
  ▼
Authorization: Bearer <token>
  │
  ▼
FirebaseAuthGuard
  │
  ▼
Protected Controller
```

The root health endpoint remains public for deployment monitoring.

---

## 🛡️ Demo Isolation

The API is intentionally separated from other environments.

The demo deployment uses its own:

- PostgreSQL database
- Firebase project
- Firebase service account
- Environment variables
- Vercel deployment
- Allowed CORS frontend origin
- Fictional seed data

No private or operational database is connected to this repository.

---

## 📁 Project Structure

```text
src/
├── auth/              # Firebase authentication
├── common/            # Filters, logging and shared utilities
├── migrations/        # Database schema + demo seed migrations
├── modules/           # Feature modules
├── app.controller.ts
├── app.module.ts
├── app.service.ts
└── main.ts
```

A typical feature module follows NestJS separation of concerns:

```text
feature/
├── dto/
├── entities/
├── feature.controller.ts
├── feature.service.ts
└── feature.module.ts
```

---

## 🗄️ Database

The API uses PostgreSQL through TypeORM.

Database configuration is supplied through environment variables:

```env
DATABASE_URL=postgresql://...
DB_SSL=true
DB_POOL_MAX=2
```

The public demo database contains only fictional records.

### Migrations

Schema changes are maintained using TypeORM migrations.

```text
src/migrations/
├── schema/
│   └── ...
└── demo/
    └── SeedDemoData.ts
```

Automatic migration execution is controlled using:

```env
RUN_MIGRATIONS=false
```

For deployed environments, migrations should be executed deliberately rather than on every serverless cold start.

---

## 🌱 Demo Data

Demo seed data is created specifically for this repository.

It may include fictional:

- Products
- Dealers
- Phone numbers
- Addresses
- Inventory quantities
- Sales
- Returns
- Delivery notes
- Transaction histories

Example domains such as `example.com` should be used for fictional email addresses.

The demo repository should never contain database dumps or imported operational datasets.

---

## ⚙️ Environment Variables

Create a local `.env` file.

```env
NODE_ENV=development
APP_ENV=demo

# Authentication
REQUIRE_AUTH=false
FIREBASE_SERVICE_ACCOUNT_BASE64=

# Database
DATABASE_URL=
DB_SSL=true
DB_POOL_MAX=2

# Database migrations
RUN_MIGRATIONS=false

# CORS
FRONTEND_URLS=http://localhost:5173
```

### Production demo deployment

```env
NODE_ENV=production
APP_ENV=demo

REQUIRE_AUTH=true

DATABASE_URL=<demo-postgresql-url>
DB_SSL=true
DB_POOL_MAX=2

RUN_MIGRATIONS=false

FIREBASE_SERVICE_ACCOUNT_BASE64=<base64-service-account>

FRONTEND_URLS=https://inv-manager-frontend-alpha.vercel.app
```

> Never commit `.env`, Firebase service-account JSON files, database passwords, private keys, or connection credentials.

---

## 🔒 CORS

The API accepts browser requests only from explicitly configured frontend origins.

```env
FRONTEND_URLS=https://inv-manager-frontend-alpha.vercel.app
```

Local development origins can be enabled when `NODE_ENV` is not `production`.

Firebase-authenticated requests use:

```http
Authorization: Bearer <token>
```

so the API is configured to support authenticated CORS preflight requests.

---

## 🚦 API Health Check

The root route is publicly accessible:

```http
GET /
```

Example:

```json
{
  "name": "Inventory Manager API",
  "status": "ok"
}
```

Live endpoint:

```text
https://inventory-manager-demo-backend.vercel.app/
```

---

## 🔌 API Areas

The API is organized around inventory workflows such as:

```text
/stock-overview
/products
/dealers
/sales
/returns
/gdn
/invoices
/reports
```

Individual endpoint naming may vary by feature module.

Protected routes require a valid Firebase ID token.

---

## 🛠️ Getting Started

### Prerequisites

- Node.js 22
- npm
- PostgreSQL
- Firebase project with Authentication enabled

### Clone the repository

```bash
git clone https://github.com/KaveeshaDharmaratne/<demo-backend-repository>.git
cd <demo-backend-repository>
```

Replace the placeholder with the public demo backend repository name.

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create:

```text
.env
```

using `.env.example` as the starting point.

### Run the API locally

```bash
npm run start:dev
```

The API will normally start at:

```text
http://localhost:3000
```

---

## 📜 Common Commands

| Command | Description |
| --- | --- |
| `npm run start:dev` | Start development mode |
| `npm run build` | Compile the NestJS application |
| `npm run start:prod` | Run the compiled application |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |

---

## 🧪 Testing

Run tests:

```bash
npm test
```

Build verification:

```bash
npm run build
```

Before deploying, verify:

```text
✓ Application builds successfully
✓ Demo database connection works
✓ Firebase token verification works
✓ Unauthorized API requests are rejected
✓ CORS accepts only configured origins
✓ No private data exists in seed files
```

---

## 🌐 Deployment

The demo backend is deployed independently to Vercel.

### Deployment flow

```text
GitHub
   │
   ▼
Vercel Build
   │
   ▼
NestJS Function
   │
   ├── Firebase Admin
   │
   └── PostgreSQL
```

Environment variables are configured directly in the Vercel project rather than committed to Git.

### Serverless considerations

The demo configuration uses:

```env
DB_POOL_MAX=2
RUN_MIGRATIONS=false
```

to avoid excessive database connections and migration execution during serverless application initialization.

File-based logging is disabled in the Vercel environment in favour of platform console logs.

---

## 🔗 Related Project

### Inventory Manager Frontend

[**Open the Frontend Repository**](https://github.com/KaveeshaDharmaratne/inv-manager-frontend)

[**Launch the Demo**](https://inv-manager-frontend-alpha.vercel.app)

---

## 🔏 Security Notes

This is a public demonstration API.

Even though all demo data is fictional, the application still follows several production-style security practices:

- Authenticated protected routes
- Firebase ID-token verification
- Environment-based secrets
- Restricted CORS origins
- Request DTO validation
- Separate database environment
- No committed credentials
- No operational datasets

---

## 👨‍💻 Author

Developed and maintained by [Kaveesha Dharmaratne](https://github.com/KaveeshaDharmaratne) & [Lahiru Wimalarathna](https://github.com/lahiruC22).

---

## 📄 License

This repository is publicly available for portfolio and demonstration purposes.

No open-source license is currently granted.

---

<div align="center">

**Backend API for the Inventory Manager public demo.**

[🖥️ Open Demo](https://inv-manager-frontend-alpha.vercel.app)
&nbsp;•&nbsp;
[🌐 API](https://inventory-manager-demo-backend.vercel.app)

</div>