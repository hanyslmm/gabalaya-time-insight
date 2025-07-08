# AWS EC2 & CloudFront Deployment Guide

This guide will walk you through deploying your React application to AWS EC2 with CloudFront for global content delivery.

## Prerequisites

- AWS Account with billing enabled
- Domain name (optional but recommended)
- Basic knowledge of SSH and Linux commands

## Part 1: Setting up EC2 Instance

### Step 1: Launch EC2 Instance

1. **Log in to AWS Console**
   - Go to https://aws.amazon.com/console/
   - Navigate to EC2 Dashboard

2. **Launch New Instance**
   - Click "Launch Instance"
   - **Name**: Give your instance a descriptive name (e.g., "timesheet-app-server")
   
3. **Choose AMI (Amazon Machine Image)**
   - Select **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type**
   - 64-bit (x86) architecture

4. **Choose Instance Type**
   - **t3.small** (recommended for small applications)
   - Or **t2.micro** (eligible for free tier)

5. **Key Pair (Login)**
   - Create new key pair or use existing
   - **Key pair name**: `timesheet-app-key`
   - **Key pair type**: RSA
   - **Private key file format**: .pem
   - Download and save the .pem file securely

6. **Network Settings**
   - **Create security group** or use existing
   - **Security group name**: `timesheet-app-sg`
   - **Allow SSH traffic** from your IP
   - **Allow HTTPS traffic** from the internet
   - **Allow HTTP traffic** from the internet

7. **Configure Storage**
   - **Size**: 20 GiB (or more based on your needs)
   - **Volume type**: gp3

8. **Launch Instance**

### Step 2: Connect to EC2 Instance

```bash
# Make key file secure
chmod 400 /path/to/timesheet-app-key.pem

# Connect to instance
ssh -i /path/to/timesheet-app-key.pem ubuntu@<your-ec2-public-ip>
```

## Part 2: Server Setup

### Step 1: Update System & Install Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (latest LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install additional tools
sudo apt install -y nginx certbot python3-certbot-nginx git

# Verify installations
node --version
npm --version
nginx -v
```

### Step 2: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/timesheet-app

# Add the following configuration:
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com; # Replace with your domain
    
    root /var/www/timesheet-app/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/js
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/timesheet-app /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 3: Deploy Application

```bash
# Create application directory
sudo mkdir -p /var/www/timesheet-app
sudo chown -R $USER:$USER /var/www/timesheet-app

# Clone your repository (if using Git)
cd /var/www/timesheet-app
git clone <your-repo-url> .

# Install dependencies
npm install

# Build the application
npm run build

# Set proper permissions
sudo chown -R www-data:www-data /var/www/timesheet-app/dist
```

### Step 4: Set up SSL Certificate (Let's Encrypt)

```bash
# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

## Part 3: CloudFront Setup

### Step 1: Create S3 Bucket for Static Assets

1. **Create S3 Bucket**
   - Go to S3 Console
   - Create bucket: `timesheet-app-assets-[random-string]`
   - Region: Choose same as your EC2 instance
   - Block all public access: **Uncheck** for static hosting

2. **Configure Bucket Policy**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::timesheet-app-assets-[random-string]/*"
        }
    ]
}
```

3. **Enable Static Website Hosting**
   - Properties tab → Static website hosting
   - **Enable**
   - Index document: `index.html`
   - Error document: `index.html`

### Step 2: Create CloudFront Distribution

1. **Create Distribution**
   - Go to CloudFront Console
   - Click "Create Distribution"

2. **Origin Settings**
   - **Origin Domain**: Your EC2 public DNS or domain
   - **Protocol**: HTTPS only (if SSL configured)
   - **Origin Path**: Leave empty

3. **Default Cache Behavior**
   - **Viewer Protocol Policy**: Redirect HTTP to HTTPS
   - **Allowed HTTP Methods**: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - **Cache Policy**: Managed-CachingOptimized
   - **Origin Request Policy**: Managed-CORS-S3Origin

4. **Distribution Settings**
   - **Price Class**: Use all edge locations (best performance)
   - **Alternate Domain Names (CNAMEs)**: Your domain
   - **Custom SSL Certificate**: Choose your certificate

5. **Create Distribution**

### Step 3: Configure Route 53 (if using custom domain)

1. **Create Hosted Zone**
   - Go to Route 53 Console
   - Create hosted zone for your domain

2. **Create Records**
   - **A Record**: Point to CloudFront distribution
   - **AAAA Record**: Point to CloudFront distribution (IPv6)

## Part 4: Deployment Automation

### Set up GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Build
      run: npm run build
      
    - name: Deploy to EC2
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.HOST }}
        username: ubuntu
        key: ${{ secrets.PRIVATE_KEY }}
        script: |
          cd /var/www/timesheet-app
          git pull origin main
          npm install
          npm run build
          sudo systemctl restart nginx
```

## Part 5: Environment Variables

### Set up Environment Variables on EC2

```bash
# Create environment file
sudo nano /etc/environment

# Add your variables:
VITE_SUPABASE_URL="your-supabase-url"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Reload environment
source /etc/environment
```

## Part 6: Monitoring & Maintenance

### Set up CloudWatch (Optional)

1. **Install CloudWatch Agent**
```bash
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E amazon-cloudwatch-agent.deb
```

2. **Configure monitoring**
```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

### Set up Log Rotation

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/nginx

# Add configuration:
/var/log/nginx/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
```

## Part 7: Security Best Practices

### 1. Update Security Groups
```bash
# Restrict SSH access to your IP only
# Allow HTTP/HTTPS from anywhere
# Close unnecessary ports
```

### 2. Set up Fail2Ban
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Configure UFW Firewall
```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
```

### 4. Regular Updates
```bash
# Set up automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**
   - Check if the application is running
   - Verify Nginx configuration
   - Check firewall settings

2. **SSL Certificate Issues**
   - Verify domain ownership
   - Check DNS propagation
   - Renew certificates if expired

3. **CloudFront Caching Issues**
   - Create invalidation for updated files
   - Check cache behaviors
   - Verify origin settings

### Useful Commands

```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Check disk usage
df -h

# Check memory usage
free -h

# Check running processes
ps aux | grep node
```

## Cost Optimization

1. **Use appropriate instance types**
   - Start with t3.micro/small
   - Scale based on traffic

2. **Set up CloudWatch alarms**
   - Monitor CPU usage
   - Set up auto-scaling

3. **Use reserved instances**
   - For predictable workloads
   - Significant cost savings

4. **Optimize CloudFront**
   - Use appropriate price class
   - Set proper cache behaviors

## Support

For additional help:
- AWS Documentation: https://docs.aws.amazon.com/
- AWS Support: https://aws.amazon.com/support/
- Community Forums: https://forums.aws.amazon.com/

---

This guide provides a comprehensive setup for deploying your timesheet application to AWS with CloudFront. Adjust configurations based on your specific requirements and traffic patterns.