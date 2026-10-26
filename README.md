# LinkedIn Post Scheduler — AI-Powered Content Creation & Scheduling

A full-stack web application that lets you create, schedule, and publish LinkedIn posts powered by **Google Gemini AI**. Generate professional content with customizable topics, tone, and formatting — then schedule or publish directly to your LinkedIn profile.

---

## Overview

LinkedIn Post Scheduler streamlines your LinkedIn content workflow. Instead of manually crafting posts, you can leverage AI to generate high-quality drafts based on your chosen topics, preferred tone, and formatting guidelines. The app integrates directly with the LinkedIn API for authentication and publishing, and stores everything locally in a SQLite database for fast, self-contained operation.

Whether you're a solo professional building your personal brand or a content creator managing a publishing cadence, this tool gives you full control over your LinkedIn presence — from ideation to publication.

---

## Features

- ✅ **AI-Powered Post Generation** — Generate LinkedIn posts using Google Gemini with fine-grained control over topics, tone, length, and formatting
- ✅ **LinkedIn OAuth Integration** — Secure "Sign In with LinkedIn" using OpenID Connect for authentication
- ✅ **Multi-Topic Post Creation** — Select from predefined topics or add custom ones, with customizable tone and style
- ✅ **Content Uniqueness Checking** — TF-IDF similarity analysis prevents repetitive content across your posts
- ✅ **Post Scheduling** — Schedule posts for one-time future publishing at a specific date and time
- ✅ **Recurring Schedules** — Set up recurring publishing schedules (daily, weekly, custom cron) for hands-free content delivery
- ✅ **Approval Workflow** — Review and approve AI-generated posts before they go live
- ✅ **Draft Management** — Save, edit, and organize draft posts before scheduling or publishing
- ✅ **Publishing History** — Track all published posts with timestamps, status, and error details
- ✅ **Responsive Dashboard** — Clean, modern UI built with React and Tailwind CSS that works on desktop and mobile
- ✅ **Server-Side Security** — All API keys and tokens encrypted at rest; sensitive calls made server-side only

---

## Architecture

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│                  │       │                  │       │                  │
│   Browser        │◄─────►│   Express API    │◄─────►│  LinkedIn API    │
│   (React + Vite) │ HTTP  │   Server         │ HTTPS │                  │
│                  │       │                  │       └──────────────────┘
└──────────────────┘       │                  │
                           │                  │       ┌──────────────────┐
                           │                  │◄─────►│  Google Gemini   │
                           │                  │ HTTPS │  API             │
                           └────────┬─────────┘       └──────────────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │   SQLite DB      │
                           │   (better-sqlite3)│
                           └──────────────────┘
```

- **Frontend**: React 18 with Vite, Tailwind CSS, React Router
- **Backend**: Express.js with session-based authentication
- **Database**: SQLite via `better-sqlite3` (zero-config, file-based)
- **AI**: Google Gemini API for content generation
- **OAuth**: LinkedIn OpenID Connect for user authentication
- **Scheduling**: `node-schedule` and `node-cron` for timed post publishing

---

## Prerequisites

Before setting up the application, make sure you have:

| Requirement | Details |
|---|---|
| **Node.js** | Version 18 or higher ([download](https://nodejs.org/)) |
| **npm** | Comes with Node.js |
| **LinkedIn Developer App** | Required for OAuth login and publishing ([create one](https://www.linkedin.com/developers/)) |
| **Google Gemini API Key** | Required for AI content generation ([get one](https://aistudio.google.com/apikey)) |

---

## LinkedIn Developer App Setup

Follow these steps carefully to configure your LinkedIn application:

### Step 1: Create a LinkedIn Page (if you don't have one)

LinkedIn requires every developer app to be associated with a LinkedIn Page. If you don't already have one:

1. Go to [LinkedIn Pages](https://www.linkedin.com/company/setup/new/)
2. Create a page for your brand, business, or personal use
3. You'll need admin access to this page for the next step

### Step 2: Create a Developer App

1. Navigate to [https://www.linkedin.com/developers/](https://www.linkedin.com/developers/)
2. Click **"Create App"**
3. Fill in the required details:
   - **App name**: Choose a name (e.g., "My LinkedIn Scheduler")
   - **LinkedIn Page**: Select the LinkedIn Page you created or manage
   - **Privacy policy URL**: Can use a placeholder during development
   - **App logo**: Upload any square image (100×100 minimum)
4. Click **"Create App"**

### Step 3: Configure OAuth Redirect URL

1. In your app dashboard, go to the **"Auth"** tab
2. Under **"OAuth 2.0 settings"**, find **"Authorized redirect URLs for your app"**
3. Add the following redirect URL:
   ```
   http://localhost:3001/api/auth/linkedin/callback
   ```
4. Click **"Update"** to save

### Step 4: Request Required Products

1. Go to the **"Products"** tab in your app dashboard
2. Request access to the following products:

   | Product | Purpose | Approval |
   |---|---|---|
   | **Sign In with LinkedIn using OpenID Connect** | User authentication via OAuth | Usually auto-approved |
   | **Share on LinkedIn** | Publishing posts (grants `w_member_social` scope) | May require LinkedIn review |

3. Click **"Request access"** for each product and agree to the terms

### Step 5: Note Your Credentials

1. Go back to the **"Auth"** tab
2. Copy your **Client ID** and **Client Secret**
3. You'll add these to your `.env` file during setup

> [!IMPORTANT]
> The `w_member_social` scope **must be approved** by LinkedIn before publishing will work. Until approval, you can still use the app for content generation, drafting, and scheduling — but actual publishing to LinkedIn will return a permission error. The "Sign In with LinkedIn using OpenID Connect" product is usually approved instantly.

---

## Getting a Google Gemini API Key

1. Go to [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Select or create a Google Cloud project
5. Copy the generated API key
6. You'll add this key in the app's **Settings** page after logging in (it's stored encrypted in the database, not in `.env`)

> [!NOTE]
> The Gemini API has a generous free tier that's sufficient for personal use. Check the [pricing page](https://ai.google.dev/pricing) for current limits.

---

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd linkedin-post-scheduler
```

### 2. Install All Dependencies

```bash
npm run install:all
```

This installs dependencies for the root project, the server, and the client in one command.

### 3. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env
```

### 4. Generate Secure Keys

Run these commands to generate cryptographically secure keys:

```bash
# Generate SESSION_SECRET (128 hex characters)
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate ENCRYPTION_KEY (64 hex characters)
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output values into your `.env` file.

### 5. Add LinkedIn Credentials

Edit `.env` and fill in your LinkedIn app credentials:

```env
LINKEDIN_CLIENT_ID=your_actual_client_id
LINKEDIN_CLIENT_SECRET=your_actual_client_secret
```

### 6. Start Development Servers

```bash
npm run dev
```

This starts both the Express API server (port 3001) and the Vite dev server (port 5173) concurrently.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3001` | Port for the Express API server |
| `NODE_ENV` | No | `development` | Environment mode (`development` or `production`) |
| `SESSION_SECRET` | **Yes** | — | Secret key for signing session cookies. Generate a random 64-byte hex string. |
| `ENCRYPTION_KEY` | **Yes** | — | 32-byte hex key for AES-256-GCM encryption of stored credentials and tokens. |
| `LINKEDIN_CLIENT_ID` | **Yes** | — | OAuth Client ID from your LinkedIn Developer App |
| `LINKEDIN_CLIENT_SECRET` | **Yes** | — | OAuth Client Secret from your LinkedIn Developer App |
| `LINKEDIN_REDIRECT_URI` | No | `http://localhost:3001/api/auth/linkedin/callback` | OAuth callback URL (must match LinkedIn app config) |
| `CLIENT_URL` | No | `http://localhost:5173` | Frontend URL for CORS origin (Vite dev server default) |
| `DB_PATH` | No | `./data/linkedin-scheduler.db` | Path to the SQLite database file (relative to `server/`) |

---

## Usage Guide

### 1. Open the Application

Navigate to [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Connect Your LinkedIn Account

Click **"Connect with LinkedIn"** on the login page. You'll be redirected to LinkedIn to authorize the app, then back to the dashboard.

### 3. Add Your Gemini API Key

Go to the **Settings** page and enter your Google Gemini API key. It will be encrypted and stored securely in the database.

### 4. Create a Post

- Navigate to the **Create** tab
- Select one or more **topics** (e.g., Technology, Leadership, Career Growth)
- Choose a **tone** (Professional, Casual, Inspirational, etc.)
- Configure additional preferences (length, formatting, hashtags, call-to-action)
- Click **"Generate with AI"** to create a draft

### 5. Review and Edit

- Review the AI-generated content in the editor
- Make any manual edits or refinements
- Regenerate if you're not satisfied with the result

### 6. Save, Schedule, or Publish

- **Save as Draft**: Store for later editing
- **Schedule**: Set a specific date/time for automatic publishing
- **Publish Now**: Post immediately to your LinkedIn profile

### 7. Manage Scheduled Posts

- View all scheduled posts in the **Scheduled** tab
- Approve pending posts before they're published
- Cancel or reschedule as needed
- Set up recurring schedules for consistent publishing

---

## Testing Steps

Follow these manual testing steps to verify the application is working correctly:

1. **Start the application** — Run `npm run dev` and confirm both servers start without errors
2. **Verify the login page** — Open [http://localhost:5173](http://localhost:5173) and confirm the login page renders correctly
3. **Test OAuth flow** — (Requires LinkedIn app configuration) Click "Connect with LinkedIn" and complete the authorization flow
4. **Add Gemini API key** — Navigate to Settings and add your API key; verify it saves successfully
5. **Create a post** — Select topics and tone, then generate content with AI; verify the generated post appears in the editor
6. **Test draft saving** — Save a post as a draft, then verify it appears in the Drafts list; open it and confirm edits persist
7. **Test scheduling** — Schedule a post for a future time; verify it appears in the Scheduled tab with correct date/time
8. **Test recurring schedules** — Create a recurring schedule; verify the schedule configuration is saved and displayed correctly
9. **Verify uniqueness checking** — Generate multiple posts with similar topics; verify the app flags or adjusts content for uniqueness
10. **Test publishing** — (Requires `w_member_social` approval) Publish a post and verify it appears on your LinkedIn profile

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/linkedin` | Initiate LinkedIn OAuth flow |
| `GET` | `/api/auth/linkedin/callback` | OAuth callback handler |
| `GET` | `/api/auth/status` | Check current authentication status |
| `POST` | `/api/auth/logout` | Log out and destroy session |

### Posts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/posts` | List all posts (with optional status filter) |
| `POST` | `/api/posts` | Create a new post |
| `GET` | `/api/posts/:id` | Get a specific post by ID |
| `PUT` | `/api/posts/:id` | Update an existing post |
| `DELETE` | `/api/posts/:id` | Delete a post |
| `POST` | `/api/posts/:id/publish` | Publish a post to LinkedIn immediately |
| `POST` | `/api/posts/:id/approve` | Approve a scheduled post for publishing |

### Scheduling

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/schedules` | List all schedules |
| `POST` | `/api/schedules` | Create a new schedule |
| `PUT` | `/api/schedules/:id` | Update a schedule |
| `DELETE` | `/api/schedules/:id` | Delete / cancel a schedule |

### AI Generation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/generate` | Generate a LinkedIn post using Gemini AI |
| `POST` | `/api/generate/check-uniqueness` | Check content similarity against existing posts |

### Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings` | Get current user settings |
| `PUT` | `/api/settings` | Update user settings (including Gemini API key) |

---

## Project Structure

```
linkedin-post-scheduler/
├── package.json                  # Root package.json with monorepo scripts
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore rules
├── README.md                     # This file
│
├── server/                       # Express.js backend
│   ├── package.json              # Server dependencies
│   ├── index.js                  # Server entry point and Express app setup
│   ├── config/
│   │   └── database.js           # SQLite database initialization and schema
│   ├── middleware/
│   │   └── auth.js               # Authentication middleware
│   ├── routes/
│   │   ├── auth.js               # LinkedIn OAuth routes
│   │   ├── posts.js              # Post CRUD and publishing routes
│   │   ├── schedules.js          # Schedule management routes
│   │   ├── generate.js           # AI content generation routes
│   │   └── settings.js           # User settings routes
│   ├── services/
│   │   ├── linkedin.js           # LinkedIn API client (OAuth, profile, publishing)
│   │   ├── gemini.js             # Google Gemini AI client
│   │   ├── scheduler.js          # Cron job management for scheduled posts
│   │   └── encryption.js         # AES-256-GCM encryption/decryption utilities
│   └── data/                     # SQLite database file (auto-created, git-ignored)
│       └── linkedin-scheduler.db
│
└── client/                       # React frontend (Vite)
    ├── package.json              # Client dependencies
    ├── vite.config.js            # Vite configuration with API proxy
    ├── tailwind.config.js        # Tailwind CSS configuration
    ├── postcss.config.js         # PostCSS configuration
    ├── index.html                # HTML entry point
    ├── public/                   # Static assets
    └── src/
        ├── main.jsx              # React app entry point
        ├── App.jsx               # Root component with routing
        ├── index.css             # Global styles and Tailwind imports
        ├── components/
        │   ├── Layout.jsx        # App shell with sidebar navigation
        │   ├── ProtectedRoute.jsx# Auth guard for protected pages
        │   ├── PostEditor.jsx    # Rich post editor component
        │   ├── PostCard.jsx      # Post preview card component
        │   ├── ScheduleModal.jsx # Schedule configuration modal
        │   ├── TopicSelector.jsx # Topic selection component
        │   └── GenerateForm.jsx  # AI generation settings form
        ├── pages/
        │   ├── LoginPage.jsx     # Login / Connect with LinkedIn
        │   ├── DashboardPage.jsx # Main dashboard with post overview
        │   ├── CreatePage.jsx    # Post creation with AI generation
        │   ├── DraftsPage.jsx    # Draft post management
        │   ├── ScheduledPage.jsx # Scheduled posts list
        │   ├── HistoryPage.jsx   # Publishing history
        │   └── SettingsPage.jsx  # App settings and API key management
        ├── contexts/
        │   └── AuthContext.jsx   # Authentication state management
        └── lib/
            └── api.js            # API client utility functions
```

---

## Security Considerations

This application implements several security measures:

- **Encryption at Rest** — All API keys (Gemini) and OAuth tokens (LinkedIn) are encrypted using AES-256-GCM before being stored in the database. The encryption key is configured via environment variables and never committed to source control.

- **Server-Side API Calls** — LinkedIn API calls and Gemini API calls are made exclusively from the server. Access tokens and API keys are never exposed to the browser.

- **Session-Based Authentication** — User sessions are managed with `express-session` using HTTP-only, secure cookies. Session secrets are configurable via environment variables.

- **CORS Protection** — Cross-Origin Resource Sharing is restricted to the configured `CLIENT_URL` only, preventing unauthorized origins from making API requests.

- **OAuth State Parameter** — The LinkedIn OAuth flow uses a cryptographically random state parameter to prevent CSRF attacks during authentication.

- **Input Validation** — All API inputs are validated on the server before processing.

> [!CAUTION]
> Always generate unique, cryptographically strong values for `SESSION_SECRET` and `ENCRYPTION_KEY` in production. Never use the placeholder values from `.env.example`.

---

## Limitations & Notes

- **Single-User Application** — The current design supports a single LinkedIn account. Multi-user support could be added by extending the database schema and session management.

- **SQLite Database** — SQLite is ideal for single-server, low-concurrency deployments. For high-traffic or multi-server setups, consider migrating to PostgreSQL or MySQL.

- **LinkedIn API Rate Limits** — LinkedIn enforces rate limits on API calls. The app does not currently implement rate-limit tracking, so high-frequency publishing may result in temporary blocks.

- **Content Uniqueness is Best-Effort** — The uniqueness checker uses TF-IDF cosine similarity to compare generated content against previous posts. It is a heuristic, not a guarantee of uniqueness.

- **No Trend Scraping** — The app does **not** scrape LinkedIn, Twitter/X, or any other platform for trending topics. If trend-related content is requested during generation, the AI will transparently note that verified real-time trend data is unavailable and will generate content based on general knowledge instead.

- **Publishing Requires LinkedIn Approval** — The `w_member_social` scope must be approved by LinkedIn for your developer app before the publish feature will work. Until then, all other features (AI generation, drafting, scheduling) work normally.

- **No Image/Media Support** — The current version supports text-only LinkedIn posts. Image and document attachments may be added in a future release.

- **Local Time Zones** — Scheduled posts use the server's local time zone. Ensure your server time is configured correctly.

---

## Scripts Reference

| Script | Description |
|---|---|
| `npm run dev` | Start both server and client in development mode |
| `npm run server:dev` | Start only the Express server with file watching |
| `npm run client:dev` | Start only the Vite dev server |
| `npm run build` | Build the React client for production |
| `npm run start` | Start the server in production mode |
| `npm run install:all` | Install dependencies for root, server, and client |

---

## Troubleshooting

### "Cannot find module 'better-sqlite3'"
Run `npm run install:all` to ensure all dependencies are installed. `better-sqlite3` requires native compilation — make sure you have build tools installed (Python 3 and a C++ compiler).

### LinkedIn OAuth returns an error
- Verify your redirect URL in the LinkedIn Developer App matches exactly: `http://localhost:3001/api/auth/linkedin/callback`
- Check that `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in `.env` are correct
- Ensure you've requested the required products (OpenID Connect and Share on LinkedIn)

### Gemini API returns 403 or quota errors
- Verify your API key is valid at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Check if you've exceeded the free tier rate limits
- Ensure the API key has the Generative Language API enabled

### Posts fail to publish
- Confirm that the **"Share on LinkedIn"** product has been approved for your developer app
- Check the publishing history for detailed error messages
- Verify your LinkedIn access token hasn't expired (re-authenticate if needed)

---

## License

This project is licensed under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
