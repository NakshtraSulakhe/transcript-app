# 🚀 Production Deployment Guide for Transcript App (VPS & Docker)

This guide provides complete instructions for deploying **Transcript App** on any Virtual Private Server (VPS) such as Hostinger, DigitalOcean, AWS EC2, Hetzner, Vultr, or Linode using **Docker Compose** or **PM2 + Nginx**.

---

## 🛠️ Method 1: Docker Compose Deployment (Recommended)

Docker Compose bundles Next.js and Nginx reverse proxy into isolated production containers with automatic restarts and zero configuration conflicts.

### Step 1: Install Docker & Docker Compose on your VPS
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

### Step 2: Clone Repository & Create `.env.local`
```bash
git clone https://github.com/NakshtraSulakhe/transcript-app.git
cd transcript-app/transcript-app

# Create production environment variables
nano .env.local
```

Paste your production variables into `.env.local`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 3: Launch Docker Containers
```bash
docker compose up -d --build
```

### Step 4: Verify Deployment
Check running container status and logs:
```bash
docker compose ps
docker compose logs -f
```
Your app is now live at `http://your-server-ip`!

---

## ⚡ Method 2: PM2 + Nginx Deployment (Native Node.js)

If you prefer running Next.js natively on Node.js without Docker:

### Step 1: Install Node.js 20 & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm install -g pm2
```

### Step 2: Clone, Configure & Build App
```bash
git clone https://github.com/NakshtraSulakhe/transcript-app.git
cd transcript-app/transcript-app

# Add .env.local
echo "GEMINI_API_KEY=your_key_here" > .env.local

# Install & Build
npm ci
npm run build
```

### Step 3: Start App with PM2
```bash
pm2 start npm --name "transcript-app" -- start -- -p 3000
pm2 save
pm2 startup
```

### Step 4: Configure Nginx Reverse Proxy
```bash
sudo nano /etc/nginx/sites-available/transcript-app
```
Paste:
```nginx
server {
    listen 80;
    server_name your-domain.com; # or your-server-ip

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 600s;
    }
}
```

Enable configuration and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/transcript-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Enabling Free SSL Certificate (HTTPS) with Let's Encrypt

To add HTTPS with Let's Encrypt for your custom domain:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot automatically configures SSL certificates and auto-renews them every 90 days.

---

## 🛡️ Firewall Configuration (`ufw`)

Ensure HTTP, HTTPS, and SSH ports are open:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 📊 Key Production Advantages on VPS

| Feature | Vercel Serverless | VPS (Docker/PM2) |
|---|---|---|
| **Max Payload Size** | 4.5 MB Limit (HTTP 413) | **Unlimited / 100 MB+** |
| **Execution Timeout** | 10–60 Seconds Limit | **Unlimited / 600s+** |
| **Cost** | Paid Tiers for Team Usage | **Fixed monthly cost ($4-$10/mo)** |
| **Background Tasks** | Not supported natively | **Fully Supported** |
