# Premium Online Poker Platform

A modern, high-performance online poker platform featuring a Real-Time Backend in Rust and a Premium, Responsive Frontend in Next.js (App Router).

## 🚀 Architecture
- **Backend**: Rust (Axum, Tokio, SQLx, PostgreSQL)
- **Frontend**: Next.js 15, TypeScript, TailwindCSS, Framer Motion
- **Communication**: WebSockets for real-time game state synchronization.

---

## 🛠 Prerequisites

Ensure you have the following installed on your machine:

1.  **Rust & Cargo**: [Install Rust](https://rustup.rs/) (v1.75+)
2.  **Node.js & npm**: [Install Node](https://nodejs.org/) (v20+)
3.  **Docker**: For running PostgreSQL database.
4.  **PostgreSQL (Optional)**: If you're not using Docker.

---

## 🏗 Setup Instructions

### 1. Database Setup (Docker)
Run a local PostgreSQL instance using Docker:
```bash
docker run --name poker-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

### 2. Backend Setup
Navigate to the backend directory and set up environment variables.
```bash
cd backend
# Create/Update .env file
echo "DATABASE_URL=postgres://postgres:postgres@localhost:5432/poker" > .env
echo "JWT_SECRET=your-secure-secret-key" >> .env
echo "PORT=8080" >> .env

# Run migrations to setup database schema
./scripts/migrate.sh
```

### 3. Frontend Setup
Navigate to the frontend directory and install dependencies.
```bash
cd frontend
npm install

# Setup environment variables
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws" >> .env.local
```

---

## 🏃 Running the Application

### Start the Backend
```bash
cd backend
cargo run --bin poker-backend
```

### Start the Frontend
```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000` to play!

---

## 📦 Packaging for Download
If you need to move the project to another computer, you should zip only the source code to avoid large artifact files (`node_modules`, `target`, `.next` folders).

From the root project directory:
```bash
zip -r poker-project.zip . -x "**/node_modules/*" "**/target/*" "**/.next/*" "**/build/*"
```

## ✨ Key Features
- **Real-time Synchronization**: WebSockets ensure all players see the same state instantly.
- **Join-Request System**: Private and Public tables with admin/creator approval.
- **Advanced UI**: PokerNow-inspired aesthetic with high-quality card graphics and animations.
- **Fairness**: Server-seed/user-seed verification mechanism.
- **Responsive**: Fully playable on desktop, tablet, and mobile browsers.
