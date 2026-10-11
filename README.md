# TaskYard

**A full-stack task manager with authentication, a drag-and-drop Kanban board, priorities, deadlines, categories and a progress dashboard.**

Built with React, Node.js, Express and PostgreSQL.

**Live demo:** [taskyard-fronten.onrender.com](https://taskyard-fronten.onrender.com)

> ⏳ **Note:** the backend runs on Render's free tier, so it sleeps when idle. The first request can take **30-60 seconds** to wake it up. After that it responds normally.

## Features

**Authentication:** register and log in with JWT; passwords are hashed with bcrypt; each user sees only their own tasks
**Kanban board:** drag tasks between To do, In progress and Done (also works with touch, keyboard and a "Move to" menu)
**Task management:** create, edit, complete and delete tasks
**Priorities and categories:** low, medium or high priority; Personal, College, Work or Project
**Due dates:** upcoming (next 3 days) and overdue views
**Search, filter and sort** by status, category, priority or due date
**Dashboard:** totals, in-progress and overdue counts, and a completion ring
**Light and dark mode**, saved between visits
**Responsive layout** for desktop and mobile
**Validation and error handling** on both frontend and backend

## Tech Stack

| Layer      | Technologies                                   |
| ---------- | ---------------------------------------------- |
| Frontend   | React, Vite, dnd-kit, CSS                      |
| Backend    | Node.js, Express, JWT, bcrypt, CORS            |
| Database   | PostgreSQL (Neon)                              |
| Deployment | Render (frontend and backend), Neon (database) |

## Project Structure

TaskYard/
├── backend/
│ ├── routes/
│ │ ├── auth.js
│ │ └── tasks.js
│ ├── middleware/
│ │ └── authMiddleware.js
│ ├── migrations/
│ │ └── 001_add_task_status.sql
│ ├── app.js
│ ├── db.js
│ └── .env.example
│
├── frontend/
│ ├── public/favicon.svg
│ ├── src/
│ │ ├── components/
│ │ │ ├── Auth.jsx
│ │ │ ├── KanbanBoard.jsx
│ │ │ ├── TaskForm.jsx
│ │ │ ├── TaskItem.jsx
│ │ │ └── TaskList.jsx
│ │ ├── api.js
│ │ ├── taskStatus.js
│ │ ├── App.jsx
│ │ ├── App.css
│ │ └── main.jsx
│ └── .env.example
│
└── README.md

## Database

```sql
users (id, name, email UNIQUE, password)

tasks (id, user_id → users.id, title, description, priority,
       category, due_date, completed, status)
-- status is one of: 'todo' | 'in_progress' | 'done'
```

If you already have a `tasks` table without `status`, run `backend/migrations/001_add_task_status.sql` once.

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- A PostgreSQL database (local, or a free one from [Neon](https://neon.tech))

### 1. Clone the repository

```bash
git clone https://github.com/Manideep9900/TaskYard.git
cd TaskYard
```

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/.env` (copy from `.env.example`):

```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=a_long_random_secret_string
PORT=5000
```

Start the server:

```bash
npm start
```

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` (copy from `.env.example`):

```env
VITE_API_URL=http://localhost:5000
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:5173`.

---

## API Endpoints

### Authentication

| Method | Endpoint         | Description              |
| ------ | ---------------- | ------------------------ |
| POST   | `/auth/register` | Create a new account     |
| POST   | `/auth/login`    | Log in and receive a JWT |

### Tasks (send `Authorization: Bearer <token>`)

| Method | Endpoint            | Description                                    |
| ------ | ------------------- | ---------------------------------------------- |
| GET    | `/tasks`            | Get all tasks for the logged-in user           |
| POST   | `/tasks`            | Create a task                                  |
| PUT    | `/tasks/:id`        | Update title, completed flag and priority      |
| PATCH  | `/tasks/:id/status` | Move a task to `todo`, `in_progress` or `done` |
| DELETE | `/tasks/:id`        | Delete a task                                  |

### Other

| Method | Endpoint  | Description  |
| ------ | --------- | ------------ |
| GET    | `/health` | Health check |

---

## Design Decisions

- **Stateless auth with JWT:** middleware verifies the token on every task route.
- **Passwords:** hashed with bcrypt and never stored in plain text.
- **User-scoped queries:** every task query includes `user_id`, so users cannot read or change each other's data.
- **Kanban status and the checkbox stay in sync:** moving a card to Done marks it completed, and ticking the checkbox moves it to Done. The database update happens in one SQL statement, so the two values cannot drift apart.
- **Optimistic board updates:** a card moves instantly, then snaps back with an error message if the server rejects the change.
- **Drag handle instead of a draggable card:** this keeps scrolling smooth on touch screens.

---

## Roadmap

- [x] Authentication
- [x] Kanban board with drag-and-drop
- [ ] Automated tests (Jest and Supertest)
- [ ] Pagination and server-side sorting
- [ ] TypeScript migration
- [ ] Docker setup and CI with GitHub Actions
- [ ] Email reminders for upcoming deadlines
- [ ] Teams and shared projects
- [ ] AI-assisted task breakdown

---

## Author

**Manideep**

GitHub: [@Manideep9900](https://github.com/Manideep9900)
