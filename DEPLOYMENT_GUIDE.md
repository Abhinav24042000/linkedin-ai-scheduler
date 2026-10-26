# 24/7 Independent Cloud Deployment Guide

This guide explains how to run the **LinkedIn Post Scheduler & AI Campaign Engine** 24/7 independently in the cloud so you can **turn off your laptop completely**.

---

## 🎯 Architecture in Production

In development, you ran two processes (backend `:3001` and Vite frontend `:5173`).  
In production, running `npm run build` bundles the frontend into `client/dist`. The backend Express server then serves **both** the API, the Web App, and the background scheduler from a **single port**.

---

## 🚀 Option 1: Railway (Easiest — 0 Linux Terminal, ~10 mins)

*Railway automatically connects to GitHub, gives you a free HTTPS domain, and keeps your app online 24/7.*

1. **Push your code to a private GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Deploy LinkedIn Scheduler"
   git remote add origin https://github.com/YOUR_USERNAME/linkedin-scheduler.git
   git push -u origin main
   ```
2. **Open [Railway.app](https://railway.app)** and log in with GitHub.
3. Click **"New Project"** -> **"Deploy from GitHub repo"** -> select your repository.
4. Go to the project **Settings**:
   - Under **Variables**, add all the values from your local `.env`:
     - `SESSION_SECRET`
     - `ENCRYPTION_KEY`
     - `LINKEDIN_CLIENT_ID`
     - `LINKEDIN_CLIENT_SECRET`
     - `GEMINI_API_KEY`
     - `NODE_ENV=production`
   - Under **Volumes**, click **Add Volume**:
     - Mount path: `/app/server/data` *(This ensures your SQLite database and LinkedIn tokens survive restarts and redeployments)*.
   - Under **Networking**, click **Generate Domain** (e.g. `https://linkedin-scheduler-production.up.railway.app`).
5. Set `CLIENT_URL` in Railway Variables to your generated domain.
6. Set `LINKEDIN_REDIRECT_URI` to `https://your-domain.up.railway.app/api/auth/linkedin/callback`.
7. **LinkedIn Developer Console**:
   - Go to [LinkedIn Developers](https://www.linkedin.com/developers/) -> your app -> **Auth** -> **OAuth 2.0 settings**.
   - Add `https://your-domain.up.railway.app/api/auth/linkedin/callback` to Authorized redirect URLs.

*Done! You can close your laptop. Your campaigns will post on schedule.*

---

## 🐧 Option 2: Linux VPS / Oracle Always Free VM (100% Free Forever or $3.50/mo)

*Deploy on Oracle Cloud Always Free VM, Hetzner ($3.50/mo), or DigitalOcean ($4/mo).*

1. **Connect to your server via SSH**:
   ```bash
   ssh root@YOUR_SERVER_IP
   ```

2. **Install Node.js & Git**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git build-essential
   ```

3. **Clone your project**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/linkedin-scheduler.git
   cd linkedin-scheduler
   ```

4. **Copy your `.env` file**:
   ```bash
   nano .env
   # Paste your .env contents, then press Ctrl+O, Enter, Ctrl+X
   ```

5. **Build and install**:
   ```bash
   npm run install:all
   npm run build
   ```

6. **Start with PM2 (Auto-restarts 24/7 and on server reboot)**:
   ```bash
   sudo npm install -g pm2
   NODE_ENV=production pm2 start "node server/index.js" --name "linkedin-scheduler"
   pm2 startup
   pm2 save
   ```

7. **(Optional) Run with Docker Compose instead**:
   If you prefer Docker:
   ```bash
   sudo apt-get install -y docker-compose
   docker compose up -d
   ```

8. **Update LinkedIn Redirect URL**:
   In LinkedIn Developers Console, add:
   `http://YOUR_SERVER_IP:3001/api/auth/linkedin/callback` (or your domain if using a domain with SSL).

---

## 📋 What Happens Next?
- The scheduler runs autonomously in cloud memory.
- At your configured times (e.g. `09:00`, `14:00`, `18:00`, etc.), it calls Gemini and publishes directly to LinkedIn.
- You can access the dashboard anytime from your phone or laptop browser to view posts or schedule new campaigns.
