# 📋 DevFlow Commands Cheat Sheet

Complete reference of all commands used in this project, categorized by workflow.

---

## ⚡ 1. Daily Development (Most Common)

```bash
# Start both Frontend (Vite) and Backend (Express) concurrently
npm run dev

# Open Prisma Studio in browser to view and edit MySQL tables visually
npm run prisma:studio

# Seed demo users, projects, and tasks to MySQL
npm run db:seed
```

---

## 🔄 2. Git Commands (Workflow & Team Sync)

### Fetch & Pull Updates
```bash
# Check current branch and modified files
git status

# Pull latest changes from the main branch (always do this before starting work)
git pull origin main

# Fetch all remote branches and references without merging
git fetch --all
```

### Branching & Working on Features
```bash
# Create and switch to a new feature branch
git checkout -b feature/your-feature-name

# Switch between existing branches
git checkout main
git checkout feature/your-feature-name

# See all local and remote branches
git branch -a
```

### Staging, Committing & Pushing
```bash
# View changes before committing
git diff

# Stage all modified and new files
git add .

# Stage a specific file
git add path/to/file

# Commit staged changes with a clear message
git commit -m "feat: add user profile editing"

# Push your feature branch to GitHub/remote repository (first time)
git push -u origin feature/your-feature-name

# Push subsequent commits on current branch
git push

# Push directly to main (if working solo on main)
git push origin main
```

### Undoing & Stashing Changes
```bash
# Temporarily stash uncommitted changes to switch branches
git stash

# Restore stashed changes
git stash pop

# Discard changes in a specific file
git checkout -- path/to/file

# Discard all uncommitted changes (careful!)
git reset --hard HEAD
```

---

## 📦 3. Dependencies & Installation

```bash
# Install all dependencies across client and server (from root)
npm install

# Install a package inside server only
npm install <package-name> --workspace=server

# Install a devDependency inside server only
npm install -D <package-name> --workspace=server

# Install a package inside client only
npm install <package-name> --workspace=client

# Install a devDependency inside client only
npm install -D <package-name> --workspace=client
```

---

## 💻 4. Running & Development

```bash
# Run both Frontend & Backend concurrently (Root)
npm run dev

# Run Backend only (Express + TS hot-reload on port 5000)
npm run dev:server

# Run Frontend only (Vite React on port 5173)
npm run dev:client
```

---

## 🗄️ 5. Database & Prisma (MySQL / XAMPP)

```bash
# Synchronize schema.prisma directly to MySQL without creating a migration file
npm --workspace=server run prisma:push

# Create a new migration file and apply it (used when evolving schema in production)
npm run prisma:migrate

# Regenerate Prisma Client TypeScript types after editing schema.prisma
npm run prisma:generate

# Launch Prisma Studio (interactive web GUI at http://localhost:5555)
npm run prisma:studio

# Run database seeder (populates sample users, projects, and tasks)
npm run db:seed
```

---

## 🔨 6. Production Build & Verification

```bash
# Compile and build both backend (tsc) and frontend (vite build)
npm run build

# Build backend only
npm run build:server

# Build frontend only
npm run build:client

# Start production server (after npm run build)
npm --workspace=server run start
```

---

## 🩺 7. XAMPP & MySQL Diagnostics (Windows PowerShell)

```powershell
# Test if MySQL port 3306 is open and listening
Test-NetConnection -ComputerName localhost -Port 3306

# Test if Express backend is running and connected to MySQL
Invoke-RestMethod -Uri http://localhost:5000/api/health | ConvertTo-Json -Depth 3

# Fetch all projects from API via terminal
Invoke-RestMethod -Uri http://localhost:5000/api/projects | ConvertTo-Json -Depth 3
```

---

## 🚀 8. Cloud Deployment (Vercel + Render)

```bash
# 1. Frontend: Deploy to Vercel via CLI
cd client
vercel              # Preview deployment
vercel --prod       # Production deployment

# 2. Database: Push Prisma schema to remote cloud MySQL (TiDB / Aiven)
cd server
npx prisma db push
npm run db:seed     # Optional: seed demo data

# 3. Backend: Deployed via Render Blueprint
# Render reads render.yaml automatically on Git push!
```

---

## 🗺️ Project URL Quick Reference

| Service | URL | Notes |
|---|---|---|
| **Frontend Web App** | [http://localhost:5173](http://localhost:5173) | Vite dev server |
| **Backend REST API** | [http://localhost:5000](http://localhost:5000) | Express Node.js server |
| **API Health Check** | [http://localhost:5000/api/health](http://localhost:5000/api/health) | Real-time MySQL latency ping |
| **Prisma Studio GUI** | [http://localhost:5555](http://localhost:5555) | Web database browser |
| **phpMyAdmin** (XAMPP)| [http://localhost/phpmyadmin](http://localhost/phpmyadmin) | XAMPP MySQL admin panel |
