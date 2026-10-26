# 🌐 Oracle Cloud "Always Free" Setup Guide (24/7 Independent Server)

This step-by-step tutorial will guide you through setting up an **Always Free** Ubuntu cloud instance on Oracle Cloud and launching your LinkedIn AI Scheduler so it runs **24 hours a day, 7 days a week** with your laptop turned off.

---

## 🛠️ Step 1: Create Your Oracle Cloud Account

1. Go to **[oracle.com/cloud/free](https://www.oracle.com/cloud/free/)** and click **"Start for free"**.
2. Sign up with your email and address.
3. *Note on Verification:* Oracle requires a credit/debit card for fraud verification. They place a temporary ~$1 authorization hold and refund it immediately. You will **never** be charged as long as you use **"Always Free"** resources.
4. Select your **Home Region** (choose the closest location to you, e.g., *Mumbai / Hyderabad / Frankfurt / US East*).

---

## 🖥️ Step 2: Create Your Free Ubuntu Instance

1. In the Oracle Cloud Console dashboard, click **"Create a VM instance"** (or search for **Compute** -> **Instances** -> **Create Instance**).
2. **Name**: `linkedin-scheduler`
3. **Image and Shape**:
   - Click **Edit**.
   - **Image**: Select **Canonical Ubuntu** (Ubuntu 22.04 or 24.04).
   - **Shape**:
     - Option A: **Ampere ARM (VM.Standard.A1.Flex)** — Choose up to 2–4 OCPUs and 12–24 GB RAM (*Recommended: Marked "Always Free Eligible"*).
     - Option B: **AMD (VM.Standard.E2.1.Micro)** — 1 OCPU, 1 GB RAM (*Also Always Free*).
4. **Networking**: Keep defaults (Create new Virtual Cloud Network).
5. **Add SSH Keys** *(Important)*:
   - Select **"Generate a key pair for me"**.
   - Click **"Save private key"** to download the `.key` file to your laptop (e.g. `Downloads/ssh-key.key`).
6. Click **"Create"**.
7. Wait 1–2 minutes until the status shows **Running** in green.
8. Copy the **Public IP Address** displayed on the page (e.g., `129.150.x.x`).

---

## 🔓 Step 3: Open Port 80 (HTTP) in Oracle Firewall

By default, Oracle blocks incoming web traffic in the cloud subnet. You must open port 80:

1. On the instance details page, click on your **Subnet** link under *Primary VNIC*.
2. Click on the **Default Security List**.
3. Under **Ingress Rules**, click **"Add Ingress Rules"**:
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `TCP`
   - **Destination Port Range**: `80,443,3001`
   - **Description**: `Allow HTTP/HTTPS traffic`
4. Click **"Add Ingress Rules"**.

---

## 💻 Step 4: Connect to Your Cloud Server from Windows

Open **PowerShell** on your laptop and run:

```powershell
# Set permissions on your downloaded SSH key (replace with your actual file path)
icacls "C:\Users\abhip\Downloads\ssh-key.key" /inheritance:r
icacls "C:\Users\abhip\Downloads\ssh-key.key" /grant:r "$($env:USERNAME):(R)"

# Connect to the cloud instance (replace with your Oracle Public IP)
ssh -i "C:\Users\abhip\Downloads\ssh-key.key" ubuntu@YOUR_PUBLIC_IP
```

You are now inside your cloud server!

---

## 🚀 Step 5: Transfer Project & Run Automated Setup

### Option A: Using Git (Easiest)
Push your project to GitHub (or a private repo), then on your cloud server:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git linkedin-scheduler
cd linkedin-scheduler
```

Create your `.env` file on the cloud server:
```bash
nano .env
```
*(Paste your `.env` keys from your laptop, then press `Ctrl + O`, `Enter`, and `Ctrl + X` to save).*

Now run the 1-click automated setup script:
```bash
bash oracle-setup.sh
```

---

### Option B: Direct Copy from Laptop via SCP
If you haven't uploaded to GitHub, you can copy the folder directly from your Windows PowerShell:

```powershell
scp -i "C:\Users\abhip\Downloads\ssh-key.key" -r "C:\Users\abhip\Downloads\PROJECT" ubuntu@YOUR_PUBLIC_IP:~/linkedin-scheduler
```

Then on the server:
```bash
cd linkedin-scheduler
bash oracle-setup.sh
```

---

## 🔗 Step 6: Update LinkedIn Developer Redirect URI

Now that your server is live at `http://YOUR_PUBLIC_IP`:

1. Open your browser and go to `http://YOUR_PUBLIC_IP` to see your LinkedIn Scheduler web app!
2. Go to [LinkedIn Developers Console](https://www.linkedin.com/developers/) -> your App -> **Auth** tab.
3. Under **OAuth 2.0 settings**, add your new redirect URL:
   ```
   http://YOUR_PUBLIC_IP/api/auth/linkedin/callback
   ```
4. On your server, make sure your `.env` has:
   ```
   CLIENT_URL=http://YOUR_PUBLIC_IP
   LINKEDIN_REDIRECT_URI=http://YOUR_PUBLIC_IP/api/auth/linkedin/callback
   ```
   *(If you change `.env`, restart with: `pm2 restart linkedin-scheduler`)*.

---

## 🎉 Verification & Monitoring

- **Check server status**:
  ```bash
  pm2 status
  ```
- **View live real-time scheduler logs**:
  ```bash
  pm2 logs
  ```
- **Auto-Restart on Reboot**:
  PM2 has been configured to automatically restart the scheduler even if Oracle Cloud reboots the VM.

You can now **close your laptop completely**. Your LinkedIn AI campaigns will generate and post 24/7!
