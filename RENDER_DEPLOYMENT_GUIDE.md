# 🚀 Deploying on Render (100% Free, No Credit Card Needed)

This guide walks you through deploying your **LinkedIn Post Scheduler & AI Engine** to **[Render.com](https://render.com)**.  
**Cost**: $0.00 | **Credit Card Required**: **No** (Just sign in with your GitHub account).

---

## 📋 Prerequisites: Push Project to GitHub

If you already have your project on GitHub, skip to **Step 2**. If not, follow these 3 commands:

1. Open **PowerShell** or terminal inside your project folder (`c:\Users\abhip\Downloads\PROJECT`):
   ```bash
   git init
   git add .
   git commit -m "Ready for Render deployment"
   ```
2. Go to **[github.com](https://github.com/)** and click **New Repository** (choose **Private**).
3. Link and push your code:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

---

## 🌐 Step 2: Create Free Web Service on Render

1. Go to **[render.com](https://render.com/)** and click **"Get Started for Free"** (or **"Log in"**).
2. Select **"Continue with GitHub"** *(no credit card is required)*.
3. In your Render Dashboard, click the **"New +"** button at the top right and select **"Web Service"**.
4. Choose **"Build and deploy from a Git repository"** and select your GitHub repository from the list.
5. Fill in the deployment settings:
   - **Name**: `linkedin-ai-scheduler` (or any name you like)
   - **Language / Runtime**: `Node`
   - **Region**: Choose closest to you (e.g. `Oregon (US West)` or `Frankfurt (EU)`)
   - **Branch**: `main`
   - **Build Command**:
     ```bash
     npm run install:all && npm run build
     ```
   - **Start Command**:
     ```bash
     npm run start
     ```
   - **Instance Type**: Select **"Free"** ($0/month).

---

## 🔑 Step 3: Add Environment Variables

Scroll down to the **"Environment Variables"** section on the same page. Click **"Add Environment Variable"** for each of these keys (copy their values from your local `.env` file):

| Key | Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production mode |
| `ENCRYPTION_KEY` | *(Paste from your `.env`)* | Required 64-char key |
| `SESSION_SECRET` | *(Paste from your `.env`)* | Cookie session signature |
| `GEMINI_API_KEY` | *(Paste from your `.env`)* | Google Gemini API key |
| `LINKEDIN_CLIENT_ID` | *(Paste from your `.env`)* | LinkedIn Developer Client ID |
| `LINKEDIN_CLIENT_SECRET` | *(Paste from your `.env`)* | LinkedIn Developer Client Secret |

*(Leave `CLIENT_URL` and `LINKEDIN_REDIRECT_URI` for the next step once Render gives you your domain name)*.

6. Click **"Create Web Service"**.
7. Render will automatically build the React frontend and launch the Node.js server. In 2–3 minutes, you will see a green badge: **"Live"**.

---

## 🔗 Step 4: Configure URLs & LinkedIn Developer Portal

At the top of your Render service page, copy your free URL (for example: `https://linkedin-ai-scheduler.onrender.com`).

1. Go back to Render **Environment** tab and add the two remaining variables:
   - `CLIENT_URL` = `https://your-service-name.onrender.com`
   - `LINKEDIN_REDIRECT_URI` = `https://your-service-name.onrender.com/api/auth/linkedin/callback`
   *(Render will automatically restart in ~30 seconds to apply them)*.

2. Go to **[LinkedIn Developer Portal](https://www.linkedin.com/developers/)**:
   - Open your App → Click the **Auth** tab.
   - Under **OAuth 2.0 settings**, add your new live callback URL to **Authorized redirect URLs**:
     ```
     https://your-service-name.onrender.com/api/auth/linkedin/callback
     ```

---

## ⏰ Step 5: Keep It Awake 24/7 for Free (No Sleep)

Render's free tier goes to sleep after 15 minutes of inactivity. To prevent it from sleeping and ensure your schedules fire at `09:00`, `14:00`, or `18:00` without delay:

1. Go to **[cron-job.org](https://cron-job.org/en/)** (100% free, no credit card required).
2. Sign up and click **"Create Cronjob"**:
   - **Title**: `Keep LinkedIn Scheduler Awake`
   - **URL**: `https://your-service-name.onrender.com/api/health`
   - **Schedule**: Every `10 minutes`
3. Click **"Save"**.

Every 10 minutes, Cron-job.org will ping `/api/health`. Because Render receives traffic every 10 minutes, **your app never goes to sleep and stays active 24/7 for $0.00**.

---

## 🎉 You Are All Set!

You can now visit `https://your-service-name.onrender.com` from your laptop, mobile phone, or tablet anywhere in the world. Your laptop can be completely off!
