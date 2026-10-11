TaskYard

A full-stack task management app with authentication, priorities, deadlines, categories and a progress dashboard.

Built with React, Node.js, Express and PostgreSQL.

🌐 Live demo: taskyard-fronten.onrender.com ⚙️ Backend API: task-manager-qszt.onrender.com

⏳ Note: the backend runs on Render's free tier, so it sleeps when idle. The first request can take 30-60 seconds to wake it up. After that it responds normally.

<!-- Add a screenshot or GIF here, for example: --> <!-- ![TaskYard dashboard](./screenshots/dashboard.png) -->

✨ Features
🔐 User authentication: register and log in with JWT; each user sees only their own tasks
➕ Full task CRUD: create, view, edit and delete tasks
✅ Mark tasks as completed
🎯 Priorities: set low, medium or high priority
📅 Due dates: track deadlines, with upcoming and overdue views
🏷️ Categories: organize tasks by category
🔍 Search and filter: find tasks by text and filter by All, Active or Completed
📊 Dashboard: task statistics at a glance
✔️ Form validation plus loading and error handling
📱 Responsive UI that works on desktop and mobile
🛠️ Tech Stack
Layer Technologies
Frontend React, Vite, JavaScript, HTML5, CSS3
Backend Node.js, Express.js, REST API, JWT, CORS
Database PostgreSQL (hosted on Neon)
Deployment Render (frontend and backend), Neon (database)
📂 Project Structure
TaskYard/
├── backend/
│ ├── routes/
│ │ └── tasks.js
│ ├── middleware/
│ ├── app.js
│ ├── server.js
│ ├── db.js
│ ├── .env.example
│ └── package.json
│
├── frontend/
│ ├── src/
│ │ ├── components/
│ │ │ ├── TaskForm.jsx
│ │ │ ├── TaskItem.jsx
│ │ │ └── TaskList.jsx
│ │ ├── App.jsx
│ │ ├── App.css
│ │ ├── index.css
│ │ └── main.jsx
│ ├── .env.example
│ └── package.json
│
├── .gitignore
└── README.md
🚀 Getting Started
Prerequisites
Node.js 18 or later
A PostgreSQL database (local, or a free one from Neon)

1. Clone the repository
   bash
   git clone https://github.com/Manideep9900/TaskYard.git
   cd TaskYard
2. Set up the backend
   bash
   cd backend
   npm install

Create a .env file in backend/ (copy from .env.example):

env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=a_long_random_secret_string
PORT=5000

Start the server:

bash
npm start 3. Set up the frontend

Open a new terminal:

bash
cd frontend
npm install

Create a .env file in frontend/ (copy from .env.example):

env
VITE_API_URL=http://localhost:5000

Start the app:

bash
npm run dev

The app will be available at http://localhost:5173.

📡 API Endpoints

Update this table so it matches the routes in your code.

Authentication
Method Endpoint Description
POST /api/auth/register Create a new account
POST /api/auth/login Log in and receive a JWT
Tasks (requires Authorization: Bearer <token>)
Method Endpoint Description
GET /api/tasks Get all tasks for the logged-in user
POST /api/tasks Create a new task
PUT /api/tasks/:id Update a task
DELETE /api/tasks/:id Delete a task
🧠 Design Decisions
JWT authentication: the server stays stateless and the token is verified by middleware on every protected route.
Password hashing: passwords are hashed before storage and never saved as plain text.
User-scoped queries: every task query filters by the logged-in user's ID, so users cannot read or change each other's data.
PostgreSQL: tasks, users and categories are relational data, so a SQL database with foreign keys is a natural fit.
Separate frontend and backend: each can be deployed, scaled and changed independently.
🗺️ Roadmap
Kanban board with drag-and-drop (To Do, In Progress, Done)
Pagination and server-side sorting
Automated tests (Jest and Supertest)
TypeScript migration
Docker setup and CI with GitHub Actions
Email reminders for upcoming deadlines
Teams and shared projects
AI-assisted task breakdown
👤 Author

Manideep BE Computer Science and Business Systems

GitHub: @Manideep9900

⭐ If you find this project useful, consider giving it a star.
