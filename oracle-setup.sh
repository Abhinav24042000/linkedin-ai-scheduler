#!/bin/bash
# ==============================================================================
# LinkedIn AI Scheduler - Automated Oracle Cloud Always-Free Setup Script
# ==============================================================================
set -e

echo "========================================================================"
echo "    LINKEDIN AI SCHEDULER - ORACLE CLOUD 24/7 AUTOMATED DEPLOYMENT"
echo "========================================================================"
echo ""

# 1. Update system packages
echo "[1/6] Updating system packages and installing prerequisites..."
sudo apt-get update -y
sudo apt-get install -y curl git build-essential nginx ufw

# 2. Install Node.js 20.x
echo ""
echo "[2/6] Installing Node.js 20 LTS..."
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "      Node version: $(node -v)"
echo "      NPM version:  $(npm -v)"

# 3. Install global PM2 process manager
echo ""
echo "[3/6] Installing PM2 process manager..."
sudo npm install -g pm2

# 4. Install project dependencies & build frontend
echo ""
echo "[4/6] Installing dependencies and building production frontend..."
npm run install:all
npm run build

# 5. Configure Oracle Cloud Ubuntu Firewall (Allow HTTP port 80 and 3001)
echo ""
echo "[5/6] Opening network ports (80, 443, 3001) in Oracle Linux firewall..."
# Oracle Ubuntu images have strict iptables rules by default
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true

# 6. Configure Nginx Reverse Proxy (Port 80 -> Port 3001)
echo ""
echo "[6/6] Configuring Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/linkedin-scheduler > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/linkedin-scheduler /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 7. Start the application with PM2
echo ""
echo "Starting LinkedIn Scheduler with PM2..."
pm2 delete linkedin-scheduler 2>/dev/null || true
NODE_ENV=production pm2 start "node server/index.js" --name "linkedin-scheduler"

# Save PM2 process list and configure automatic boot on VM restart
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo ""
echo "========================================================================"
echo "                   DEPLOYMENT COMPLETE!"
echo "========================================================================"
echo ""
echo "Your app is now running 24/7 in the cloud!"
echo "Status check: pm2 status"
echo "Live logs:    pm2 logs"
echo ""
