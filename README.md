# 🚀 TaskYard — Modern Full-Stack Task & Workflow Management

**TaskYard** is a modern, high-performance task and workflow management platform designed for distraction-free execution. Built with **React 19**, **Vite**, **Express 5**, and **PostgreSQL (Neon)**, it combines an interactive Kanban board, automated AI task labeling, persistent database image attachments, atomic monthly usage quotas, and Stripe subscription billing.

---

## 🌐 Live Deployments

- **Demo:** [taskyard-fronten.onrender.com](https://taskyard-fronten.onrender.com)


> ⏳ **Note:** The backend is hosted on Render's free tier and spins down when idle. The first request after a period of inactivity may take **30–50 seconds** to wake up.

---

## ✨ Features & Architecture

### 🎨 1. Modern Design & User Experience
- **Airy Ambient Canvas:** Soft off-white background (`#fafbfc`) with a subtle dot-grid canvas and pastel ambient lighting accents (Yellow `#fef08a`, Pink `#fbcfe8`, Blue `#93c5fd`, Green `#bbf7d0`).
- **Glassmorphic Navigation Bar:** Sticky top navigation with brand layers, active task count badges, user avatar, and a quick-action `+ New task` pill.
- **Productivity Metrics Grid:** Real-time workspace analytics displaying total tracked tasks, active in-progress items, completion percentage, and overdue deadline alerts.
- **Continuous Feature Ticker:** Infinite marquee ribbon summarizing workspace capabilities.
- **Keyboard Shortcut Search:** Instant search activation via `/` or `Ctrl + K`.
- **Drag-and-Drop Kanban Board:** Built with `@dnd-kit/core`, supporting mouse, touch, and keyboard interactions with automated status-to-completed database synchronization.
- **High-Contrast Typography & Pastel Tags:** Accessible contrast (exceeding 4.5:1) for priority badges, categories, and AI labels across list and Kanban board views.

### 🔐 2. Authentication & Security
- **Dual Sign-In:** Register and log in using standard email/password or one-click **Google OAuth 2.0**.
- **Cryptographic Security:** Passwords hashed with `bcrypt`; stateless session management with JWT tokens.
- **Row-Level User Isolation:** Every database operation is strictly scoped to `req.user.id`.
- **Password Visibility Toggle:** Show/hide password button inside credential inputs.

### 🤖 3. AI-Powered Auto-Labeling (Groq & OpenAI)
- **Multi-Provider Support:** Supports high-speed inference via **Groq** (`llama-3.3-70b-versatile`) using OpenAI-compatible endpoints, as well as native **OpenAI** (`gpt-4o-mini`).
- **Contextual Categorization:** Automatically scans task titles and descriptions to assign smart classification tags (e.g., `career`, `urgency`, `meeting`).
- **One-Click Regeneration:** Regenerate labels anytime from the Task Detail view.
- **Resilient Fallback:** Automatically defaults to intelligent heuristic rule-based tagging if AI API keys are unavailable.

### 📎 4. Persistent PostgreSQL BYTEA Image Storage
- **Direct Database Persistence:** Images are stored directly in PostgreSQL (`BYTEA` column in `task_images`), eliminating reliance on ephemeral server disks that get wiped on deploy/restart.
- **Validated Memory Uploads:** Multer memory storage with a strict **1MB limit** and MIME-type validation (`image/jpeg`, `image/png`, `image/gif`, `image/webp`).
- **Authenticated Streaming Route:** `GET /tasks/:id/image` streams images securely with `Content-Type` headers and client caching.
- **`<AuthImage />` Component:** Custom frontend image component handling bearer token injection, animated skeleton loading, and graceful error fallbacks.
- **Automated Cascade Deletion:** Foreign key constraints (`ON DELETE CASCADE`) guarantee that deleting a task automatically cleans up its image data.

### 📊 5. Atomic Monthly Quota Enforcement
- **Plan Limits:**
  - **Free Starter Plan:** 100 new tasks created per month.
  - **Pro Plan:** 10,000 new tasks created per month.
- **Concurrency-Safe Reservation:** Enforced in PostgreSQL transactions using `SELECT ... FOR UPDATE` on the user record before inserting tasks, eliminating race conditions.
- **Automatic Rollover:** Tracks `tasks_created_this_month` and resets on monthly rollover timestamp (`month_reset_at`).
- **Frontend Quota Alerts:** Clear limit-reached banners guiding users directly to upgrade.

### 💳 6. Stripe Subscriptions & Webhook Automation
- **Stripe Checkout Integration:** Creates checkout sessions linked to users via `client_reference_id` and reusable `stripe_customer_id`.
- **Cryptographic Webhook Verification:** `POST /webhook/stripe` registered with `express.raw({ type: "application/json" })` before `express.json()` to verify signatures via `stripe.webhooks.constructEvent`.
- **Full Subscription Lifecycle Handling:**
  - `checkout.session.completed` → Instantly elevates user to `premium` plan and links customer ID.
  - `customer.subscription.updated` → Maintains `premium` for active/trialing subscriptions or returns to `free` on cancelation.
  - `customer.subscription.deleted` → Downgrades user to `free`.
- **Customer Billing Portal:** One-click redirection to Stripe's self-service customer portal (`/billing/portal`) for invoice history, payment updates, and cancellations.
- **Instant Client Polling:** Polling mechanism on `/profile?success=true` checks for plan upgrade activation every 2 seconds until confirmed.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, React Router 7, `@dnd-kit/core`, `@react-oauth/google`, CSS Variables |
| **Backend** | Node.js, Express 5, `pg` (node-postgres), JWT, bcrypt, `multer`, Stripe Node SDK, OpenAI/Groq SDK |
| **Database** | PostgreSQL on Neon (Serverless Postgres with SSL verification) |
| **Hosting** | Render (Web Services & Static Sites) |

---

## 📁 Project Structure

```
TaskYard/
├── backend/
│   ├── middleware/
│   │   ├── authMiddleware.js      # JWT authentication and user extraction
│   │   └── upload.js              # Multer memory storage with 1MB cap & MIME validation
│   ├── routes/
│   │   ├── auth.js                # Login, register, Google OAuth, and profile routes
│   │   ├── billing.js             # Stripe checkout session and customer portal
│   │   ├── tasks.js               # Task CRUD, BYTEA image streaming, and AI labeling
│   │   └── webhook.js             # Stripe webhook handler with signature checks
│   ├── migrations/
│   │   ├── 001_add_task_status.sql
│   │   ├── 002_billing_and_quotas.sql
│   │   └── 003_task_images_bytea.sql
│   ├── app.js                     # Express app setup and route registration
│   ├── db.js                      # PostgreSQL pool connection (Neon)
│   ├── migrate.js                 # Automated migration runner
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth.jsx           # Clean authentication card with Google sign-in
│   │   │   ├── AuthImage.jsx      # Authenticated streaming image with skeleton loader
│   │   │   ├── kanbanboard.jsx    # Drag-and-drop board with pastel status columns
│   │   │   ├── Profile.jsx        # Dual-card subscription pricing & usage meters
│   │   │   ├── ProtectedRoute.jsx # Route authentication guard
│   │   │   ├── TaskDetail.jsx     # Full task view with AI regeneration & image preview
│   │   │   ├── TaskForm.jsx       # Task creation with custom file picker & quota alerts
│   │   │   ├── TaskItem.jsx       # Task row with inline editing and tags
│   │   │   └── TaskList.jsx       # Filtered task list container
│   │   ├── api.js                 # Centralized fetch wrapper with auth header injection
│   │   ├── taskstatus.js          # Kanban column definitions and status helpers
│   │   ├── App.jsx                # Main layout, hero, metrics grid, and state management
│   │   ├── App.css                # Polished design system and responsive styles
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
│
└── README.md
```

---

## 🗄️ Database Schema

```sql
-- Users Table
CREATE TABLE users (
  id                        SERIAL PRIMARY KEY,
  name                      VARCHAR(255) NOT NULL,
  email                     VARCHAR(255) UNIQUE NOT NULL,
  password                  TEXT, -- Nullable for Google OAuth users
  google_id                 TEXT,
  avatar_url                TEXT,
  plan                      TEXT NOT NULL DEFAULT 'free', -- 'free' | 'premium'
  stripe_customer_id        TEXT,
  tasks_created_this_month  INTEGER NOT NULL DEFAULT 0,
  month_reset_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks Table
CREATE TABLE tasks (
  id                        SERIAL PRIMARY KEY,
  user_id                   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                     VARCHAR(255) NOT NULL,
  description               TEXT,
  priority                  VARCHAR(50) DEFAULT 'medium', -- 'low' | 'medium' | 'high'
  category                  VARCHAR(100) DEFAULT 'Personal',
  due_date                  DATE,
  completed                 BOOLEAN DEFAULT FALSE,
  status                    VARCHAR(50) DEFAULT 'todo', -- 'todo' | 'in_progress' | 'done'
  labels                    TEXT[] DEFAULT '{}',
  has_image                 BOOLEAN DEFAULT FALSE,
  image_url                 TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Persistent PostgreSQL BYTEA Task Images Table
CREATE TABLE task_images (
  task_id                   INTEGER PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  mime_type                 TEXT NOT NULL,
  size_bytes                INTEGER NOT NULL,
  data                      BYTEA NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 🔌 API Endpoints Reference

### Authentication (`/auth`)
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/auth/register` | No | Register a new user with name, email, and password |
| `POST` | `/auth/login` | No | Authenticate user and return JWT |
| `POST` | `/auth/google` | No | Verify Google ID token and return JWT |
| `GET` | `/auth/profile` | Yes | Get current user profile, plan, and monthly usage |

### Tasks (`/tasks`)
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/tasks` | Yes | Retrieve all tasks for the logged-in user |
| `POST` | `/tasks` | Yes | Create a task (enforces monthly quota reservation; multipart/form-data for image) |
| `PUT` | `/tasks/:id` | Yes | Update task title, description, priority, or completed state |
| `PATCH` | `/tasks/:id/status`| Yes | Update Kanban status (`todo`, `in_progress`, `done`) with sync |
| `DELETE`| `/tasks/:id` | Yes | Delete task and cascades to attached image |
| `GET` | `/tasks/:id/image` | Yes | Stream binary image with MIME headers from PostgreSQL |
| `DELETE`| `/tasks/:id/image` | Yes | Remove image attachment from task |
| `POST` | `/tasks/:id/labels`| Yes | Generate AI task labels using Groq / OpenAI |

### Billing & Stripe (`/billing` & `/webhook`)
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/billing/create-checkout` | Yes | Initialize Stripe Checkout session for Pro plan |
| `POST` | `/billing/portal` | Yes | Generate Stripe Customer Billing Portal session URL |
| `POST` | `/webhook/stripe` | Signature Header | Verify Stripe raw webhook payload and update user plan |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (or free [Neon Serverless Postgres](https://neon.tech))
- Stripe account (for billing)
- Groq or OpenAI API key (for AI labeling)
- Google Cloud OAuth Client ID (optional, for Google Sign-In)

---

### 1. Clone & Setup Repository
```bash
git clone https://github.com/Manideep9900/TaskYard.git
cd TaskYard
```

### 2. Backend Configuration
```bash
cd backend
npm install
```

Create `backend/.env` with your credentials:
```env
PORT=3000
DATABASE_URL=postgresql://user:password@ep-sample-pool.neon.tech/neondb?sslmode=require
JWT_SECRET=super_secret_jwt_passphrase

# AI Configuration (Groq or OpenAI)
GROQ_API_KEY=gsk_your_groq_api_key_here
OPENAI_API_KEY=sk-your_openai_api_key_here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PRICE_ID=price_your_pro_monthly_id
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
FRONTEND_URL=http://localhost:5173

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

Run schema migrations:
```bash
node migrate.js
```

Start the backend server:
```bash
npm start
```
Server will run on `http://localhost:3000`.

---

### 3. Frontend Configuration
```bash
cd ../frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

Start Vite dev server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

### 4. Stripe Webhook Testing (Local Development)
To test Stripe checkout and webhooks locally:
```bash
stripe listen --forward-to localhost:3000/webhook/stripe
```
Copy the printed `whsec_...` into `backend/.env` as `STRIPE_WEBHOOK_SECRET` and restart the backend. Use Stripe's test card `4242 4242 4242 4242`.

---

## 👥 Author

**Manideep**
- GitHub: [@Manideep9900](https://github.com/Manideep9900)
- Project: [TaskYard](https://github.com/Manideep9900/TaskYard)
