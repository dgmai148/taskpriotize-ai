# TaskPrio AI — AI-Powered Task Prioritization Platform

A full-stack task management application with ML-powered priority scoring, SHAP explanations, dependency graphs, and role-based access control.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  ML Service   │     │  PostgreSQL  │
│  React 18    │     │  Express.js  │     │  Flask + SHAP │     │    16        │
│  Port 3000   │     │  Port 4000   │     │  Port 5050    │     │  Port 5432   │
└─────────────┘     └──────┬───────┘     └──────────────┘     └──────────────┘
                           │                                         ▲
                           └─────────────────────────────────────────┘
```

**Key Technologies:**
- **Frontend:** React 18, React Router, react-hot-toast
- **Backend:** Node.js, Express, JWT RS256 auth, bcrypt
- **ML Service:** Python, Flask, scikit-learn (GradientBoosting), SHAP
- **Database:** PostgreSQL 16 with UUID support
- **Infra:** Docker Compose (zero-config startup)

## Quick Start

### Docker (Recommended)

```bash
docker-compose up --build
```

Then open http://localhost:3000

### Local Development

```bash
# Terminal 1: Database
docker run -d --name taskprio-db \
  -e POSTGRES_USER=taskprio -e POSTGRES_PASSWORD=taskprio_secret -e POSTGRES_DB=taskprio \
  -p 5432:5432 -v $(pwd)/db/init.sql:/docker-entrypoint-initdb.d/01-init.sql \
  postgres:16-alpine

# Terminal 2: ML Service
cd ml-service
pip install -r requirements.txt
python app.py

# Terminal 3: Backend
cd backend
npm install
npm run dev

# Terminal 4: Frontend
cd frontend
npm install
npm start
```

## Demo Credentials

| Role      | Email              | Password  |
|-----------|--------------------|-----------|
| Admin     | admin@taskprio.com | admin123  |
| PM        | pm@taskprio.com    | pm123     |
| Developer | dev@taskprio.com   | dev123    |

The PM account can override AI priorities. All accounts can run AI prioritization and manage tasks.

## Features

- **JWT RS256 Authentication** with refresh token rotation and reuse detection
- **AI Task Prioritization** using GradientBoosting model with 7 features
- **SHAP Explanations** displayed as horizontal bar charts per task
- **Dependency Graph** visualization using SVG with layered layout
- **Priority Override** for PM/Admin with audit logging and notifications
- **Role-Based Access Control** (Admin, PM, Developer)
- **Auto-seeding** with 2 projects, 30 tasks, and 3 demo users

## API Endpoints

### Auth
| Method | Path                  | Description                    | Auth |
|--------|-----------------------|--------------------------------|------|
| POST   | /api/auth/register    | Register new user              | No   |
| POST   | /api/auth/login       | Login, get tokens              | No   |
| POST   | /api/auth/refresh     | Rotate refresh token           | No   |
| POST   | /api/auth/logout      | Revoke refresh token           | No   |
| GET    | /api/auth/me          | Current user info              | Yes  |
| GET    | /api/auth/public-key  | JWT public key (PEM)           | No   |

### Projects
| Method | Path                  | Description                    | Auth |
|--------|-----------------------|--------------------------------|------|
| GET    | /api/projects         | List all projects              | Yes  |
| POST   | /api/projects         | Create project                 | Yes  |
| GET    | /api/projects/:id     | Get project details            | Yes  |

### Tasks
| Method | Path                              | Description                    | Auth   |
|--------|-----------------------------------|--------------------------------|--------|
| GET    | /api/tasks?project_id=xxx         | List project tasks             | Yes    |
| POST   | /api/tasks                        | Create task                    | Yes    |
| PUT    | /api/tasks/:id                    | Update task                    | Yes    |
| DELETE | /api/tasks/:id                    | Delete task                    | Yes    |
| POST   | /api/tasks/:id/dependencies       | Add dependency                 | Yes    |
| GET    | /api/tasks/:projectId/dependency-graph | Get dependency graph      | Yes    |
| POST   | /api/tasks/override-priority      | Override AI priority           | PM/Admin |

### AI
| Method | Path                  | Description                    | Auth |
|--------|-----------------------|--------------------------------|------|
| POST   | /api/ai/prioritize    | Run AI scoring on project      | Yes  |

### ML Service (Internal)
| Method | Path      | Description                    |
|--------|-----------|--------------------------------|
| GET    | /health   | Health check                   |
| POST   | /predict  | Batch predict with SHAP        |

### Misc
| Method | Path                       | Description                    | Auth |
|--------|----------------------------|--------------------------------|------|
| GET    | /api/notifications         | User notifications             | Yes  |
| PUT    | /api/notifications/:id/read| Mark notification read         | Yes  |
| GET    | /api/audit-log             | Audit log entries              | Yes  |
| GET    | /api/users                 | List all users                 | Yes  |

## ML Model Details

The priority model uses a **GradientBoosting regressor** trained on synthetic data that captures realistic task prioritization patterns.

**Input features:**
1. Story Points (effort estimate)
2. Manual Priority (low=0.2, medium=0.5, high=0.8, critical=1.0)
3. Dependency Count (how many tasks this depends on)
4. Blocked Tasks Count (how many tasks are waiting on this one)
5. Days Until Due (urgency from deadline proximity)
6. Status Progress (how far along: 0=open, 1=done)
7. Task Age (days since creation)

**Output:** Priority score 0-100 with per-feature SHAP explanation.

## Security

- JWT RS256 (asymmetric) — private key signs, public key verifies
- RSA key pair auto-generated on first run (saved to `backend/keys/`)
- Refresh token rotation with family-based reuse detection
- Password hashing with bcrypt (10 rounds)
- Role-based endpoint protection
