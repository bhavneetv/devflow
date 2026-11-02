# DevFlow — Fullstack React + TypeScript + Node.js + MySQL + Prisma

A production-ready fullstack monorepo featuring **React (Vite)** on the frontend, **Node.js (Express)** on the backend, **MySQL (XAMPP)** for relational persistence, and **Prisma ORM** for type-safe database queries and migrations.

---

## ⚡ Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite | Fast HMR dev server, custom responsive UI, Lucide icons |
| **Backend** | Node.js, Express, TypeScript | REST API with Zod schema validation, CORS, error handling |
| **ORM** | Prisma ORM | Automated schema migrations, type-safe client, visual Prisma Studio |
| **Database** | MySQL (XAMPP) | Runs out-of-the-box on `localhost:3306` with zero friction |
| **Architecture**| NPM Workspaces | Monorepo structure with shared scripts and coordinated builds |

---

## 📁 Project Structure

```text
devflow/
├── package.json               # Root workspaces configuration & concurrent dev scripts
├── COMMANDS.md               # Quick commands reference (Git, Prisma, Dev, Build)
├── .gitignore
├── README.md
│
├── client/                    # ⚛️ Frontend React Application
│   ├── index.html
│   ├── vite.config.ts         # Vite server with API proxy to localhost:5000
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── main.tsx           # React entry point
│       ├── App.tsx            # Fullstack dashboard with live status ping & tabs
│       ├── api.ts             # Typed REST API service layer
│       ├── types.ts           # Shared TypeScript interfaces
│       ├── index.css          # Modern dark-mode UI styling
│       └── components/
│           ├── Navbar.tsx     # Navigation & live MySQL status pill
│           ├── HealthBanner.tsx # System metrics & connection latency
│           ├── ProjectsView.tsx # Project CRUD with owner relations
│           ├── TasksView.tsx  # Task CRUD with priority & status workflow
│           ├── UsersView.tsx  # User management with role badges
│           └── PrismaTips.tsx # Architecture & Prisma command cheat-sheet
│
└── server/                    # 🟢 Backend Node.js & Prisma
    ├── package.json
    ├── tsconfig.json
    ├── .env                   # Environment variables (MySQL credentials)
    ├── .env.example
    ├── prisma/
    │   ├── schema.prisma      # Relational schema (Users, Projects, Tasks)
    │   └── seed.ts            # CLI database seeder
    └── src/
        ├── index.ts           # Express server setup with CORS & routes
        ├── lib/
        │   └── prisma.ts      # Singleton PrismaClient instance
        └── routes/
            ├── health.routes.ts # /api/health (ping MySQL via prisma.$queryRaw)
            ├── users.routes.ts  # /api/users (CRUD for users)
            ├── projects.routes.ts # /api/projects (CRUD for projects)
            ├── tasks.routes.ts  # /api/tasks (CRUD for tasks)
            └── seed.routes.ts   # /api/seed (trigger sample data from UI)
```

---

## 🚀 Quick Start Guide

### 1. Ensure XAMPP MySQL is Running
1. Open the **XAMPP Control Panel**.
2. Click **Start** next to **MySQL** (default port `3306`).

### 2. Install Dependencies
Run from the root directory:
```bash
npm install
```

### 3. Configure Database Connection
Check `server/.env`. By default, XAMPP uses user `root` with no password:
```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DATABASE_URL="mysql://root:@localhost:3306/devflow_db"
```
*(If your MySQL root user has a password in XAMPP, change `root:@` to `root:your_password@`)*.

### 4. Create MySQL Database & Run Migrations
Generate Prisma client and create the tables in your MySQL database:
```bash
# Push the schema and create tables in devflow_db
npm run prisma:migrate
```
*Prisma will automatically create the `devflow_db` database if it doesn't already exist!*

### 5. Seed Initial Demo Data (Optional)
Populate sample users, projects, and tasks:
```bash
npm run db:seed
```

### 6. Start Development Servers
Start both the React client and Node server concurrently with one command:
```bash
npm run dev
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000](http://localhost:5000)
- **API Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🛠️ Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Runs both React frontend (Vite) and Node backend (Express) concurrently |
| `npm run dev:client` | Starts only the Vite frontend dev server |
| `npm run dev:server` | Starts only the Express backend server with hot-reload via `tsx` |
| `npm run build` | Builds both server and client for production |
| `npm run prisma:generate` | Regenerates the TypeScript `@prisma/client` types |
| `npm run prisma:migrate` | Runs Prisma schema migrations against MySQL |
| `npm run prisma:studio` | Opens Prisma Studio (interactive web GUI for database tables) |
| `npm run db:seed` | Populates demo users, projects, and tasks into MySQL |

---

## 💎 Using Prisma Studio
To inspect and edit database records visually in your browser:
```bash
npm run prisma:studio
```
Prisma Studio opens at [http://localhost:5555](http://localhost:5555).

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server status and MySQL latency ping |
| `GET` | `/api/users` | List all team members with project/task counts |
| `POST` | `/api/users` | Create a new user (`name`, `email`, `role`) |
| `GET` | `/api/projects` | List all projects with owners & task stats |
| `POST` | `/api/projects` | Create a project (`title`, `description`, `ownerId`) |
| `PATCH`| `/api/projects/:id` | Update project status or details |
| `DELETE`| `/api/projects/:id` | Delete project (cascades to tasks) |
| `GET` | `/api/tasks` | List tasks (filter with `?projectId=` or `?status=`) |
| `POST` | `/api/tasks` | Create a task (`title`, `projectId`, `assigneeId`, etc.) |
| `PATCH`| `/api/tasks/:id` | Update task status or priority |
| `DELETE`| `/api/tasks/:id` | Delete task |
| `POST` | `/api/seed` | Seed initial demo data |
