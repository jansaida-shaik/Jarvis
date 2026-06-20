# JARVIS — Personal AI Operating System

JARVIS is a personal operating system that acts as a lifelong learning coach, career advisor, project manager, memory system, and personal assistant. It is a single-user application designed to remember everything important about you, track your learning progress, and help you manage personal and professional projects in a high-fidelity workspace.

## Technology Stack

* **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4
* **Backend**: Next.js API Routes, TypeScript
* **Database**: PostgreSQL & Prisma ORM
* **Authentication**: Custom JWT Session Cookies & Bcrypt Hashing
* **AI & Search**: OpenAI GPT models & pgvector (with text search fallback)

---

## Key Features

1. **Dashboard Console**: Daily dynamic greeting overview, stats cards (Goals, Skills, Study Hours, Active Projects), metrics gauges, and activity streams.
2. **AI Chat Terminal**: Streaming chatbot responses, searchable history, and local text/PDF attachments.
3. **Long-Term Memory OS**: Auto-extracts memory nodes from chats, organizes categories, and supports vector similarity search.
4. **Goals & Milestones**: Focus targets, checklist items, progress indicators, and automated milestone completion statistics.
5. **Learning roadmaps**: Skill inventories with proficiency states, study roadmaps, and session tracking.
6. **Project Kanban Boards**: Board columns (To Do, In Progress, Completed), task prioritizing, project spaces, and note files.
7. **Knowledge Base**: Text/markdown file uploads via FileReader and PDF metadata parsing.

---

## Local Setup & Quickstart

### Prerequisites
* **Node.js**: `v20` or higher
* **NPM**: `v10` or higher

### Setup Instructions

1. **Clone/Open Workspace**:
   Open the directory inside your IDE:
   `/Users/jansaidashaik/Jarvis`

2. **Configure Environment Variables**:
   Open `.env` and fill in your connection details:
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="jarvis-super-secret-key-9988"
   OPENAI_API_KEY="your-openai-api-key"
   ```
   *Note: If no `OPENAI_API_KEY` is provided, the chat console runs a mock response engine that simulates replies and continues auto-saving memory logs for offline evaluation.*

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Synchronize Schema & Compile Client**:
   This maps the prisma schemas to the database and builds the client bindings:
   ```bash
   npx prisma db push
   ```

5. **Load Seed Data**:
   This pre-seeds user profile `jansaida1234@gmail.com` (password: `password123`) and inputs mock goals, roadmaps, and tasks to populate the metrics dashboard immediately:
   ```bash
   node prisma/seed.js
   ```

6. **Start Dev Server**:
   ```bash
   npm run dev
   ```

7. **Log In**:
   Visit `http://localhost:3000` and sign in using:
   * **Email**: `jansaida1234@gmail.com`
   * **Password**: `password123`
